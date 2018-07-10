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

'use strict';

let AWS = require('aws-sdk');
let _ = require('underscore');
let moment = require('moment');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials

const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);

/**
 * Initiates search indexing operations [add document, delete document] for data lake packages.
 *
 * @class indexer
 */
let indexer = (function() {

    /**
     * @class indexer
     * @constructor
     */
    let indexer = function() {};

    /**
     * Creates a document for indexing a package to the search engine.
     * @param {integer} packageId - ID of the package to create index document for indexing.
     * @param {buildIndexDocument~requestCallback} cb - The callback that handles the response.
     */
    let buildIndexDocument = function(packageId, cb) {
        let params = {
            TableName: 'data-lake-packages',
            Key: {
                package_id: packageId
            }
        };

        docClient.get(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            // get metadata
            if (!_.isEmpty(data)) {

                let params = {
                    TableName: 'data-lake-metadata',
                    KeyConditionExpression: 'package_id = :pid',
                    ExpressionAttributeValues: {
                        ':pid': packageId
                    }
                };

                docClient.query(params, function(err, metadata) {
                    if (err) {
                        console.log(err);
                        return cb(err, null);
                    }

                    data.Item.metadata = [];

                    if (metadata.Items.length > 0) {
                        let _sorted = _.sortBy(metadata.Items, function(m) {
                            return m.created_at;
                        });

                        // use the most recent metadata; last item in _sorted
                        if (!_.isEmpty(_sorted[_sorted.length - 1])) {
                            data.Item.metadata = _sorted[_sorted.length - 1].metadata;
                        }
                    }

                    data.Item.updated_at = moment.utc().format();

                    return cb(null, data.Item);

                });

            } else {
                return cb(null, data);
            }

        });

    };

    /**
     * Indexes a data lake package to the search engine.
     * @param {integer} packageId - ID of the package to index.
     * @param {string} token - Authorization header token of the request to pass to index process.
     * @param {indexToSearch~requestCallback} cb - The callback that handles the response.
     */
    indexer.prototype.indexToSearch = function(packageId, token, cb) {

        buildIndexDocument(packageId, function(err, contentPackage) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            let _document = {
                body: contentPackage,
                resource: '/search/index',
                httpMethod: 'POST',
                headers: {
                    Auth: token
                }
            };

            // invoke data-lake-search-service function to index package
            let params = {
                FunctionName: 'data-lake-search-service',
                InvocationType: 'RequestResponse',
                LogType: 'None',
                Payload: JSON.stringify(_document)
            };
            let lambda = new AWS.Lambda();
            lambda.invoke(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                console.log('Search indexer result:' + data);
                return cb(null, 'successfully indexed');
            });
        });

    };

    /**
     * Removes a data lake package from the search engine.
     * @param {integer} packageId - ID of the package to remove from index.
     * @param {string} token - Authorization header token of the request to pass to index process.
     * @param {deleteIndexedPackage~requestCallback} cb - The callback that handles the response.
     */
    indexer.prototype.deleteIndexedPackage = function(packageId, token, cb) {

        let _document = {
            body: {
                package_id: packageId
            },
            resource: '/search/index',
            httpMethod: 'DELETE',
            headers: {
                Auth: token
            }
        };

        // invoke data-lake-admin-service function to verify if user has
        // proper role for requested action
        let params = {
            FunctionName: 'data-lake-search-service',
            InvocationType: 'Event',
            LogType: 'None',
            Payload: JSON.stringify(_document)
        };
        let lambda = new AWS.Lambda();
        lambda.invoke(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, 'successfully submitted index removal to ES');
        });

    };

    return indexer;

})();

module.exports = indexer;
