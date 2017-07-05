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

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
AWS.config.update({
    region: process.env.AWS_REGION
});

/**
 * Helper function to interact with the data lake Elasticsearch Service cluster for data lake cfn custom resource.
 *
 * @class elasticsearchHelper
 */
let elasticsearchHelper = (function() {

    /**
     * @class elasticsearchHelper
     * @constructor
     */
    let elasticsearchHelper = function() {};

    /**
     * Creates a new search index in the data lake Elasticsearch Service cluster.
     * @param {string} clusterUrl - URL for the data lake Elasticsearch Service cluster.
     * @param {string} searchIndex - Name of new search index to create.
     * @param {saveAppConfigSettings~requestCallback} cb - The callback that handles the response.
     */
    elasticsearchHelper.prototype.createSearchIndex = function(clusterUrl, searchIndex, cb) {

        let client = require('elasticsearch').Client({
            hosts: clusterUrl,
            connectionClass: require('http-aws-es')
        });

        client.indices.create({
            index: searchIndex
        }, function(err, resp) {
            if (err) {
                console.log('The data lake elasticsearch cluster is down!');
                console.log(err);
                return cb(err, null);
            } else {
                console.log(resp);
                return cb(null, resp);
            }
        });

    };

    return elasticsearchHelper;

})();

module.exports = elasticsearchHelper;
