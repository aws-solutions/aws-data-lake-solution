/*********************************************************************************************************************
 *  Copyright 2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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
let Indexer = require('./es-indexer.js');
let Metadata = require('./metadata.js');
let _ = require('underscore');
let Validator = require('jsonschema').Validator;

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials

const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const ddbTable = 'data-lake-packages';

/**
 * Performs CRUD operations for the data lake package interfacing primiarly with the
 * data-lake-packages Amazon DynamoDB table. Additionally, initiates interactions with
 * elastic search cluster for indexing operations.
 *
 * @class contentPackage
 */
let contentPackage = (function() {

    let packageSchema = {
        id: '/ContentPackage',
        type: 'object',
        properties: {
            package_id: {
                type: 'string'
            },
            name: {
                type: 'string'
            },
            description: {
                type: 'string'
            },
            owner: {
                type: 'string'
            },
            created_at: {
                type: 'string'
            },
            updated_at: {
                type: 'string'
            },
            deleted: {
                type: 'boolean'
            }
        },
        required: ['package_id', 'name', 'description', 'owner', 'created_at', 'updated_at']
    };

    let v = new Validator();

    /**
     * @class contentPackage
     * @constructor
     */
    let contentPackage = function() {
        v.addSchema(packageSchema, '/ContentPackage');
    };

    /**
     * Retrieves all packages listed in the data lake.
     * @param {getPackages~requestCallback} cb - The callback that handles the response.
     */
    contentPackage.prototype.getPackages = function(cb) {

        let params = {
            TableName: ddbTable
        };

        docClient.scan(params, function(err, resp) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, resp);
        });

    };

    /**
     * Creates a new package in the data lake.
     * @param {JSON} event - Request event.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {createPackage~requestCallback} cb - The callback that handles the response.
     */
    contentPackage.prototype.createPackage = function(event, ticket, cb) {

        let _body = JSON.parse(event.body);

        // make sure the package has the requirement governance
        getGovernanceRequirements(function(err, settings) {

            if (settings.Items.length > 0) {
                for (let i = 0; i < settings.Items.length; i++) {
                    let _mdata = null;
                    if (_body.metadata) {
                        _mdata = _.find(_body.metadata, function(val) {
                            return val.tag == settings.Items[i].setting.tag;
                        });
                    }

                    if (!_mdata && settings.Items[i].setting.governance === 'Required') {
                        let _msg = ['The required metadata', settings.Items[i].setting.tag, 'is missing']
                            .join(' ');
                        return cb({
                            error: {
                                message: _msg
                            }
                        }, null);
                    }
                }
            }

            let _package = _body.package;
            let _newpackage = {
                package_id: shortid.generate(),
                created_at: moment.utc().format(),
                updated_at: moment.utc().format(),
                owner: ticket.userid,
                name: _package.name.substring(0, 100),
                description: _package.description.substring(0, 1000),
                deleted: false
            };

            let _schemaCheck = v.validate(_newpackage, packageSchema);
            if (_schemaCheck.valid) {

                let params = {
                    TableName: ddbTable,
                    Item: _newpackage
                };

                docClient.put(params, function(err, data) {
                    if (err) {
                        console.log(err);
                        return cb(err, null);
                    }

                    // 2017-02-18: hotfix to accomodate API Gateway header transformations
                    let _authToken = '';
                    if (event.headers.Auth) {
                        console.log(['Header token post transformation:', 'Auth'].join(' '));
                        _authToken = event.headers.Auth;
                    } else if (event.headers.auth) {
                        console.log(['Header token post transformation:', 'auth'].join(' '));
                        _authToken = event.headers.auth;
                    }

                    // if metadata exists, create the records
                    if (_body.metadata) {
                        let _metadata = new Metadata();
                        var _payload = {
                            headers: {
                                Auth: _authToken
                            },
                            body: JSON.stringify({
                                metadata: _body.metadata,
                                created_by: _newpackage.owner
                            })
                        };
                        _metadata.createPackageMetadata(_newpackage.package_id, _payload.body,
                            _authToken, ticket,
                            function(err, data) {
                                if (err) {
                                    console.log(err);
                                    return cb(err, null);
                                }

                                return cb(null, _newpackage);
                            });
                    } else {
                        let _indexer = new Indexer();
                        _indexer.indexToSearch(_newpackage.package_id, _authToken,
                            function(err,
                                data) {
                                if (err) {
                                    console.log('indexing error: ', err);
                                }

                                return cb(null, _newpackage);
                            });
                    }

                });
            } else {
                return cb({
                    error: {
                        message: 'Invalid schema provided when attempting to create package.'
                    }
                }, null);
            }
        });

    };

    /**
     * Deletes (soft delete) a package from the data lake.
     * @param {JSON} event - Request event.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {deletePackage~requestCallback} cb - The callback that handles the response.
     */
    contentPackage.prototype.deletePackage = function(event, ticket, cb) {

        let _package = JSON.parse(event.body);

        let params = {
            TableName: ddbTable,
            Key: {
                package_id: event.pathParameters.package_id
            }
        };

        docClient.get(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(data)) {
                if (data.Item.owner == ticket.userid || ticket.role == 'Admin') {
                    let params = {
                        TableName: ddbTable,
                        Key: {
                            package_id: event.pathParameters.package_id
                        },
                        UpdateExpression: 'set #a = :x',
                        ExpressionAttributeNames: {
                            '#a': 'deleted'
                        },
                        ExpressionAttributeValues: {
                            ':x': true
                        },
                        ReturnValues: 'ALL_NEW'
                    };

                    docClient.update(params, function(err, data) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        let _indexer = new Indexer();

                        // 2017-02-18: hotfix to accomodate API Gateway header transformations
                        let _authToken = '';
                        if (event.headers.Auth) {
                            console.log(['Header token post transformation:', 'Auth'].join(' '));
                            _authToken = event.headers.Auth;
                        } else if (event.headers.auth) {
                            console.log(['Header token post transformation:', 'auth'].join(' '));
                            _authToken = event.headers.auth;
                        }

                        _indexer.deleteIndexedPackage(event.pathParameters.package_id,
                            _authToken,
                            function(
                                err, data) {
                                if (err) {
                                    console.log('es index removal error: ', err);
                                }

                                return cb(null, {});
                            });
                    });
                } else {
                    return cb({
                        error: {
                            message: 'User does not have access to updated the requested package.'
                        }
                    }, null);
                }

            } else {
                return cb({
                    error: {
                        message: 'The data lake package requested to update does not exist.'
                    }
                }, null);
            }
        });

    };

    /**
     * Retrieves a package from the data lake.
     * @param {string} packageId - Data lake package id.
     * @param {getPackage~requestCallback} cb - The callback that handles the response.
     */
    contentPackage.prototype.getPackage = function(packageId, cb) {

        let params = {
            TableName: ddbTable,
            Key: {
                package_id: packageId
            }
        };

        docClient.get(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(data)) {
                if (data.Item.deleted) {
                    data = {};
                }
            }

            return cb(null, data);

        });

    };

    /**
     * Updates a package in the data lake.
     * @param {JSON} event - Request event.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {updatePackage~requestCallback} cb - The callback that handles the response.
     */
    contentPackage.prototype.updatePackage = function(event, ticket, cb) {

        let _package = JSON.parse(event.body);

        let params = {
            TableName: ddbTable,
            Key: {
                package_id: event.pathParameters.package_id
            }
        };

        docClient.get(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(data)) {
                if (data.Item.owner == ticket.userid || ticket.role == 'Admin') {
                    let params = {
                        TableName: ddbTable,
                        Key: {
                            package_id: event.pathParameters.package_id
                        },
                        UpdateExpression: 'set #a = :x, #b = :y, #c = :z',
                        ExpressionAttributeNames: {
                            '#a': 'updated_at',
                            '#b': 'description',
                            '#c': 'name'
                        },
                        ExpressionAttributeValues: {
                            ':x': moment.utc().format(),
                            ':y': _package.description ? _package.description : data.Item.description,
                            ':z': _package.name ? _package.name : data.Item.name
                        },
                        ReturnValues: 'ALL_NEW'
                    };

                    docClient.update(params, function(err, resp) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        let _indexer = new Indexer();

                        // 2017-02-18: hotfix to accomodate API Gateway header transformations
                        let _authToken = '';
                        if (event.headers.Auth) {
                            console.log(['Header token post transformation:', 'Auth'].join(' '));
                            _authToken = event.headers.Auth;
                        } else if (event.headers.auth) {
                            console.log(['Header token post transformation:', 'auth'].join(' '));
                            _authToken = event.headers.auth;
                        }

                        _indexer.indexToSearch(event.pathParameters.package_id, _authToken,
                            function(err,
                                data) {
                                if (err) {
                                    console.log('indexing error: ', err);
                                }

                                return cb(null, resp);
                            });
                    });
                } else {
                    return cb({
                        message: 'User does not have access to updated the requested package.'
                    }, null);
                }

            } else {
                return cb({
                    message: 'The data lake package requested to update does not exist.'
                }, null);
            }

        });

    };

    /**
     * Retrieves the data lake package governance requirements.
     * @param {getGovernanceRequirements~requestCallback} cb - The callback that handles the response.
     */
    let getGovernanceRequirements = function(cb) {
        // get metadata governance requirements
        let params = {
            TableName: 'data-lake-settings'
        };

        docClient.scan(params, function(err, resp) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            let _settings = {
                Items: _.where(resp.Items, {
                    type: 'governance'
                })
            };
            cb(null, _settings);

        });
    };

    return contentPackage;

})();

module.exports = contentPackage;
