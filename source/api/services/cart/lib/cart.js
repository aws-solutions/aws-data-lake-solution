/*********************************************************************************************************************
 *  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance        *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://aws.amazon.com/asl/                                                                                    *
 *                                                                                                                    *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/**
 * @author Solution Builders
 */

'use strict';

let moment = require('moment');
let AWS = require('aws-sdk');
let shortid = require('shortid');
let _ = require('underscore');
let Validator = require('jsonschema').Validator;
let AccessValidator = require('access-validator');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials

const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const ddbTable = 'data-lake-cart';

/**
 * Performs CRUD operations for a data lake user's cart interfacing primiarly with the
 * data-lake-cart Amazon DynamoDB table. Additionally, it handles the cart checkout intiation
 * for a user's cart upon request.
 *
 * @class cart
 */
let cart = (function() {

    /**
     * @class cart
     * @constructor
     */
    let cart = function() {};

    let cartSchema = {
        id: '/cart',
        type: 'object',
        properties: {
            user_id: {
                type: 'string'
            },
            item_id: {
                type: 'string'
            },
            package_id: {
                type: 'string'
            },
            cart_item_status: {
                type: 'string'
            },
            created_at: {
                type: 'string'
            },
            expires: {
                type: 'string'
            },
            updated_at: {
                type: 'string'
            },
            url: {
                type: 'string'
            }
        },
        required: ['user_id', 'item_id', 'package_id', 'cart_item_status', 'created_at']
    };

    let v = new Validator();

    /**
     * Recursive helper to build out full data profile of items in a user's cart. Filters out
     * items that have expired.
     * @param {JSON} cart - Cart object.
     * @param {integer} index - Index of item in user's cart to process.
     * @param {getCartItemDetails~requestCallback} cb - The callback that handles the response.
     */
    let getCartItemDetails = function(ticket, cart, index, cb) {

        let accessValidator = new AccessValidator();
        accessValidator.getUserGroups(ticket.userid, function(err, data) {
            if (err) {
                console.log(err);
                cb({error: {message: 'No valid permission.'}}, null);
                return;
            }

            let _results = {
                Items: []
            };

            if (index < cart.Items.length) {
                let params = {
                    TableName: 'data-lake-packages',
                    KeyConditionExpression: 'package_id = :pid',
                    ExpressionAttributeValues: {
                        ':pid': cart.Items[index].package_id
                    }
                };

                docClient.query(params, function(err, resp) {
                    if (err) {
                        console.log(err);
                        return cb(err, null);
                    }

                    for (let i = 0; i < resp.Items.length; i++) {

                        // Skip if the package is deleted
                        if (resp.Items[i].deleted) {
                            continue;
                        }

                        // Skip if the user does not have access to the package
                        if (ticket.role.toLowerCase() != 'admin') {
                            let user_groups = [];
                            data.Groups.map(group => {user_groups.push(group.GroupName);});
                            if (ticket.userid != resp.Items[i].owner && _.intersection(user_groups, resp.Items[i].groups).length == 0) {
                                continue;
                            }
                        }

                        if (moment(cart.Items[index].expires) > moment.utc() ||
                            cart.Items[index].cart_item_status == 'pending' ||
                            cart.Items[index].cart_item_status == 'unable_to_process') {
                            _results.Items.push({
                                user_id: cart.Items[index].user_id,
                                package_id: cart.Items[index].package_id,
                                cart_item_status: cart.Items[index].cart_item_status,
                                created_at: cart.Items[index].created_at,
                                item_id: cart.Items[index].item_id,
                                status_details: cart.Items[index].status_details,
                                expires: cart.Items[index].expires,
                                url: cart.Items[index].url,
                                name: resp.Items[i].name,
                                format: cart.Items[index].format,
                                description: resp.Items[i].description
                            });
                        }
                    }

                    let _index = index + 1;
                    if (_index < cart.Items.length) {

                        getCartItemDetails(ticket, cart, _index, function(err, data) {
                            if (err) {
                                console.log(err);
                                return cb(err, null);
                            }

                            for (let i = 0; i < data.Items.length; i++) {
                                _results.Items.push(data.Items[i]);
                            }

                            return cb(null, _results);

                        });

                    } else {
                        return cb(null, _results);
                    }

                });
            } else {
                return cb(null, _results);
            }

        });
    };

    /**
     * Retrieves items in a user's cart.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {getCartByUserId~requestCallback} cb - The callback that handles the response.
     */
    cart.prototype.getCartByUserId = function(ticket, cb) {

        let params = {
            TableName: ddbTable,
            KeyConditionExpression: 'user_id = :uid',
            FilterExpression: 'expires > :now or attribute_not_exists(expires)',
            ExpressionAttributeValues: {
                ':uid': ticket.userid,
                ':now': moment.utc().format()
            }
        };

        docClient.query(params, function(err, resp) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            getCartItemDetails(ticket, resp, 0, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                return cb(null, data);
            });

        });

    };

    /**
     * Adds a data lake pacakge to a user's cart.
     * @param {JSON} item - New cart item.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {createCartItem~requestCallback} cb - The callback that handles the response.
     */
    cart.prototype.createCartItem = function(item, ticket, cb) {

        // check to see if package is already a pending item in cart
        let params = {
            TableName: ddbTable,
            KeyConditionExpression: 'user_id = :uid',
            FilterExpression: 'package_id = :pid and cart_item_status in (:pending, :error)',
            ExpressionAttributeValues: {
                ':uid': ticket.userid,
                ':pid': item.package_id,
                ':pending': 'pending',
                ':error': 'unable_to_process'
            }
        };

        docClient.query(params, function(err, cart) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (cart.Items.length === 0) {
                let _newCartItem = {
                    user_id: ticket.userid,
                    item_id: shortid.generate(),
                    package_id: item.package_id,
                    created_at: moment.utc().format(),
                    cart_item_status: 'pending'
                };

                let _schemaCheck = v.validate(_newCartItem, cartSchema);
                if (_schemaCheck.valid) {
                    let params = {
                        TableName: 'data-lake-packages',
                        KeyConditionExpression: 'package_id = :pid',
                        ExpressionAttributeValues: {
                            ':pid': item.package_id
                        }
                    };

                    // check to see if the package id sent exists
                    docClient.query(params, function(err, resp) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        if (resp.Items.length > 0) {
                            let params = {
                                TableName: ddbTable,
                                Item: _newCartItem
                            };

                            docClient.put(params, function(err, data) {
                                if (err) {
                                    console.log(err);
                                    return cb(err, null);
                                }

                                return cb(null, _newCartItem);
                            });
                        } else {
                            return cb({
                                error: {
                                    message: 'The package requested to add to the cart does not exist.'
                                }
                            }, null);
                        }

                    });
                } else {
                    return cb({
                        error: {
                            message: 'Invalid schema provided when attempting to add item to cart.'
                        }
                    }, null);
                }
            } else {
                return cb(null, {
                    message: 'The package requested to add is already in the user\'s cart'
                });
            }

        });

    };

    /**
     * Removes a data lake pacakge from a user's cart.
     * @param {integer} itemId - ID of the item to remove from the user's cart.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {deleteCartItem~requestCallback} cb - The callback that handles the response.
     */
    cart.prototype.deleteCartItem = function(itemId, ticket, cb) {

        let params = {
            TableName: ddbTable,
            Key: {
                user_id: ticket.userid,
                item_id: itemId
            }
        };

        docClient.delete(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, data);
        });

    };

    /**
     * Removes an item from a user's cart.
     * @param {integer} itemId - ID of the item to retrieve from the user's cart.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {getCartItem~requestCallback} cb - The callback that handles the response.
     */
    cart.prototype.getCartItem = function(itemId, ticket, cb) {

        let params = {
            TableName: ddbTable,
            Key: {
                user_id: ticket.userid,
                item_id: itemId
            }
        };

        docClient.get(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, data);
        });

    };

    /**
     * Checks out a user's cart by intiating the generation of a manifest file for
     * each item 'pending' in a user's cart.
     * @param {integer} itemId - ID of the item to retrieve from the user's cart.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {checkout~requestCallback} cb - The callback that handles the response.
     */
    cart.prototype.checkout = function(body, ticket, token, cb) {

        if (body.operation != 'checkout') {
            return cb({
                error: {
                    message: 'Invalid operation requested on the user\'s cart.'
                }
            }, null);
        }

        // get the items in the users cart
        let params = {
            TableName: ddbTable,
            KeyConditionExpression: 'user_id = :uid',
            FilterExpression: 'cart_item_status = :pending or cart_item_status = :error',
            ExpressionAttributeValues: {
                ':uid': ticket.userid,
                ':pending': 'pending',
                ':error': 'unable_to_process'
            }
        };

        docClient.query(params, function(err, resp) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            let _pending = resp.Items;

            if (_pending.length > 0) {

                let _batchRequest = [];
                for (let i = 0; i < _pending.length; i++) {
                    let _item = _pending[i];
                    _item.cart_item_status = 'processing';
                    _batchRequest.push({
                        PutRequest: {
                            Item: _item
                        }
                    });
                }

                let params = {
                    RequestItems: {
                        'data-lake-cart': _batchRequest
                    }
                };

                docClient.batchWrite(params, function(err, data) {
                    if (err) {
                        console.log(err);
                        return cb(err, null);
                    }

                    let _payload = {
                        cart: _pending,
                        operation: 'generate',
                        format: body.format,
                        authorizationToken: token
                    };

                    // add async invocation to lambda function that processes manifest file
                    let params = {
                        FunctionName: 'data-lake-manifest-service',
                        InvocationType: 'Event',
                        LogType: 'None',
                        Payload: JSON.stringify(_payload)
                    };
                    let lambda = new AWS.Lambda();
                    lambda.invoke(params, function(err, data) {
                        if (err) {
                            console.log(err);
                            return cb({
                                    error: {
                                        message: 'Error occured when triggering manifest import'
                                    }
                                },
                                null);
                        }

                        return cb(null, {
                            message: 'manifest file generation initiated'
                        });
                    });
                });

            } else {
                return cb(null, {
                    message: 'No cart items in a pending state to process'
                });
            }
        });

    };

    return cart;

})();

module.exports = cart;
