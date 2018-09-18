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
let s3 = new AWS.S3();
let mime = require('mime-types');
const fs = require('fs');
const _downloadLocation = '/tmp/data-lake-site-manifest.json';

/**
 * Helper function to interact with s3 for data lake cfn custom resource.
 *
 * @class s3Helper
 */
let s3Helper = (function() {

    /**
     * @class s3Helper
     * @constructor
     */
    let s3Helper = function() {};

    /**
     * Configure Data Lake S3 buckets
     *
     * @param {string} defaultBucket - Data Lake main bucket name.
     * @param {string} websiteBucket - Data Lake website bucket name.
     * @param {configureDataLakeBuckets~requestCallback} cb - The callback that handles the response.
     */
    s3Helper.prototype.configureDataLakeBuckets  = function(defaultBucket, websiteBucket, cb) {
        let s3 = new AWS.S3();

        //---------------------------------------------------------------------
        // Create and Configure default bucket
        //---------------------------------------------------------------------
        createBucket(defaultBucket, function(err, data) {
            if (err) {
                return cb(err, null);
            }

            var paramsCors = {
                Bucket: defaultBucket,
                CORSConfiguration: {
                    CORSRules: [{
                        AllowedOrigins: ["*"],
                        AllowedMethods: ["HEAD", "GET", "PUT", "POST"],
                        AllowedHeaders: ["*"]
                    }]
                }
            };
            s3.putBucketCors(paramsCors, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                    return cb({code: 502, message: `Failed to configure ${defaultBucket} bucket cors.`}, null);
                }

                //-------------------------------------------------------------
                // Create and Configure website bucket
                //-------------------------------------------------------------
                createBucket(websiteBucket, function(err, data) {
                    if (err) {
                        return cb(err, null);
                    }

                    var paramsBucketWebsite = {
                        Bucket: websiteBucket,
                        WebsiteConfiguration: {
                            ErrorDocument: {Key: "index.html"},
                            IndexDocument: {Suffix: "index.html"}
                        }
                    };
                    s3.putBucketWebsite(paramsBucketWebsite, function(err, data) {
                        if (err) {
                            console.log(err, err.stack);
                            return cb({code: 502, message: `Failed to configure ${websiteBucket} bucket for static website.`}, null);
                        }

                        return cb(null, {code: 200, message: `Data Lake buckets created.`});
                    });
                });
            });
        });
    };

    /**
     * Configure Data Lake website buckets policy
     *
     * @param {string} websiteBucket - Data Lake website bucket name.
     * @param {string} consoleCanonicalUserId - Canonical user ID for the Console CloudFront distribution origin access identity.
     * @param {configureDataLakeBuckets~requestCallback} cb - The callback that handles the response.
     */
    s3Helper.prototype.configureDatalakeBucketPolicy  = function(websiteBucket, consoleCanonicalUserId, cb) {
        let s3 = new AWS.S3();

        var paramsBucketPolicy = {
            Bucket: websiteBucket,
            Policy: JSON.stringify({
                Version: "2008-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: {CanonicalUser: consoleCanonicalUserId},
                        Action: "s3:GetObject",
                        Resource: `arn:aws:s3:::${websiteBucket}/*`
                    }
                ]
            })
        };
        s3.putBucketPolicy(paramsBucketPolicy, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                return cb({code: 502, message: `Failed to configure ${websiteBucket} bucket policy.`}, null);
            }

            return cb(null, {code: 200, message: `Buckets policy updated.`});
        });
    };

    /**
     * Process delete event for Data Lake S3 buckets.
     *
     * @param {string} defaultBucket - Data Lake main bucket name.
     * @param {string} websiteBucket - Data Lake website bucket name.
     * @param {processDeleteEvent~requestCallback} cb - The callback that handles the response.
     */
    s3Helper.prototype.processDeleteEvent  = function(defaultBucket, websiteBucket, cb) {
        //---------------------------------------------------------------------
        // Default bucket: Retain (do nothing)
        //---------------------------------------------------------------------

        //---------------------------------------------------------------------
        // Website bucket: clean and delte bucket
        //---------------------------------------------------------------------
        cleanBucket(websiteBucket, function(err, data) {
            if (err) {
                console.log(err, err.stack);
            }

            let s3 = new AWS.S3();
            let params = {
                Bucket: websiteBucket
            };
            s3.deleteBucket(params, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                }

                return cb(null, {code: 200, message: `Delete event processed.`});
            });
        });
    };

    /**
     * Create bucked (or update cors configuration of existing one)
     *
     * @param {string} bucketName - Bucket Name.
     * @param {createBucket~requestCallback} cb - The callback that handles the response.
     */
    let createBucket = function(bucketName, cb) {
        let s3 = new AWS.S3();
        let paramsCreate = {
            Bucket: bucketName
        };
        if (process.env.AWS_REGION !== "us-east-1") {
            paramsCreate.CreateBucketConfiguration = {LocationConstraint: process.env.AWS_REGION};
        }
        s3.createBucket(paramsCreate, function(err, data) {
            if (err && err.code != 'BucketAlreadyOwnedByYou' && err.code != 'BucketAlreadyExists') {
                console.log(err, err.stack);
            }

            let paramsWait = {
                Bucket: bucketName
            };
            s3.waitFor('bucketExists', paramsWait, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                    return cb({code: 502, message: `Failed to create bucket ${bucketName}.`}, null);
                }

                return cb(null, {code: 200, message: `Bucket ${bucketName} created.`});
            });
        });
    };

    /**
     * Clean S3 bucked.
     */
    let cleanBucket = function(bucketName, cb) {
        let s3 = new AWS.S3();
        const listParams = {
            Bucket: bucketName
        };

        s3.listObjectsV2(listParams, function(err, listData) {
            if (err) {
                console.log(err, err.stack);
            }

            if (listData && listData.Contents.length > 0) {
                const deleteParams = {
                    Bucket: bucketName,
                    Delete: { Objects: listData.Contents.map(obj => { return {Key: obj['Key']}; }) }
                };
                s3.deleteObjects(deleteParams, function(err, data) {
                    if (err) {
                        console.log(err, err.stack);
                    }
                    cleanBucket(bucketName, cb);
                });

            } else {
                cb(null, {code: 200, message: `${bucketName} cleaned.`});
            }
        });
    };

    /**
     * Provisions the Amazon Cognito User Pool for the data lake at deployment.
     * @param {string} appUrl - Settings to save in data-lake-settings.
     * @param {copyDataLakeSiteAssets~requestCallback} cb - The callback that handles the response.
     */
    s3Helper.prototype.copyDataLakeSiteAssets = function(sourceS3Bucket, sourceS3prefix, sourceSiteManifestS3prefix,
        destS3Bucket, cb) {
        console.log(['source bucket:', sourceS3Bucket].join(' '));
        console.log(['source prefix:', sourceS3prefix].join(' '));
        console.log(['source site manifest prefix:', sourceSiteManifestS3prefix].join(' '));
        console.log(['destination bucket:', destS3Bucket].join(' '));

        downloadWebisteManifest(sourceS3Bucket, sourceSiteManifestS3prefix, _downloadLocation, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            fs.readFile(_downloadLocation, 'utf8', function(err, data) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                let _manifest = validateJSON(data);

                if (!_manifest) {
                    return cb('Unable to validate downloaded manifest file JSON', null);
                } else {
                    uploadFile(_manifest.files, 0, destS3Bucket, [sourceS3Bucket, sourceS3prefix]
                        .join('/'),
                        function(err, result) {
                            if (err) {
                                return cb(err, null);
                            }

                            console.log(result);
                            return cb(null, result);
                        });
                }

            });

        });

    };

    /**
     * Helper function to validate the JSON structure of contents of an import manifest file.
     * @param {string} body -  JSON object stringify-ed.
     * @returns {JSON} - The JSON parsed string or null if string parsing failed
     */
    let validateJSON = function(body) {
        try {
            let data = JSON.parse(body);
            return data;
        } catch (e) {
            // failed to parse
            console.log('Manifest file contains invalid JSON.');
            return null;
        }
    };

    s3Helper.prototype.createAppVariables = function(userPoolId, userPoolClientId, apigEndpoint, appVersion, destS3Bucket, federatedLogin, loginUrl, logoutUrl, cb) {
        var _content = [
            ['var YOUR_USER_POOL_ID = \'', userPoolId, '\';'].join(''),
            ['var YOUR_USER_POOL_CLIENT_ID = \'', userPoolClientId, '\';'].join(''),
            ['var APIG_ENDPOINT = \'', apigEndpoint, '\';'].join(''),
            ['var APP_VERSION = \'', appVersion, '\';'].join(''),
            ['var FEDERATED_LOGIN = ', federatedLogin, ';'].join(''),
            ['var LOGIN_URL = \'', loginUrl, '\';'].join(''),
            ['var LOGOUT_URL = \'', logoutUrl, '\';'].join('')
        ].join('\n');

        let params = {
            Bucket: destS3Bucket,
            Key: 'lib/app-variables.js',
            Body: _content
        };

        s3.putObject(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb('error creating app-variables.js file for data lake website', null);
            }

            return cb(null, data);
        });

    };

    let uploadFile = function(filelist, index, destS3Bucket, sourceS3prefix, cb) {
        if (filelist.length > index) {
            let contentType = mime.lookup(filelist[index]);
            let params = {
                Bucket: destS3Bucket,
                Key: filelist[index],
                CopySource: [sourceS3prefix, filelist[index]].join('/'),
                ContentType: contentType,
                MetadataDirective: "REPLACE"
            };

            s3.copyObject(params, function(err, data) {
                if (err) {
                    return cb(['error copying ', [sourceS3prefix, filelist[index]].join('/'), '\n', err]
                        .join(
                            ''),
                        null);
                }

                console.log([
                    [sourceS3prefix, filelist[index]].join('/'), contentType, 'uploaded successfully'
                ].join(' '));
                let _next = index + 1;
                uploadFile(filelist, _next, destS3Bucket, sourceS3prefix, function(err, resp) {
                    if (err) {
                        return cb(err, null);
                    }

                    cb(null, resp);
                });
            });
        } else {
            cb(null, [index, 'files copied'].join(' '));
        }

    };

    /**
     * Helper function to download the data lake website archive to local storage for processing.
     * @param {string} s3_bucket -  Amazon S3 bucket of the website archive to download.
     * @param {string} s3_key - Amazon S3 key of the website archive to download.
     * @param {string} downloadLocation - Local storage location to download the Amazon S3 object.
     * @param {downloadWebisteManifest~requestCallback} cb - The callback that handles the response.
     */
    let downloadWebisteManifest = function(s3Bucket, s3Key, downloadLocation, cb) {
        let params = {
            Bucket: s3Bucket,
            Key: s3Key
        };

        console.log(params);

        // check to see if the manifest file exists
        s3.headObject(params, function(err, metadata) {
            if (err) {
                console.log(err);
            }

            if (err && err.code === 'NotFound') {
                // Handle no object on cloud here
                console.log('file doesnt exist');
                return cb('Manifest file was not found.', null);
            } else {
                console.log('file exists');
                console.log(metadata);
                let file = require('fs').createWriteStream(downloadLocation);

                s3.getObject(params).
                on('httpData', function(chunk) {
                    file.write(chunk);
                }).
                on('httpDone', function() {
                    file.end();
                    console.log('website manifest downloaded for processing...');
                    return cb(null, 'success');
                }).
                send();
            }
        });
    };

    return s3Helper;

})();

module.exports = s3Helper;
