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
let _ = require('underscore');
let shortid = require('shortid');
let hat = require('hat');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const ddbTable = 'data-lake-keys';

/**
 * Performs CRUD operations for user api keys interfacing primiarly with the data lake
 * Amazon DynamoDB table [data-lake-keys] and the data lake Amazon Cogntio user pool.
 *
 * @class apikey
 */
let apikey = (function() {

    /**
     * @class apikey
     * @constructor
     */
    let apikey = function() {};

    /**
     * Retrieves data lake app configuration settings.
     * @param {getApiKeyByUserid~requestCallback} cb - The callback that handles the response.
     */
    apikey.prototype.getApiKeyByUserid = function(uid, cb) {

        let params = {
            TableName: ddbTable,
            FilterExpression: 'user_id = :uid',
            ExpressionAttributeValues: {
                ':uid': uid
            }
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
     * Retrieves a data lake API key.
     * @param {integer} akid - ID of api key to retrieve.
     * @param {getApiKey~requestCallback} cb - The callback that handles the response.
     */
    apikey.prototype.getApiKey = function(akid, cb) {

        let params = {
            TableName: ddbTable,
            KeyConditionExpression: 'access_key_id = :akid',
            ExpressionAttributeValues: {
                ':akid': akid
            }
        };

        docClient.query(params, function(err, resp) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, resp);

        });

    };

    /**
     * Creates a data lake API access key for user and updates the user Amazon Cognito account.
     * @param {string} userId - Username of the Amazon Congito user to create api key.
     * @param {getApiKey~requestCallback} cb - The callback that handles the response.
     */
    apikey.prototype.createApiKey = function(userId, cb) {

        getUserPoolConfigInfo(function(err, poolinfo) {

            if (err) {
                console.log(err);
                return cb(err, null);
            }

            let _key = {
                access_key_id: shortid.generate(),
                user_id: userId,
                key_status: 'Active',
                created_at: moment.utc().format(),
                updated_at: moment.utc().format()
            };

            let params = {
                TableName: ddbTable,
                Item: _key
            };

            docClient.put(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

                let params = {
                    UserAttributes: [{
                        Name: 'custom:accesskey',
                        Value: _key.access_key_id
                    }, {
                        Name: 'custom:secretaccesskey',
                        Value: ''
                    }],
                    UserPoolId: poolinfo,
                    Username: userId
                };
                cognitoidentityserviceprovider.adminUpdateUserAttributes(params, function(err,
                    data) {
                    if (err) {
                        console.log(err);
                        return cb(err, null);
                    }

                    return cb(null, _key);

                });

            });

        });

    };

    /**
     * Removes data lake API access for user and deletes the access key and secret access key
     * in the user Amazon Cognito account.
     * @param {string} accessKeyId - ID of api key to delete.
     * @param {string} userId - Username of the Amazon Congito user to remove api keys.
     * @param {getApiKey~requestCallback} cb - The callback that handles the response.
     */
    apikey.prototype.deleteApiKey = function(accessKeyId, userId, cb) {

        getUserPoolConfigInfo(function(err, poolinfo) {

            if (err) {
                console.log(err);
                return cb(err, null);
            }

            let params = {
                TableName: ddbTable,
                Key: {
                    access_key_id: accessKeyId,
                    user_id: userId
                }
            };

            docClient.delete(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

                let params = {
                    UserAttributes: [{
                        Name: 'custom:accesskey',
                        Value: ''
                    }, {
                        Name: 'custom:secretaccesskey',
                        Value: ''
                    }],
                    UserPoolId: poolinfo,
                    Username: userId
                };
                cognitoidentityserviceprovider.adminUpdateUserAttributes(params, function(err,
                    resp) {
                    if (err) {
                        console.log(err);
                        return cb(err, null);
                    }

                    return cb(null, data);

                });
            });
        });

    };

    /**
     * Updates data lake API access key for user
     * @param {string} accessKeyId - ID of api key to delete.
     * @param {JSON} apikey - API Key data to update.
     * @param {getApiKey~requestCallback} cb - The callback that handles the response.
     */
    apikey.prototype.updateApiKey = function(accessKeyId, apikey, cb) {

        let _apikey = JSON.parse(apikey);
        _apikey.updated_at = moment.utc().format();
        let params = {
            TableName: ddbTable,
            Item: _apikey
        };

        docClient.put(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, _apikey);
        });

    };

    /**
     * Helper function to validate that a generated password is strong.
     * @param {string} password - Password to validate.
     */
    let getUserPoolConfigInfo = function(cb) {
        console.log('Retrieving app-config information...');
        let params = {
            TableName: 'data-lake-settings',
            Key: {
                setting_id: 'app-config'
            }
        };

        docClient.get(params, function(err, config) {
            if (err) {
                console.log(err);
                return cb('Error retrieving app configuration settings [ddb].', null);
            }

            if (!_.isEmpty(config)) {
                cb(null, config.Item.setting.idp);
            } else {
                cb('No valid IDP app configuration data available.', null);
            }
        });
    };

    return apikey;

})();

module.exports = apikey;
