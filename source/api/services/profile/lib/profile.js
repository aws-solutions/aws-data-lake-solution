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
let hat = require('hat');
const url = require('url');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials

const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};

/**
 * Performs profile actions for a user, such as, creating a secret access key and retrieving
 * user profile information..
 *
 * @class profile
 */
let profile = (function() {

    /**
     * @class profile
     * @constructor
     */
    let profile = function() {};

    /**
     * Get profile information for the user stored outside of cognitio user pool.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {getProfile~requestCallback} cb - The callback that handles the response.
     */
    profile.prototype.getProfile = function(ticket, cb) {

        getConfigInfo(function(err, config) {
            if (err) {
                return cb(err, null);
            }

            let _url = url.parse(config.Item.setting.apiEndpoint);
            let _profile = {
                hostname: _url.hostname
            };

            cb(null, _profile);
        });
    };

    /**
     * Creates a secret access key for a user and encrypts the key using the data lake KMS key.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {createApiKey~requestCallback} cb - The callback that handles the response.
     */
    profile.prototype.createApiKey = function(ticket, cb) {

        getConfigInfo(function(err, config) {
            if (err) {
                return cb(err, null);
            }

            let _key = hat();

            let params = {
                KeyId: config.Item.setting.kmsKeyId,
                Plaintext: _key
            };

            let kms = new AWS.KMS();
            kms.encrypt(params, function(err, keydata) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to encrypt API Key."}, null);
                }

                let _encryptedKey = keydata.CiphertextBlob.toString('base64');

                let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

                let params = {
                    UserAttributes: [{
                        Name: 'custom:secretaccesskey',
                        Value: _encryptedKey
                    }],
                    UserPoolId: config.Item.setting.idp,
                    Username: ticket.userid
                };
                cognitoidentityserviceprovider.adminUpdateUserAttributes(params, function(err,
                    data) {
                    if (err) {
                        console.log(err);
                        return cb({code: 502, message: "Failed to update user  attributes."}, null);
                    }

                    return cb(null, {key: _key});
                });
            });

        });

    };

    /**
     * Helper function to retrieve data lake configuration setting from Amazon DynamoDB [data-lake-settings].
     * @param {getConfigInfo~requestCallback} cb - The callback that handles the response.
     */
    let getConfigInfo = function(cb) {

        let params = {
            TableName: 'data-lake-settings',
            Key: {
                setting_id: 'app-config'
            }
        };

        let docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
        if (typeof cb !== 'undefined' && cb) {
            docClient.get(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to retrieving app configuration settings [ddb]."}, null);
                }

                return cb(null, data);
            });
        } else {
            return docClient.get(params).promise();
        }
    };


    return profile;

})();

module.exports = profile;
