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
            index: searchIndex,
            body: {
                "mappings": {
                    "package" : {
                        "properties" : {
                            "created_at": {
                                "type": "date"
                            },
                            "deleted": {
                                "type": "boolean"
                            },
                            "description": {
                                "type": "text"
                            },
                            "groups": {
                                "type": "keyword",
                                "ignore_above": 12800
                            },
                            "name": {
                                "type": "text"
                            },
                            "owner": {
                                "type": "keyword",
                                "ignore_above": 128
                            },
                            "package_id": {
                                "type": "keyword",
                                "ignore_above": 128
                            },
                            "updated_at": {
                                "type": "date"
                            }
                        }
                    }
                }
            }
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

    /**
     * Configure Amazon Cognito authentication for Kibana and activate log publishing.
     *
     * @param {string} identityPoolId - Cogniot identity pool ID.
     * @param {string} roleArn - Configuration configuration role ARN.
     * @param {string} userPoolId - Cognito user pool ID.
     * @param {string} logGroupArn - ARN of the Cloudwatch log group to which log needs to be published.
     * @param {string} logGroupPolicyName - Cloudwatch log group policy name.
     *
     * @param {updateElasticsearchDomainConfig~requestCallback} cb - The callback that handles the response.
     */
    elasticsearchHelper.prototype.updateElasticsearchDomainConfig = function(identityPoolId, roleArn,
        userPoolId, logGroupArn, logGroupPolicyName, cb) {

        var cloudwatchlogs = new AWS.CloudWatchLogs();
        let params = {
            policyName: logGroupPolicyName,
            policyDocument: JSON.stringify({
                Version: "2012-10-17",
                Statement: [{
                    Effect: "Allow",
                    Principal: {Service: "es.amazonaws.com"},
                    Action: [
                        "logs:PutLogEvents",
                        "logs:CreateLogStream"
                    ],
                    Resource: logGroupArn
                }]
            })
        };
        cloudwatchlogs.putResourcePolicy(params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                return cb(err, null);
            }

            var es = new AWS.ES();
            let params = {
                DomainName: 'data-lake',
                CognitoOptions: {
                    Enabled: true,
                    IdentityPoolId: identityPoolId,
                    RoleArn: roleArn,
                    UserPoolId: userPoolId
                },
                LogPublishingOptions: {
                    SEARCH_SLOW_LOGS: {
                        CloudWatchLogsLogGroupArn: logGroupArn,
                        Enabled: true
                    },
                    INDEX_SLOW_LOGS: {
                        CloudWatchLogsLogGroupArn: logGroupArn,
                        Enabled: true
                    },
                    ES_APPLICATION_LOGS: {
                        CloudWatchLogsLogGroupArn: logGroupArn,
                        Enabled: true
                    }
                }
            };
            es.updateElasticsearchDomainConfig(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                    return cb(err, null);
                }

                return cb(null, data);
            });
        });
    };

    /**
     * Deletes a resource policy from this account. This revokes the access of the
     * identities in that policy to put log events to this account.
     *
     * @param {string} logGroupPolicyName - Cloudwatch log group policy name.
     *
     * @param {deleteResourcePolicy~requestCallback} cb - The callback that handles the response.
     */
    elasticsearchHelper.prototype.deleteResourcePolicy = function(logGroupPolicyName, cb) {
        var cloudwatchlogs = new AWS.CloudWatchLogs();
        var params = {policyName: logGroupPolicyName};
        cloudwatchlogs.deleteResourcePolicy(params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                return cb(err, null);
            }

            return cb(null, data);
        });
    };

    /**
     * Federate cognito kibana authentication.
     *
     * @param {string} userPoolId - Cognito user pool ID.
     * @param {string} federatedLogin - Flag to indicate if federated access is activated
     * @param {string} adFsHostname - The identity provider name.
     *
     * @param {federateKibanaAccess~requestCallback} cb - The callback that handles the response.
     */
    elasticsearchHelper.prototype.federateKibanaAccess = function(userPoolId, adFsHostname, cb) {
        var cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
        let params = {
          UserPoolId: userPoolId,
          MaxResults: 2
        };
        cognitoidentityserviceprovider.listUserPoolClients(params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                return cb(err, null);
            }

            var esClient = data.UserPoolClients.find(function(c) {return c.ClientName.toLowerCase().startsWith('awselasticsearch');});
            let params = {
                ClientId: esClient.ClientId,
                UserPoolId: userPoolId
            };
            cognitoidentityserviceprovider.describeUserPoolClient(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                    return cb(err, null);
                }

                let params = data.UserPoolClient;
                delete params.ClientSecret;
                delete params.LastModifiedDate;
                delete params.CreationDate;
                params.SupportedIdentityProviders = [adFsHostname];
                console.log(params);
                cognitoidentityserviceprovider.updateUserPoolClient(params, function(err, data) {
                    if (err) {
                        console.log(err, err.stack); // an error occurred
                        return cb(err, null);
                    }

                    return cb(null, data);

                });
            });
        });
    };

    return elasticsearchHelper;

})();

module.exports = elasticsearchHelper;
