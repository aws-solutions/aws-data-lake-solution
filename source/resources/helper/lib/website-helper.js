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

let AWS = require('aws-sdk');
let s3 = new AWS.S3();
const fs = require('fs');
const _downloadKey = 'data-lake/latest/data-lake-site-manifest.json';
const _downloadLocation = '/tmp/data-lake-site-manifest.json';

/**
 * Helper function to interact with s3 hosted website for data lake cfn custom resource.
 *
 * @class websiteHelper
 */
let websiteHelper = (function() {

    /**
     * @class websiteHelper
     * @constructor
     */
    let websiteHelper = function() {};

    /**
     * Provisions the Amazon Cognito User Pool for the data lake at deployment.
     * @param {string} appUrl - Settings to save in data-lake-settings.
     * @param {createDataLakeUserPool~requestCallback} cb - The callback that handles the response.
     */
    websiteHelper.prototype.copyDataLakeSiteAssets = function(sourceS3Bucket, sourceS3prefix, destS3Bucket,
        userPoolId, userPoolClientId, apigEndpoint, appVersion, cb) {
        console.log(['source bucket:', sourceS3Bucket].join(' '));
        console.log(['source prefix:', sourceS3prefix].join(' '));
        console.log(['destination bucket:', destS3Bucket].join(' '));

        downloadWebisteManifest(sourceS3Bucket, _downloadKey, _downloadLocation, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            fs.readFile(_downloadLocation, 'utf8', function(err, data) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                console.log(data);
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

                            createAppVariables(userPoolId, userPoolClientId, apigEndpoint,
                                appVersion, destS3Bucket,
                                function(err, createResult) {
                                    if (err) {
                                        return cb(err, null);
                                    }

                                    return cb(null, result);
                                });
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
            console.log(data);
            return data;
        } catch (e) {
            // failed to parse
            console.log('Manifest file contains invalid JSON.');
            return null;
        }
    };

    let createAppVariables = function(userPoolId, userPoolClientId, apigEndpoint, appVersion, destS3Bucket, cb) {
        var _content = [
            ['var YOUR_USER_POOL_ID = \'', userPoolId, '\';'].join(''), ['var YOUR_USER_POOL_CLIENT_ID = \'',
                userPoolClientId, '\';'
            ].join(''), ['var APIG_ENDPOINT = \'', apigEndpoint, '\';'].join(''), ['var APP_VERSION = \'',
                appVersion, '\';'
            ].join('')
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

            console.log(data);
            return cb(null, data);
        });

    };

    let uploadFile = function(filelist, index, destS3Bucket, sourceS3prefix, cb) {
        if (filelist.length > index) {
            let params = {
                Bucket: destS3Bucket,
                Key: filelist[index],
                CopySource: [sourceS3prefix, filelist[index]].join('/'),
            };

            s3.copyObject(params, function(err, data) {
                if (err) {
                    return cb(['error copying ', [sourceS3prefix, filelist[index]].join('/'), '\n', err]
                        .join(
                            ''),
                        null);
                }

                console.log([
                    [sourceS3prefix, filelist[index]].join('/'), 'uploaded successfully'
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
     * @param {downloadManifest~requestCallback} cb - The callback that handles the response.
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

    return websiteHelper;

})();

module.exports = websiteHelper;
