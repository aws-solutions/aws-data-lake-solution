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

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const ddbTable = 'data-lake-settings';

/**
 * Performs CRUD operations for data lake settings interfacing primiarly with the data lake
 * Amazon DynamoDB table [data-lake-settings].
 *
 * @class setting
 */
let setting = (function() {

    /**
     * @class setting
     * @constructor
     */
    let setting = function() {};

    /**
     * Retrieves data lake app configuration settings.
     * @param {getAppSettings~requestCallback} cb - The callback that handles the response.
     */
    setting.prototype.getAppSettings = function(cb) {

        let params = {
            TableName: ddbTable,
            Key: {
                setting_id: 'app-config'
            }
        };

        docClient.get(params, function(err, resp) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            cb(null, resp);
        });

    };

    /**
     * Updates the data lake app configuration settings.
     * @param {JSON} config - Updated configuation settings object.
     * @param {updateAppSettings~requestCallback} cb - The callback that handles the response.
     */
    setting.prototype.updateAppSettings = function(config, cb) {

        let _config = JSON.parse(config);

        //verify cartAccessExpiration element is int
        let _expiration = parseInt(_config.setting.cartAccessExpiration);
        let _searchLimit = parseInt(_config.setting.searchResultsLimit);
        let _logging = _config.setting.auditLogging;

        if (typeof(_expiration) === 'number') {
            let params = {
                TableName: ddbTable,
                Key: {
                    setting_id: 'app-config'
                }
            };

            // get the current app-config settings
            docClient.get(params, function(err, resp) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                // only update the manifest expiration period
                if (!_.isEmpty(resp)) {
                    if (_expiration < 900) {
                        _expiration = 900;
                    }

                    if (_expiration > 14400) {
                        _expiration = 14400;
                    }

                    resp.Item.setting.cartAccessExpiration = _expiration;
                    resp.Item.setting.searchResultsLimit = _searchLimit;
                    resp.Item.setting.auditLogging = _logging;
                    resp.Item.updated_at = moment.utc().format();
                    let params = {
                        TableName: ddbTable,
                        Item: resp.Item
                    };

                    docClient.put(params, function(err, data) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        return cb(null, resp.Item);
                    });
                } else {
                    cb('The app configuration settings are not available.', null);
                }
            });
        } else {
            cb('The app configuration expiration setting was invalid. It must be in seconds [integer].', null);
        }
    };

    /**
     * Retrieves data lake governance settings.
     * @param {getGovernanceSettings~requestCallback} cb - The callback that handles the response.
     */
    setting.prototype.getGovernanceSettings = function(cb) {

        let params = {
            TableName: ddbTable
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

    /**
     * Create a new data lake governance settings.
     * @param {JSON} setting - Governance setting object to create.
     * @param {createGovernanceSetting~requestCallback} cb - The callback that handles the response.
     */
    setting.prototype.createGovernanceSetting = function(setting, cb) {

        let _setting = JSON.parse(setting);
        _setting.setting_id = shortid.generate();
        _setting.type = 'governance';
        _setting.created_at = moment.utc().format();
        _setting.updated_at = _setting.created_at;

        let params = {
            TableName: ddbTable,
            Item: _setting
        };

        docClient.put(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, _setting);
        });

    };

    /**
     * Deletes a data lake governance setting.
     * @param {integer} settingId - ID of governance setting to delete.
     * @param {deleteGovernanceSetting~requestCallback} cb - The callback that handles the response.
     */
    setting.prototype.deleteGovernanceSetting = function(settingId, cb) {
        let params = {
            TableName: ddbTable,
            Key: {
                setting_id: settingId
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
     * Retrieves a data lake governance setting.
     * @param {integer} settingId - ID of governance setting to retrieve.
     * @param {getGovernanceSetting~requestCallback} cb - The callback that handles the response.
     */
    setting.prototype.getGovernanceSetting = function(settingId, cb) {

        let params = {
            TableName: ddbTable,
            Key: {
                setting_id: settingId
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
     * Update and existing new data lake governance setting.
     * @param {integer} settingId - ID of governance setting to update.
     * @param {JSON} setting - Governance setting information to update.
     * @param {updateGovernanceSetting~requestCallback} cb - The callback that handles the response.
     */
    setting.prototype.updateGovernanceSetting = function(settingId, setting, cb) {

        let _setting = JSON.parse(setting);
        _setting.updated_at = moment.utc().format();
        let params = {
            TableName: ddbTable,
            Item: _setting
        };

        docClient.put(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, _setting);
        });

    };

    return setting;

})();

module.exports = setting;
