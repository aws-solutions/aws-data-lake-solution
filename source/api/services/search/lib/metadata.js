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

let AWS = require('aws-sdk');
let _ = require('underscore');
let AccessValidator = require('access-validator');

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

    let accessValidator = new AccessValidator();

    /**
     * @class metadata
     * @constructor
     */
    let metadata = function() {};

    /**
     * Performs search on data lake elasticsearch cluster using the keyword terms provided.
     * @param {string} term - Keyword terms to search metastore.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {search~requestCallback} cb - The callback that handles the response.
     */
    metadata.prototype.search = function(term, ticket, cb) {

        accessValidator.validate(null, ticket, 'metadata:search', function(err, data) {
            if (err) {
                console.log(err);
                cb({error: {message: 'No valid access.'}}, null);
            }

            getConfigInfo(function(err, config) {
                if (err || _.isEmpty(config)) {
                    console.log(err);
                    cb({error: {message: 'No valid app configuration data available.'}}, null);
                }

                accessValidator.getUserGroups(ticket.userid, function(err, data) {
                    if (err) {
                        console.log(err);
                        cb({error: {message: 'No valid permission.'}}, null);
                        return;
                    }

                    //-------------------------------------------------------------
                    // Get user group list and set filter based on those groups
                    //-------------------------------------------------------------
                    let filter = [];
                    if (ticket.role.toLowerCase() != 'admin') {
                        filter.push({match: {"owner": ticket.userid}});
                        data.Groups.map(group => {filter.push({match: {"groups": group.GroupName}});});
                    }

                    //-------------------------------------------------------------
                    // Set search body
                    //-------------------------------------------------------------
                    let body = {
                        query: {
                            bool: {
                                must: {
                                    query_string: {
                                        query: term
                                    }
                                }
                            }
                        }
                    };
                    if (filter.length > 0) {
                        body.query.bool.filter = {
                            bool: {
                                should: filter
                            }
                        };
                    }

                    //-------------------------------------------------------------
                    // Execute Search
                    //-------------------------------------------------------------
                    let client = require('elasticsearch').Client({
                        hosts: config.Item.setting.esurl,
                        connectionClass: require('http-aws-es'),
                        amazonES: {
                            region: process.env.AWS_REGION,
                            credentials: creds
                        }
                    });
                    client.search({
                        body: body,
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
                });
            });
        });

    };

    /**
     * Performs multi search on data lake elasticsearch cluster to retrive dashboard information - num of owned and accessible pachages.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {search~requestCallback} cb - The callback that handles the response.
     */
    metadata.prototype.stats = function(ticket, cb) {

        accessValidator.validate(null, ticket, 'metadata:dashboardStats', function(err, data) {
            if (err) {
                console.log(err);
                cb({error: {message: 'No valid access.'}}, null);
            }

            getConfigInfo(function(err, config) {
                if (err || _.isEmpty(config)) {
                    console.log(err);
                    cb({error: {message: 'No valid app configuration data available.'}}, null);
                }

                accessValidator.getUserGroups(ticket.userid, function(err, data) {
                    if (err) {
                        console.log(err);
                        cb({error: {message: 'No valid permission.'}}, null);
                        return;
                    }

                    //-------------------------------------------------------------
                    // Set search body
                    //-------------------------------------------------------------
                    let body = [];
                    let owned_packages = {
                        query: {
                            bool: {
                                must: {
                                    query_string: {
                                        query: "*"
                                    }
                                }
                            },
                            bool: {
                                filter: {
                                    bool: {
                                        should: [{match: {owner: ticket.userid}}]
                                    }
                                }
                            }
                        },
                        size: 0
                    };
                    let accessible_packages = {
                        query: {
                            bool: {
                                must: {
                                    query_string: {
                                        query: "*"
                                    }
                                }
                            }
                        },
                        size: 0
                    };
                    if (ticket.role.toLowerCase() != 'admin') {
                        let filter = [];
                        filter.push({match: {"owner": ticket.userid}});
                        data.Groups.map(group => {filter.push({match: {"groups": group.GroupName}});});
                        accessible_packages.query.bool.filter = {
                            bool: {
                                should: filter
                            }
                        };
                    }
                    body.push({});
                    body.push(owned_packages);
                    body.push({});
                    body.push(accessible_packages);

                    //-------------------------------------------------------------
                    // Execute Search
                    //-------------------------------------------------------------
                    let client = require('elasticsearch').Client({
                        hosts: `${config.Item.setting.esurl}`,
                        connectionClass: require('http-aws-es'),
                        amazonES: {
                            region: process.env.AWS_REGION,
                            credentials: creds
                        }
                    });
                    client.msearch({
                        body: body
                    }).then(function(body) {
                        console.log(body);
                        let _results = {
                            owned_packages: body.responses[0].hits.total,
                            accessible_packages: body.responses[1].hits.total
                        };
                        cb(null, _results);
                    }, function(error) {
                        console.trace(error.message);
                        cb(error, null);
                    });
                });
            });
        });

    };

    /**
     * Indexes a document representing a data lake package to the elasticsearch cluster.
     * @param {JSON} contentPackage - Data lake package object to index in elasticsearch.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {indexDocument~requestCallback} cb - The callback that handles the response.
     */
    metadata.prototype.indexDocument = function(contentPackage, ticket, cb) {

        accessValidator.validate(contentPackage.package_id, ticket, 'metadata:indexDocument', function(err, data) {
            if (err) {
                console.log("[indexDocument] Error: ", err);
                return cb(err, null);
            }

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
                        id: contentPackage.package_id,
                        body: contentPackage
                    }).then(function(body) {
                        cb(null, {message: 'Document indexed successfully.'});
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
        });
    };

    /**
     * Initiates a request to remove a pacakge document from the elasticsearch cluster. It checks
     * to see if the document is actually in the cluster, then proceeds to execute the removal of
     * all documents meeting query results.
     * @param {JSON} event - Request event containing package information to delete from index.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {deleteDocument~requestCallback} cb - The callback that handles the response.
     */
    metadata.prototype.deleteDocument = function(event, ticket, cb) {

        accessValidator.validate(event.body.package_id, ticket, 'metadata:deleteDocument', function(err, data) {
            if (err) {
                return cb(err, null);
            }

            getConfigInfo(function(err, config) {
                if (err) {
                    console.log("[deleteDocument] Error: ", err);
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
        });

    };

    /**
     * Index AWS GLue table name after crawler execution.
     *
     * @param {JSON} event - Request event containing package information to delete from index.
     * @param {indexColumns~requestCallback} cb - The callback that handles the response.
     */
    metadata.prototype.indexColumns = function (event, cb) {
        let crawlerName = event.detail.crawlerName;
        let databaseName = crawlerName.replace(/ /g,"_");
        let packageId = crawlerName.split(' ').pop();
        let columnNames = [];
        let columnComments = [];
        let tableDescs = [];
        let params = {};
        let tableStats = {
            averageRecordSize: 0,
            objectCount: 0,
            recordCount: 0,
            sizeKey: 0
        };
        let glue = new AWS.Glue();
        let docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);

        //-------------------------------------------------------------------------
        // Cancel if the package is already deleted
        //-------------------------------------------------------------------------
        params = {
            TableName: 'data-lake-packages',
            Key: {
                package_id: packageId
            }
        };
        docClient.get(params, function(err, data) {
            if (err || data.deleted) {
                console.log(err);
                return cb({code: 502, message: "Failed to retrieve package info."}, null);
            }

            //---------------------------------------------------------------------
            // Get column names, comments and table descriptions
            //---------------------------------------------------------------------
            params = {
                DatabaseName: databaseName
            };
            glue.getTables(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to retrieve tables info."}, null);
                }

                // Column Names
                columnNames = data.TableList.map(function(table) {
                    return table.StorageDescriptor.Columns.map(function(column) {
                        return column.Name;
                    });
                });
                columnNames = _.chain(columnNames).flatten().uniq()._wrapped;

                // Column Comments
                columnComments = data.TableList.map(function(table) {
                    return table.StorageDescriptor.Columns.map(function(column) {
                        return column.Comment;
                    });
                });
                columnComments = _.chain(columnComments).flatten().uniq().compact()._wrapped;

                // Column Descriptions
                tableDescs = data.TableList.map(function(table) {
                    return table.Description;
                });
                tableDescs = _.chain(tableDescs).flatten().uniq().compact()._wrapped;

                // Tables Statistics
                let counter = 0;
                data.TableList.map(function(table) {
                    if (table.Parameters) {
                        counter++;
                        tableStats.averageRecordSize += table.Parameters.averageRecordSize ? parseFloat(table.Parameters.averageRecordSize) : 0;
                        tableStats.objectCount += table.Parameters.objectCount ? parseInt(table.Parameters.objectCount) : 0;
                        tableStats.recordCount += table.Parameters.recordCount ? parseInt(table.Parameters.recordCount) : 0;
                        tableStats.sizeKey += table.Parameters.sizeKey ? parseInt(table.Parameters.sizeKey) : 0;
                    }
                });
                if (counter > 0) {
                    tableStats.averageRecordSize /= counter;
                    tableStats.averageRecordSize = tableStats.averageRecordSize.toFixed(2);
                }

                //-----------------------------------------------------------------
                // Index meta-data
                //-----------------------------------------------------------------
                getConfigInfo(function(err, config) {
                    if (err || _.isEmpty(config)) {
                        console.log(err);
                        return cb({code: 502, message: "Failed to retrieve config."}, null);
                    }

                    let client = require('elasticsearch').Client({
                        hosts: config.Item.setting.esurl,
                        connectionClass: require('http-aws-es'),
                        amazonES: {
                            region: process.env.AWS_REGION,
                            credentials: creds
                        }
                    });

                    client.updateByQuery({
                        index: config.Item.setting.esindex,
                        type: 'package',
                        body: {
                            "query": { "match": { "package_id": packageId } },
                            "script": {
                                "inline": "ctx._source.column_name = params.columnNames; ctx._source.column_comment = params.columnComments; ctx._source.table_desc = params.tableDescs; ctx._source.table_stats = params.tableStats",
                                "params": {"columnNames": columnNames, "columnComments": columnComments, "tableDescs": tableDescs, "tableStats": tableStats}
                            }
                        }
                    }).then(function(body) {
                        return cb(null, {code: 200, message: "Index updated."});

                    }, function(err) {
                        console.log(err);
                        return cb({code: 502, message: "Failed to update ES document."}, null);
                    });
                });
            });
        });
    };

    /**
     * Recursive helper function to remove documents from the data lake index on the elasticsearch cluster.
     * @param {JSON} client - ElasticSearch javascript client
     * @param {array} documents - Documents to remove from the elasticsearch cluster
     * @param {JSON} ticket - Data lake authorization ticket.
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
