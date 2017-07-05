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
let _ = require('underscore');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const ddbTable = 'data-lake-settings';

/**
 * Performs search operations such as indexing documents, remove documents and performing searches
 * on the elasticsearch cluster for the data lake contextual package metastore.
 *
 * @class metadata
 */
let metadata = (function() {

    /**
     * @class metadata
     * @constructor
     */
    let metadata = function() {};

    /**
     * Performs search on data lake elasticsearch cluster using the keyword terms provided.
     * @param {string} term - Keyword terms to search metastore.
     * @param {search~requestCallback} cb - The callback that handles the response.
     */
    metadata.prototype.search = function(term, cb) {
        console.log('search term: \'' + term + '\'');
        console.log('searching...');

        getConfigInfo(function(err, config) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(config)) {

                let client = require('elasticsearch').Client({
                    hosts: config.Item.setting.esurl,
                    connectionClass: require('http-aws-es'),
                    amazonES: {
                        region: process.env.AWS_REGION,
                        credentials: creds
                    }
                });

                client.search({
                    q: term,
                    index: config.Item.setting.esindex,
                    size: config.Item.setting.searchResultsLimit
                }).then(function(body) {
                    let _results = {
                        Items: []
                    };
                    for (let i = 0; i < body.hits.hits.length; i++) {
                        _results.Items.push(body.hits.hits[i]._source);
                    }

                    cb(null, _results);
                }, function(error) {
                    console.trace(error.message);
                    cb(error, null);
                });

            } else {
                cb({
                    error: {
                        message: 'No valid app configuration data available.'
                    }
                }, null);
            }

        });
    };

    /**
     * Indexes a document representing a data lake package to the elasticsearch cluster.
     * @param {JSON} contentPackage - Data lake package object to index in elasticsearch.
     * @param {indexDocument~requestCallback} cb - The callback that handles the response.
     */
    metadata.prototype.indexDocument = function(contentPackage, cb) {
        console.log('Indexing document:', contentPackage);

        getConfigInfo(function(err, config) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(config)) {

                let client = require('elasticsearch').Client({
                    hosts: config.Item.setting.esurl,
                    connectionClass: require('http-aws-es'),
                    amazonES: {
                        region: process.env.AWS_REGION,
                        credentials: creds
                    }
                });

                client.index({
                    index: config.Item.setting.esindex,
                    type: 'package',
                    timestamp: moment().toISOString(),
                    id: contentPackage.package_id,
                    body: contentPackage
                }).then(function(body) {
                    console.log(body);
                    cb(null, hits);
                }, function(error) {
                    console.trace(error.message);
                    cb(error, null);
                });

            } else {
                cb({
                    error: {
                        message: 'No valid app configuration data available.'
                    }
                }, null);
            }

        });

    };

    /**
     * Initiates a request to remove a pacakge document from the elasticsearch cluster. It checks
     * to see if the document is actually in the cluster, then proceeds to execute the removal of
     * all documents meeting query results.
     * @param {JSON} event - Request event containing package information to delete from index.
     * @param {deleteDocument~requestCallback} cb - The callback that handles the response.
     */
    metadata.prototype.deleteDocument = function(event, cb) {

        getConfigInfo(function(err, config) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(config)) {

                let client = require('elasticsearch').Client({
                    hosts: config.Item.setting.esurl,
                    connectionClass: require('http-aws-es'),
                    amazonES: {
                        region: process.env.AWS_REGION,
                        credentials: creds
                    }
                });

                console.log(['retrieving all documents for package:', event.body.package_id].join(''));
                client.search({
                    q: ['package_id:', event.body.package_id].join(''),
                    index: config.Item.setting.esindex
                }).then(function(body) {
                    let hits = body.hits.hits;
                    deleteDocumentFromES(client, hits, 0, config.Item.setting.esindex, function(
                        err, data) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        cb(null, {});
                    });
                }, function(error) {
                    console.trace(error.message);
                    cb(error, null);
                });

            } else {
                cb({
                    error: {
                        message: 'No valid app configuration data available.'
                    }
                }, null);
            }

        });

    };

    /**
     * Recursive helper function to remove documents from the data lake index on the elasticsearch cluster.
     * @param {JSON} client - ElasticSearch javascript client
     * @param {array} documents - Documents to remove from the elasticsearch cluster
     * @param {integer} index - Index of documents to remove
     * @param {string} esindex - elasticsearch cluster index identifier
     * @param {deleteDocumentFromES~requestCallback} cb - The callback that handles the response.
     */
    let deleteDocumentFromES = function(client, documents, index, esindex, cb) {

        if (index < documents.length) {
            console.log(['pruging document:', documents[index]._id].join(''));

            client.delete({
                id: documents[index]._id,
                type: 'package',
                index: esindex
            }, function(err, resp) {
                if (err) {
                    console.trace(err.message);
                }

                let _index = index + 1;
                if (_index < documents.length) {
                    deleteDocumentFromES(client, documents, _index, esindex, function(err, data) {
                        if (err) {
                            console.log(err);
                        }

                        cb(null, {});
                    });
                } else {
                    cb(null, {});
                }

            });
        } else {
            cb(null, {});
        }
    };

    /**
     * Helper function to retrieve data lake configuration setting from Amazon DynamoDB [data-lake-settings].
     * @param {getConfigInfo~requestCallback} cb - The callback that handles the response.
     */
    let getConfigInfo = function(cb) {
        console.log('Retrieving app-config information...');
        let params = {
            TableName: ddbTable,
            Key: {
                setting_id: 'app-config'
            }
        };

        let docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
        docClient.get(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb({
                    error: {
                        message: 'Error retrieving app configuration settings [ddb].'
                    }
                }, null);
            }

            return cb(null, data);
        });
    };

    return metadata;

})();

module.exports = metadata;
