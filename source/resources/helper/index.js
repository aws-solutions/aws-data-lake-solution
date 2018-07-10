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

                    sendResponse(event, callback, context.logStreamName, responseStatus, responseData);
                });
            } else {
                sendResponse(event, callback, context.logStreamName, 'SUCCESS');
            }

        } else if (event.ResourceProperties.customAction === 'cleanDataLakeGlueResources') {
            let _glueHelper = new GlueHelper();
            _glueHelper.cleanDataLakeGlueResources(function(err, data) {
                if (err) {
                    console.log(err);
                }

                sendResponse(event, callback, context.logStreamName, 'SUCCESS');
            });

        } else if (event.ResourceProperties.customAction === 'configureDatalakeBuckets') {
            let _s3Helper = new S3Helper();
            _s3Helper.processDeleteEvent(event.ResourceProperties.dataLakeDefaultBucket,
                event.ResourceProperties.dataLakeWebsiteBucket,
                function(err, data) {
                    if (err) {
                        console.log(err);
                    }

                    sendResponse(event, callback, context.logStreamName, 'SUCCESS');
                });

        } else {
            sendResponse(event, callback, context.logStreamName, 'SUCCESS');
        }
    }

    if (event.RequestType === 'Create') {
        if (event.ResourceProperties.customAction === 'loadAppConfig') {
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
                    responseData = {
                        Error: 'Put on data-lake-settings DyanmoDB table call failed'
                    };
                    console.log([responseData.Error, ':\n', err].join(''));
                } else {
                    responseStatus = 'SUCCESS';
                    responseData = setting;
                }

                sendResponse(event, callback, context.logStreamName, responseStatus, responseData);
            });

        } else if (event.ResourceProperties.customAction === 'createUserPool') {
            let _cognitoHelper = new CognitoHelper();

            _cognitoHelper.createDataLakeUserPool(event.ResourceProperties.appUrl, event.ResourceProperties.adminName,
                event.ResourceProperties.adminEmail,
                function(err, userPoolInfo) {
                    if (err) {
                        responseData = {
                            Error: 'Creation of data lake Cognito User Pool failed'
                        };
                        console.log([responseData.Error, ':\n', err].join(''));
                    } else {
                        responseStatus = 'SUCCESS';
                        responseData = {
                            UserPoolId: userPoolInfo.UserPoolId,
                            UserPoolClientId: userPoolInfo.UserPoolClientId
                        };
                    }

                    sendResponse(event, callback, context.logStreamName, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'configureDatalakeBuckets') {
            let _s3Helper = new S3Helper();
            _s3Helper.configureDataLakeBuckets(event.ResourceProperties.dataLakeDefaultBucket,
                event.ResourceProperties.dataLakeWebsiteBucket,
                function(err, data) {
                    if (err) {
                        responseData = {
                            Error: 'Create data lake buckets failed.'
                        };
                        console.log([responseData.Error, ':\n', err].join(''));
                    } else {
                        responseStatus = 'SUCCESS';
                        responseData = {};
                    }

                    sendResponse(event, callback, context.logStreamName, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'configureWebsite') {
            let _s3Helper = new S3Helper();

            _s3Helper.copyDataLakeSiteAssets(event.ResourceProperties.sourceS3Bucket,
                event.ResourceProperties.sourceS3key, event.ResourceProperties.sourceSiteManifestS3key, event.ResourceProperties.destS3Bucket,
                event.ResourceProperties.userPoolId, event.ResourceProperties.userPoolClientId,
                event.ResourceProperties.apigEndpoint, event.ResourceProperties.appVersion,
                function(err, data) {
                    if (err) {
                        responseData = {
                            Error: 'Copy of data lake website assets failed'
                        };
                        console.log([responseData.Error, ':\n', err].join(''));
                    } else {
                        responseStatus = 'SUCCESS';
                        responseData = {};
                    }

                    sendResponse(event, callback, context.logStreamName, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'createSearchIndex') {
            let _esHelper = new ElasticsearchHelper();

            _esHelper.createSearchIndex(event.ResourceProperties.clusterUrl, event.ResourceProperties.searchIndex,
                function(err, data) {
                    if (err) {
                        responseData = {
                            Error: 'Creating the data lake search index failed'
                        };
                        console.log([responseData.Error, ':\n', err].join(''));
                    } else {
                        responseStatus = 'SUCCESS';
                        responseData = {};
                    }

                    sendResponse(event, callback, context.logStreamName, responseStatus, responseData);
                });

        } else if (event.ResourceProperties.customAction === 'createUuid') {
            responseStatus = 'SUCCESS';
            responseData = {
                UUID: UUID.v4()
            };
            sendResponse(event, callback, context.logStreamName, responseStatus, responseData);

        } else if (event.ResourceProperties.customAction === 'sendMetric') {
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

            if (event.ResourceProperties.anonymousData === 'Yes') {
                _metricsHelper.sendAnonymousMetric(_metric, function(err, data) {
                    if (err) {
                        responseData = {
                            Error: 'Sending anonymous launch metric failed'
                        };
                        console.log([responseData.Error, ':\n', err].join(''));
                    } else {
                        responseStatus = 'SUCCESS';
                        responseData = {};
                    }

                    sendResponse(event, callback, context.logStreamName, responseStatus, responseData);
                });
            } else {
                sendResponse(event, callback, context.logStreamName, 'SUCCESS');
            }

        } else {
            sendResponse(event, callback, context.logStreamName, 'SUCCESS');
        }
    }

};

/**
 * Sends a response to the pre-signed S3 URL
 */
let sendResponse = function(event, callback, logStreamName, responseStatus, responseData) {
    const responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: `See the details in CloudWatch Log Stream: ${logStreamName}`,
        PhysicalResourceId: logStreamName,
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
