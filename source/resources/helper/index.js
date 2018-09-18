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

console.log('Loading function');

const AWS = require('aws-sdk');
const https = require('https');
const url = require('url');
const moment = require('moment');
const DynamoDBHelper = require('./lib/dynamodb-helper.js');
const CognitoHelper = require('./lib/cognito-helper.js');
const ElasticsearchHelper = require('./lib/elasticsearch-helper.js');
const GlueHelper = require('./lib/glue-helper.js');
const S3Helper = require('./lib/s3-helper.js');
const MetricsHelper = require('./lib/metrics-helper.js');
const UUID = require('uuid');

/**
 * Request handler.
 */
exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    let responseStatus = 'FAILED';
    let responseData = {};

    if (event.RequestType === 'Delete') {
        if (event.ResourceProperties.customAction === 'sendMetric') {
            responseStatus = 'SUCCESS';

            let _metricsHelper = new MetricsHelper();

            let _metric = {
                Solution: event.ResourceProperties.solutionId,
                UUID: event.ResourceProperties.UUID,
                TimeStamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
                Data: {
                    Version: event.ResourceProperties.version,
                    Deleted: moment().utc().format()
                }
            };

            if (event.ResourceProperties.anonymousData === 'Yes') {
                _metricsHelper.sendAnonymousMetric(_metric, function(err, data) {
                    if (err) {
                        responseData = {
                            Error: 'Sending anonymous delete metric failed'
                        };
                        console.log([responseData.Error, ':\n', err].join(''));
                    }

                    sendResponse(event, callback, context, responseStatus, responseData);
                });
            } else {
                sendResponse(event, callback, context, 'SUCCESS');
            }

        } else if (event.ResourceProperties.customAction === 'cleanDataLakeGlueResources') {
            let _glueHelper = new GlueHelper();
            _glueHelper.cleanDataLakeGlueResources(function(err, data) {
                if (err) {
                    console.log(err);
                }

                sendResponse(event, callback, context, 'SUCCESS');
            });

        } else if (event.ResourceProperties.customAction === 'configureDatalakeBuckets') {
            let _s3Helper = new S3Helper();
            _s3Helper.processDeleteEvent(event.ResourceProperties.dataLakeDefaultBucket,
                event.ResourceProperties.dataLakeWebsiteBucket,
                function(err, data) {
                    if (err) {
                        console.log(err);
                    }

                    sendResponse(event, callback, context, 'SUCCESS');
                });

        } else if (event.ResourceProperties.customAction === 'updateElasticsearchDomainConfig') {
            let _esHelper = new ElasticsearchHelper();
            _esHelper.deleteResourcePolicy(event.ResourceProperties.logGroupPolicyName,
                function(err, data) {
                    if (err) {
                        console.log(err);
                    }

                    sendResponse(event, callback, context, 'SUCCESS');
                });

        } else {
            sendResponse(event, callback, context, 'SUCCESS');
        }
    }

    if (event.RequestType === 'Create') {
        if (event.ResourceProperties.customAction === 'createUuid') {
            responseStatus = 'SUCCESS';
            responseData = {UUID: UUID.v4()};
            sendResponse(event, callback, context, responseStatus, responseData);

        } else if (event.ResourceProperties.customAction === 'sendMetric') {
            if (event.ResourceProperties.anonymousData === 'Yes') {
                let _metricsHelper = new MetricsHelper();
                let _metric = {
                    Solution: event.ResourceProperties.solutionId,
                    UUID: event.ResourceProperties.UUID,
                    TimeStamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
                    Data: {
                        Version: event.ResourceProperties.version,
                        Launch: moment().utc().format()
                    }
                };
                _metricsHelper.sendAnonymousMetric(_metric, function(err, data) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to send anonymous launch metric.'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    responseStatus = 'SUCCESS';
                    responseData = {};
                    sendResponse(event, callback, context, responseStatus, responseData);
                });

            } else {
                sendResponse(event, callback, context, 'SUCCESS');
            }

        } else if (event.ResourceProperties.customAction === 'loadAppConfig') {
            let _ddbHelper = new DynamoDBHelper();
            let _config = {
                defaultS3Bucket: event.ResourceProperties.defaultS3Bucket,
                appUrl: event.ResourceProperties.appUrl,
                idp: event.ResourceProperties.idp,
                auditLogging: event.ResourceProperties.auditLogging,
                cartAccessExpiration: event.ResourceProperties.cartAccessExpiration,
                searchResultsLimit: event.ResourceProperties.searchResultsLimit,
                apiEndpoint: event.ResourceProperties.apiEndpoint,
                esindex: event.ResourceProperties.esindex,
                esurl: event.ResourceProperties.esurl,
                kmsKeyId: event.ResourceProperties.kmsKeyId,
                anonymousData: event.ResourceProperties.anonymousData,
                uuid: event.ResourceProperties.UUID
            };

            _ddbHelper.saveDataLakeConfigSettings(_config, function(err, setting) {
                if (err) {
                    responseStatus = 'FAILED';
                    responseData = {Error: 'Failed to persist data-lake-settings DyanmoDB table info.'};
                    console.log([responseData.Error, ':\n', err].join(''));
                    return sendResponse(event, callback, context, responseStatus, responseData);
                }

                responseStatus = 'SUCCESS';
                responseData = setting;
                sendResponse(event, callback, context, responseStatus, responseData);
            });

        } else if (event.ResourceProperties.customAction === 'createAppVariables') {
            let _s3Helper = new S3Helper();

            _s3Helper.createAppVariables(event.ResourceProperties.userPoolId,
                event.ResourceProperties.userPoolClientId,
                event.ResourceProperties.apigEndpoint,
                event.ResourceProperties.appVersion,
                event.ResourceProperties.destS3Bucket,
                event.ResourceProperties.federatedLogin,
                event.ResourceProperties.loginUrl,
                event.ResourceProperties.logoutUrl,
                function(err, data) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to create app variables file.'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    responseStatus = 'SUCCESS';
                    responseData = {};
                    sendResponse(event, callback, context, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'createUserPool') {
            let _cognitoHelper = new CognitoHelper();

            _cognitoHelper.createDataLakeUserPool(
                function(err, userPoolInfo) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to create data lake Cognito User Pool.'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    responseStatus = 'SUCCESS';
                    responseData = {
                        UserPoolId: userPoolInfo.UserPoolId,
                        UserPoolClientId: userPoolInfo.UserPoolClientId
                    };
                    sendResponse(event, callback, context, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'createAdminUser') {
            let _cognitoHelper = new CognitoHelper();

            _cognitoHelper.createAdminUser(event.ResourceProperties.userPoolId,
                event.ResourceProperties.adminName,
                event.ResourceProperties.adminEmail,
                event.ResourceProperties.appUrl,
                function(err, newUserData) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to create data lake Cognito Admin user.'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    responseStatus = 'SUCCESS';
                    responseData = {
                        Username: newUserData.Username
                    };
                    sendResponse(event, callback, context, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'configureDatalakeBuckets') {
            let _s3Helper = new S3Helper();

            _s3Helper.configureDataLakeBuckets(event.ResourceProperties.dataLakeDefaultBucket,
                event.ResourceProperties.dataLakeWebsiteBucket,
                function(err, data) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to configure data lake buckets.'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    responseStatus = 'SUCCESS';
                    responseData = {};
                    sendResponse(event, callback, context, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'configureDatalakeBucketPolicy') {
            let _s3Helper = new S3Helper();

            _s3Helper.configureDatalakeBucketPolicy(event.ResourceProperties.dataLakeWebsiteBucket,
                event.ResourceProperties.consoleCanonicalUserId,
                function(err, data) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to configure data lake website bucket policy.'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    responseStatus = 'SUCCESS';
                    responseData = {};
                    sendResponse(event, callback, context, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'configureWebsite') {
            let _s3Helper = new S3Helper();

            _s3Helper.copyDataLakeSiteAssets(event.ResourceProperties.sourceS3Bucket,
                event.ResourceProperties.sourceS3key,
                event.ResourceProperties.sourceSiteManifestS3key,
                event.ResourceProperties.destS3Bucket,
                function(err, data) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to copy data lake website assets.'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    responseStatus = 'SUCCESS';
                    responseData = {};
                    sendResponse(event, callback, context, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'configureSearch') {
            let _esHelper = new ElasticsearchHelper();

            _esHelper.createSearchIndex(event.ResourceProperties.clusterUrl,
                event.ResourceProperties.searchIndex,
                function(err, data) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to create search index'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    responseStatus = 'SUCCESS';
                    responseData = {};
                    sendResponse(event, callback, context, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'updateElasticsearchDomainConfig') {
            let _cognitoHelper = new CognitoHelper();
            let _esHelper = new ElasticsearchHelper();

            _cognitoHelper.createUserPoolDomain(event.ResourceProperties.cognitoDomain,
                event.ResourceProperties.userPoolId,
                function(err, data) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to create data lake Cognito Domain.'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    _esHelper.updateElasticsearchDomainConfig(event.ResourceProperties.identityPoolId,
                        event.ResourceProperties.roleArn,
                        event.ResourceProperties.userPoolId,
                        event.ResourceProperties.logGroupArn,
                        event.ResourceProperties.logGroupPolicyName,
                        function(err, data) {
                            if (err) {
                                responseStatus = 'FAILED';
                                responseData = {Error: 'Failed to update elasticsearch domain configuration.'};
                                console.log([responseData.Error, ':\n', err].join(''));
                                return sendResponse(event, callback, context, responseStatus, responseData);
                            }

                            responseStatus = 'SUCCESS';
                            responseData = {};
                            sendResponse(event, callback, context, responseStatus, responseData);
                        });
                });

        } else if (event.ResourceProperties.customAction === 'federateAccess') {
            let _cognitoHelper = new CognitoHelper();
            let _esHelper = new ElasticsearchHelper();

            _cognitoHelper.addFederationCustomAttributes(event.ResourceProperties.userPoolId,
                function(err, data) {
                    if (err) {
                        responseStatus = 'FAILED';
                        responseData = {Error: 'Failed to add federation custom attributes to the user pool.'};
                        console.log([responseData.Error, ':\n', err].join(''));
                        return sendResponse(event, callback, context, responseStatus, responseData);
                    }

                    _cognitoHelper.createIdentityProvider(event.ResourceProperties.adFsHostname,
                        event.ResourceProperties.userPoolId,
                        function(err, data) {
                            if (err) {
                                responseStatus = 'FAILED';
                                responseData = {Error: 'Failed to create data lake Cognito identity provider'};
                                console.log([responseData.Error, ':\n', err].join(''));
                                return sendResponse(event, callback, context, responseStatus, responseData);
                            }

                            _cognitoHelper.updateUserPoolClient(event.ResourceProperties.adFsHostname,
                                event.ResourceProperties.userPoolId,
                                event.ResourceProperties.userPoolClientId,
                                event.ResourceProperties.consoleUrl,
                                function(err, userPoolInfo) {
                                    if (err) {
                                        responseStatus = 'FAILED';
                                        responseData = {Error: 'Creation of data lake Cognito create identityProvider'};
                                        console.log([responseData.Error, ':\n', err].join(''));
                                        return sendResponse(event, callback, context, responseStatus, responseData);
                                    }

                                    _esHelper.federateKibanaAccess(event.ResourceProperties.userPoolId,
                                        event.ResourceProperties.adFsHostname,
                                        function(err, data) {
                                            if (err) {
                                                responseStatus = 'FAILED';
                                                responseData = {Error: 'Failed to federate kibana access'};
                                                console.log([responseData.Error, ':\n', err].join(''));
                                                return sendResponse(event, callback, context, responseStatus, responseData);
                                            }

                                            responseStatus = 'SUCCESS';
                                            var region = context.invokedFunctionArn.split(":")[3];
                                            responseData = {IdentityProvidersUrl: `https://console.aws.amazon.com/cognito/users/?region=${region}#/pool/${event.ResourceProperties.userPoolId}/federation-identity-providers`};
                                            if (region !== 'us-east-1') {
                                                responseData.IdentityProvidersUrl = responseData.IdentityProvidersUrl.replace('https://console.aws.amazon.com', `https://${region}.console.aws.amazon.com`);
                                            }
                                            sendResponse(event, callback, context, responseStatus, responseData);
                                        });
                                });
                        });
                });

        } else {
            sendResponse(event, callback, context, 'SUCCESS');
        }
    }
};

/**
 * Sends a response to the pre-signed S3 URL
 */
let sendResponse = function(event, callback, context, responseStatus, responseData, physicalResourceId, reason) {
    var region = context.invokedFunctionArn.split(":")[3];
    var cwLogsUrl = `https://console.aws.amazon.com/cloudwatch/home?region=${region}#logEventViewer:group=${context.logGroupName};stream=${context.logStreamName}`;
    const responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: reason || cwLogsUrl,
        PhysicalResourceId: physicalResourceId || event.LogicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData,
    });

    console.log('RESPONSE BODY:\n', responseBody);
    const parsedUrl = url.parse(event.ResponseURL);
    const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: 'PUT',
        headers: {
            'Content-Type': '',
            'Content-Length': responseBody.length,
        }
    };

    const req = https.request(options, (res) => {
        console.log('STATUS:', res.statusCode);
        console.log('HEADERS:', JSON.stringify(res.headers));
        callback(null, 'Successfully sent stack response!');
    });

    req.on('error', (err) => {
        console.log('sendResponse Error:\n', err);
        callback(err);
    });

    req.write(responseBody);
    req.end();
};
