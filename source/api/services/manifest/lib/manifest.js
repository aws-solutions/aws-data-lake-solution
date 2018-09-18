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
let shortid = require('shortid');
let _ = require('underscore');
let https = require("https");
let url = require('url');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials

const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const ddbTable = 'data-lake-datasets';
let s3 = new AWS.S3({
    signatureVersion: 'v4'
});

/**
 * Orchestrates importing manifest files for bulk association with a data package and
 * creates a manifest file for each package a user's "cart" when they "check out".
 *
 * @class manifest
 */
let manifest = (function() {

    /**
     * @class manifest
     * @constructor
     */
    let manifest = function() {};

    let _manifesDataset = {};

    /**
     * Process an import manifest file uploaded to a data lake package for bulk
     * association with existing Amazon S3 objects to the package.
     * @param {JSON} event - Request event.
     * @param {import~requestCallback} cb - The callback that handles the response.
     */
    manifest.prototype.import = function(event, cb) {

        _manifesDataset = event.dataset;
        let _file = require('util').format('/tmp/%s', event.dataset.name);

        downloadManifest(event.dataset.s3_bucket, event.dataset.s3_key, _file, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            processManifest(event, _file, cb);
        });

    };

    /**
     * Generates a manifest file for each package in a user's "cart".
     * @param {JSON} event - Request event.
     * @param {generate~requestCallback} cb - The callback that handles the response.
     */
    manifest.prototype.generate = function(event, cb) {

        getConfigInfo(function(err, config) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(config)) {
                if (event.cart.length > 0) {
                    processItemsForAccess(event.cart, 0, event.format,
                        parseInt(config.Item.setting.cartAccessExpiration), config.Item.setting.defaultS3Bucket,
                        config.Item.setting.kmsKeyId,
                        function(err, resp) {
                            if (err) {
                                console.log(err);
                                return cb(err, null);
                            }

                            return cb(null, resp);
                        });
                } else {
                    return cb('No items provided to generate manifest.', null);
                }
            } else {
                cb('No valid configuration data available.', null);
            }

        });

    };

    /**
     * Recursive helper to process each package in a user's "cart" to generate a manifest file that
     * contains an array of signed URLs to each dataset in the package.
     * @param {array} items - Array of packages in a user's cart ready for "check out".
     * @param {integer} index - Index of package in user's cart to process.
     * @param {string} format - Format of the entries in the manifest file [signed urls or bucket/key].
     * @param {integer} expiration - Expiration period of signed URLs for content.
     * @param {string} defaultBucket - Data lake default Amazon S3 bucket to post "cart" manifest files.
     * @param {processItemsForAccess~requestCallback} cb - The callback that handles the response.
     */
    let processItemsForAccess = function(items, index, format, expiration, defaultBucket, kmsKeyId, cb) {
        let _entries = {
            entries: []
        };
        if (items.length > index && items[index].cart_item_status === 'processing') {
            // get the datasets for the packageId
            let params = {
                TableName: ddbTable,
                KeyConditionExpression: 'package_id = :pid',
                ExpressionAttributeValues: {
                    ':pid': items[index].package_id
                }
            };

            docClient.query(params, function(err, resp) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                if (resp.Items.length > 0) {
                    generateAccessContents(resp.Items, 0, format, expiration, function(error, content) {
                        if (error) {
                            console.log(error);
                            return cb(error, null);
                        }

                        _entries.entries = content.entries;
                        if (content.include_path.length > 0) {
                            _entries.include_path = content.include_path;
                        }

                        let _filename = [items[index].item_id, 'json'].join('.');
                        let params = {
                            Bucket: defaultBucket,
                            Key: ['cart', items[index].user_id, _filename].join('/'),
                            ServerSideEncryption: 'aws:kms',
                            SSEKMSKeyId: kmsKeyId,
                            Body: JSON.stringify(_entries)
                        };
                        s3.upload(params, function(err, data) {
                            if (err) {
                                console.log(['error processing', items[index].item_id,
                                    'processed'
                                ].join(' '), err);
                            } else {
                                console.log([params.Key,
                                    'manifest generated and uploaded for delivery..'
                                ].join(' '));
                            }

                            //create a signed url for the manifest file
                            let signedUrlParams = {
                                Bucket: defaultBucket,
                                Key: ['cart', items[index].user_id, _filename].join(
                                    '/'),
                                Expires: expiration
                            };
                            var _url = s3.getSignedUrl('getObject', signedUrlParams);

                            //update the cart item status and the download url
                            items[index].cart_item_status = 'generated';
                            items[index].url = _url;
                            items[index].expires = moment().add(expiration, 's').utc().format();
                            items[index].format = format;
                            items[index].status_details =
                                'manifest succesfully generated';
                            updateCartItemStatus(items[index], function(error, cartitem) {
                                if (error) {
                                    console.log(['error updating cart item',
                                        items[index].item_id,
                                        'status to [generated]'
                                    ].join(' '), error);
                                }

                                processItemsForAccess(items, index + 1, format,
                                    expiration,
                                    defaultBucket, kmsKeyId, cb);
                            });

                        });
                    });
                } else {
                    items[index].cart_item_status = 'unable_to_process';
                    items[index].status_details = 'No dataset objects to process in the package';
                    updateCartItemStatus(items[index], function(error, cartitem) {
                        if (error) {
                            console.log(['error updating cart item', items[index].item_id,
                                'status to [unable_to_process]'
                            ].join(' '), error);
                        }

                        processItemsForAccess(items, index + 1, format, expiration,
                            defaultBucket, kmsKeyId, cb);
                    });

                }
            });

        } else {
            return cb(null, 'Done processing all cart items..');
        }
    };

    /**
     * Recursive helper to process each dataset file in a package to generate the access content for
     * the entry in the manifest file.
     * @param {array} items - Array of datasets in a package.
     * @param {integer} index - Index of dataset in package to process.
     * @param {string} format - Format of the entries in the manifest file [signed urls or bucket/key].
     * @param {integer} expiration - Expiration period of signed URLs for content.
     * @param {generateAccessContents~requestCallback} cb - The callback that handles the response.
     */
    let generateAccessContents = function(items, index, format, expiration, cb) {
        var _content = {
            entries: [],
            include_path: []
        };

        if (index < items.length) {
            if (items[index].content_type === 'include-path') {
                _content.include_path.push({
                    bucket: items[index].s3_bucket,
                    key: items[index].s3_key
                });

                generateAccessContents(items, index + 1, format, expiration, function(err, content) {
                    _content.entries = _content.entries.concat(content.entries);
                    _content.include_path = _content.include_path.concat(content.include_path);
                    return cb(null, _content);
                });

            } else if (items[index].type === 'dataset') {
                checkObjectExists(items[index].s3_bucket, items[index].s3_key, function(err, data) {
                    if (data) {
                        if (format === 'signed-url') {
                            let params = {
                                Bucket: items[index].s3_bucket,
                                Key: items[index].s3_key,
                                Expires: expiration
                            };
                            var _url = s3.getSignedUrl('getObject', params);
                            _content.entries.push({
                                url: _url
                            });
                        } else if (format === 'bucket-key') {
                            _content.entries.push({
                                bucket: items[index].s3_bucket,
                                key: items[index].s3_key
                            });
                        }
                    }

                    generateAccessContents(items, index + 1, format, expiration, function(err, content) {
                        _content.entries = _content.entries.concat(content.entries);
                        _content.include_path = _content.include_path.concat(content.include_path);
                        return cb(null, _content);
                    });
                });

            } else {
                generateAccessContents(items, index + 1, format, expiration, function(err, content) {
                    _content.entries = _content.entries.concat(content.entries);
                    _content.include_path = _content.include_path.concat(content.include_path);
                    return cb(null, _content);
                });
            }

        } else {
            return cb(null, _content);
        }
    };

    /**
     * Updates the status of an item in a user's cart in Amazon DynamoDB [data-lake-cart].
     * @param {JSON} item - Cart item object to update.
     * @param {updateCartItemStatus~requestCallback} cb - The callback that handles the response.
     */
    let updateCartItemStatus = function(item, cb) {
        item.updated_at = moment.utc().format();

        let params = {
            TableName: 'data-lake-cart',
            Item: item
        };

        docClient.put(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, item);
        });

    };

    /**
     * Creates an entry in Amazon DynamoDB [data-lake-datasets] table linking discovered dataset
     * to the appropriate data lake package.
     * @param {JSON} dataset - Dataset object to add to package.
     * @param {addDatasetToPackage~requestCallback} cb - The callback that handles the response.
     */
    let addDatasetToPackage = function(dataset, cb) {
        dataset.dataset_id = shortid.generate();
        dataset.created_at = moment.utc().format();
        dataset.updated_at = dataset.created_at;
        dataset.type = 'dataset';

        let params = {
            TableName: ddbTable,
            Item: dataset
        };

        docClient.put(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, 'New content added to package datasets...');
        });

    };

    /**
     * Updates the status of an import manifest Amazon DynamoDB [data-lake-datasets] table
     * or 'processed' indicating the import is complete.
     * @param {updateManifestDatasetStatus~requestCallback} cb - The callback that handles the response.
     */
    let updateManifestDatasetStatus = function(status, cb) {
        _manifesDataset.updated_at = moment.utc().format();
        _manifesDataset.state_desc = status;

        let params = {
            TableName: ddbTable,
            Item: _manifesDataset
        };

        docClient.put(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, _manifesDataset);
        });

    };

    /**
     * "Imports" (associates) each Amazon S3 object contained in an import manifest file
     * to a pacakge after validating the object is accessible to the data lake.
     * @param {JSON} event - Request event.
     * @param {string} file - File location on local storage of the donwloaded import manifest file.
     * @param {processManifest~requestCallback} cb - The callback that handles the response.
     */
    let processManifest = function(event, file, cb) {
        let packageId = event.dataset.package_id;
        let authorizationToken = event.authorizationToken;
        let fs = require('fs');
        fs.readFile(file, 'utf8', function(err, data) {
            if (err) {
                console.log(err);
                updateManifestDatasetStatus('Unable to read manifest', function(err, manifest) {
                    if (err) {
                        console.log(err);
                        return cb(err, null);
                    }

                    return cb(null, 'Unable to read manifest. Manifest did not import...');
                });
            }

            let _manifest = validateJSON(data);
            if (_manifest) {
                processManifestEntry(event.dataset, _manifest.dataStore, 0, 0, function(err, data) {

                    let stateDesc = (data.errorCounter == 0) ? 'Processed' : `Failed to process ${data.errorCounter} entry(ies)`;
                    updateManifestDatasetStatus(stateDesc, function(err, manifest) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        getConfigInfo(function(err, config) {
                            if (err) {
                                console.log(err);
                                return cb(err, null);
                            }


                            var params = {
                                Bucket: config.Item.setting.defaultS3Bucket,
                                MaxKeys: 1,
                                Prefix: `${packageId}/`
                            };
                            let s3 = new AWS.S3();
                            s3.listObjectsV2(params, function(err, data) {
                                if (err) {
                                    console.log("processManifest Error to list package files: ", err);
                                }

                                let parsedUrl = url.parse(config.Item.setting.apiEndpoint);
                                let options = {
                                    hostname: parsedUrl.hostname,
                                    port: 443,
                                    path: `${parsedUrl.path}/packages/${packageId}/crawler`,
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': '',
                                        'Auth': authorizationToken
                                    }
                                };

                                //-----------------------------------------------------------------
                                // If it is the first file of the package, the S3 must contain only
                                // the manifest file then, by desing, package API must not only
                                // create the AWS Glue crawler but also start it (POST, not PUT).
                                //-----------------------------------------------------------------
                                if (data && data.Contents.length == 1) {
                                    options.method = 'POST';
                                }

                                console.log(options);
                                const req = https.request(options, (res) => {
                                    res.on("end", function () {
                                        console.log('Manifest read and processed...');
                                        return cb(null, 'Manifest read and processed...');
                                    });
                                });
                                req.end();

                            });
                        });
                    });
                });
            } else {
                updateManifestDatasetStatus('Invalid Manifest JSON', function(err, manifest) {
                    if (err) {
                        console.log(err);
                        return cb(err, null);
                    }

                    return cb(null, 'Invalid Manifest JSON. Manifest did not import...');
                });
            }
        });
    };

    /**
     * Recursive helper to process each entry in an import manifest file and associate the object
     * to the data lake package.
     * @param {json} manifest - dataset being processed.
     * @param {array} entries - Array of entries from the import manifest file.
     * @param {integer} index - Index of the entry in the import manifest file.
     * @param {integer} errorCounter - Number of manifest entries that failed.
     * @param {processManifestEntry~requestCallback} cb - The callback that handles the response.
     */
    let processManifestEntry = function(manifest, entries, index, errorCounter, cb) {
        if (index < entries.length) {
            try {
                let includePathData = url.parse(entries[index].includePath);
                if (includePathData.hostname) {
                    includePathData.path = includePathData.path ? includePathData.path : '/';
                    let _dataset = {
                      package_id: manifest.package_id,
                      content_type: "include-path",
                      created_by: _manifesDataset.created_by,
                      s3_bucket: includePathData.hostname,
                      s3_key: includePathData.path,
                      excludePatterns: entries[index].excludePatterns ? entries[index].excludePatterns : [],
                      name: includePathData.hostname + includePathData.path,
                      owner: `imported from ${manifest.name}`,
                      parent_dataset_id: manifest.dataset_id
                    };
                    addDatasetToPackage(_dataset, function(err, data) {
                        if (err) {
                            console.log('Error adding the dataset to the package in ddb', err);
                            errorCounter = errorCounter + 1;
                        }

                        processManifestEntry(manifest, entries, index + 1, errorCounter, cb);
                    });

                } else {
                    console.log('Manifest entry to able to be parsed ', entries[index].includePath);
                    processManifestEntry(manifest, entries, index + 1, errorCounter + 1, cb);
                }

            } catch (ex) {
                console.log('Manifest entry to able to be parsed ', entries[index].includePath);
                processManifestEntry(manifest, entries, index + 1, errorCounter + 1, cb);
            }
        } else {
            return cb(null, {message: 'done processing entries...', errorCounter: errorCounter});
        }
    };

    /**
     * Helper function to download an import manifest file to local storage for processing.
     * @param {string} s3_bucket -  Amazon S3 bucket of the manifest file to download.
     * @param {string} s3_key - Amazon S3 key of the manifest file to download.
     * @param {string} downloadLocation - Local storage location to download the Amazon S3 object.
     * @param {downloadManifest~requestCallback} cb - The callback that handles the response.
     */
    let downloadManifest = function(s3Bucket, s3Key, downloadLocation, cb) {
        let params = {
            Bucket: s3Bucket,
            Key: s3Key
        };

        // check to see if the manifest file exists
        s3.headObject(params, function(err, metadata) {
            if (err && err.code === 'NotFound') {
                // Handle no object on cloud here
                console.log('file doesnt exist');
                return cb('Manifest file was not found.', null);
            } else {
                console.log('file exists');
                let file = require('fs').createWriteStream(downloadLocation);

                s3.getObject(params).
                on('httpData', function(chunk) {
                    file.write(chunk);
                }).
                on('httpDone', function() {
                    file.end();
                    console.log('manifest downloaded for processing...');
                    return cb(null, 'success');
                }).
                send();
            }
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
            if (data.dataStore === undefined || data.dataStore.length == 0) {
                return null;
            } else {
                return data;
            }
        } catch (e) {
            // failed to parse
            console.log('Manifest file contains invalid JSON.');
            return null;
        }
    };

    /**
     * Helper function to validate if an Amazon S3 object exists and have access to it.
     * @param {string} s3_bucket -  Amazon S3 bucket of the manifest file to download.
     * @param {string} s3_key - Amazon S3 key of the manifest file to download.
     * @param {checkObjectExists~requestCallback} cb - The callback that handles the response.
     */
    let checkObjectExists = function(s3Bucket, s3Key, cb) {

        let params = {
            Bucket: s3Bucket,
            Key: s3Key
        };

        s3.headObject(params, function(err, metadata) {
            if (err && err.code === 'NotFound') {
                // Handle no object on cloud here
                console.log('file doesnt exist...');
                return cb(null, false);
            } else if (err) {
                console.log('error check file existence..');
                return cb(null, false);
            } else {
                let _contentType = '';
                if (metadata) {
                    _contentType = metadata.ContentType;
                }

                return cb(null, {
                    exists: true,
                    content_type: _contentType
                });
            }
        });
    };

    /**
     * Helper function to retrieve data lake configuration setting from Amazon DynamoDB [data-lake-settings].
     * @param {getConfigInfo~requestCallback} cb - The callback that handles the response.
     */
    let getConfigInfo = function(cb) {
        console.log('Retrieving app-config information...');
        let params = {
            TableName: 'data-lake-settings',
            Key: {
                setting_id: 'app-config'
            }
        };

        docClient.get(params, function(err, config) {
            if (err) {
                console.log(err);
                return cb('Error retrieving app configuration settings [ddb].',
                    null);
            }

            cb(null, config);
        });
    };

    return manifest;

})();

module.exports = manifest;
