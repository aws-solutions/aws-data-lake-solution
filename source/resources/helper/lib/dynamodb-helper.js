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

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const ddbTable = 'data-lake-settings';

/**
 * Helper function to interact with dynamodb for data lake cfn custom resource.
 *
 * @class dynamoDBHelper
 */
let dynamoDBHelper = (function() {

    /**
     * @class dynamoDBHelper
     * @constructor
     */
    let dynamoDBHelper = function() {};

    /**
     * Saves the app configuration settings for the data lake at deployment.
     * @param {string} settings - Settings to save in data-lake-settings.
     * @param {saveAppConfigSettings~requestCallback} cb - The callback that handles the response.
     */
    dynamoDBHelper.prototype.saveDataLakeConfigSettings = function(appConfig, cb) {
        let _setting = {
            setting_id: 'app-config',
            type: 'config',
            created_at: moment.utc().format(),
            updated_at: moment.utc().format(),
            setting: appConfig
        };

        let params = {
            TableName: ddbTable,
            Item: _setting
        };

        docClient.put(params, function(err, data) {
            if (err) {
                return cb(err, null);
            }

            return cb(null, _setting);
        });
    };

    return dynamoDBHelper;

})();

module.exports = dynamoDBHelper;
