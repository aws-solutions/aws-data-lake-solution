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

'use strict';

let moment = require('moment');
let AWS = require('aws-sdk');
let shortid = require('shortid');
let _ = require('underscore');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials

const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const ddbTable = 'data-lake-datasets';

/**
 * Performs CRUD operations for the data lake package datasets interfacing primiarly with the
 * data-lake-datasets Amazon DynamoDB table.
 *
 * @class dataset
 */
let dataset = (function() {

    /**
     * @class dataset
     * @constructor
     */
    let dataset = function() {};

    /**
     * Retrieves list of datasets associated with a data lake pacakge.
     * @param {integer} packageId - ID of the package to list datasets.
     * @param {getPackageDatsets~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.getPackageDatsets = function(packageId, cb) {

        let params = {
            TableName: ddbTable,
            KeyConditionExpression: 'package_id = :pid',
            ExpressionAttributeValues: {
                ':pid': packageId
            }
        };

        docClient.query(params, function(err, resp) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, resp);
        });

    };

    /**
     * Creates a new dataset in the data lake and attaches it to the appropriate package. Additionally,
     * an upload [POST] signed URL to return in response for uploading object to the data lake
     * Amazon S3 default bucket
     * @param {integer} packageId - ID of the package to attach datasets.
     * @param {JSON} dataset - Dataset object to create.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {createPackageDataset~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.createPackageDataset = function(packageId, dataset, ticket, cb) {

        let params = {
            TableName: 'data-lake-packages',
            Key: {
                package_id: packageId
            }
        };

        docClient.get(params, function(err, pckg) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(pckg)) {
                if (pckg.Item.owner == ticket.userid || ticket.role == 'Admin') {
                    let _dataset = JSON.parse(dataset);
                    _dataset.package_id = packageId;
                    _dataset.dataset_id = shortid.generate();
                    _dataset.created_at = moment.utc().format();
                    _dataset.updated_at = _dataset.created_at;
                    _dataset.created_by = ticket.userid;
                    _dataset.owner = ticket.userid;

                    getConfigInfo(function(err, config) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        if (!_dataset.s3_bucket) {
                            _dataset.s3_bucket = config.Item.setting.defaultS3Bucket;
                        }

                        if (!_dataset.s3_key) {
                            _dataset.s3_key = [packageId, moment().valueOf(), _dataset.name]
                                .join('/');
                        }

                        if (_dataset.type === 'manifest') {
                            _dataset.state_desc = 'Pending Upload';
                        }

                        let params = {
                            TableName: ddbTable,
                            Item: _dataset
                        };

                        docClient.put(params, function(err, data) {
                            if (err) {
                                console.log(err);
                                return cb(err, null);
                            }

                            _dataset.uploadUrl = buildUploadUrl(_dataset.s3_bucket,
                                _dataset.s3_key,
                                _dataset.content_type,
                                config.Item.setting.kmsKeyId);
                            return cb(null, _dataset);
                        });

                    });
                } else {
                    return cb('User does not have access to add a dataset to the requested metadata.',
                        null);
                }

            } else {
                return cb('The data lake package requested to update does not exist.', null);
            }
        });

    };

    /**
     * Initiates import process to associate existing Amazon S3 object from a manifest file
     * attached to a data lake package
     * @param {integer} packageId - ID of the package manifest file attached to.
     * @param {integer} datasetId - ID of dataset manifest to process.
     * @param {string} token - Authorization header token of the request to pass to import process.
     * @param {processPackageDatasetManifest~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.processPackageDatasetManifest = function(packageId, datasetId, token, cb) {

        let params = {
            TableName: ddbTable,
            Key: {
                package_id: packageId,
                dataset_id: datasetId
            }
        };

        docClient.get(params, function(err, dataset) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(dataset)) {
                let _dataset = dataset.Item;
                if (_dataset.type == 'manifest' && _dataset.state_desc == 'Pending Upload') {
                    _dataset.state_desc = 'Processing';

                    let params = {
                        TableName: ddbTable,
                        Item: _dataset
                    };

                    docClient.put(params, function(err, data) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        let _payload = {
                            dataset: _dataset,
                            operation: 'import',
                            authorizationToken: token
                        };

                        // add async invocation to lambda function that processes manifest file
                        let params = {
                            FunctionName: 'data-lake-manifest-service',
                            InvocationType: 'Event',
                            LogType: 'None',
                            Payload: JSON.stringify(_payload)
                        };
                        let lambda = new AWS.Lambda();
                        lambda.invoke(params, function(err, data) {
                            if (err) {
                                console.log(err);
                                return cb(
                                    'Error occured when triggering manifest import.',
                                    null);
                            }

                            return cb(null, _dataset);
                        });
                    });
                } else {
                    return cb({
                        Error: 'Invalid request. Dataset is not a manifest file.'
                    }, null);
                }
            } else {
                return cb({
                    Error: 'The manifest file requested for processing is not found.'
                }, null);
            }

        });

    };

    /**
     * Deletes a dataset from the data lake.
     * @param {integer} packageId - ID of the package the dataset file is attached to.
     * @param {integer} datasetId - ID of dataset to delete.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {deletePackageDataset~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.deletePackageDataset = function(packageId, datasetId, ticket, cb) {

        let params = {
            TableName: 'data-lake-packages',
            Key: {
                package_id: packageId
            }
        };

        docClient.get(params, function(err, pckg) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(pckg)) {
                if (pckg.Item.owner == ticket.userid || ticket.role == 'Admin') {
                    let params = {
                        TableName: ddbTable,
                        Key: {
                            package_id: packageId,
                            dataset_id: datasetId
                        }
                    };

                    docClient.delete(params, function(err, data) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        return cb(null, data);
                    });
                } else {
                    return cb('User does not have access to delete the requested dataset.', null);
                }

            } else {
                return cb('The data lake package requested to update does not exist.', null);
            }
        });

    };

    /**
     * Retrieves a dataset from the data lake.
     * @param {integer} packageId - ID of the package the dataset file is attached to.
     * @param {integer} datasetId - ID of dataset to retrieve.
     * @param {getPackageDataset~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.getPackageDataset = function(packageId, datasetId, cb) {

        let params = {
            TableName: ddbTable,
            Key: {
                package_id: packageId,
                dataset_id: datasetId
            }
        };

        docClient.get(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, data);
        });

    };

    /**
     * Updates a dataset in the data lake.
     * @param {JSON} dataset - Dataset objec to update.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {updatePackageDataset~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.updatePackageDataset = function(dataset, ticket, cb) {

        let params = {
            TableName: 'data-lake-packages',
            Key: {
                package_id: dataset.package_id
            }
        };

        docClient.get(params, function(err, pckg) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            if (!_.isEmpty(pckg)) {
                if (pckg.Item.owner == ticket.userid || ticket.role == 'Admin') {
                    let _dataset = JSON.parse(dataset);

                    let params = {
                        TableName: ddbTable,
                        Item: _dataset
                    };

                    docClient.put(params, function(err, data) {
                        if (err) {
                            console.log(err);
                            return cb(err, null);
                        }

                        return cb(null, _dataset);
                    });
                } else {
                    return cb('User does not have access to delete the requested dataset.', null);
                }

            } else {
                return cb('The data lake package requested to update does not exist.', null);
            }
        });

    };

    /**
     * Helper function to create an Amazon S3 upload [POST] url.
     * @param {string} bucket - Amazon S3 bucket targeted for object upload.
     * @param {string} key - Amazon S3 key targeted for object upload.
     * @param {string} contentType - Content type of the object upload.
     */
    let buildUploadUrl = function(bucket, key, contentType, kmsKeyId) {
        let s3 = new AWS.S3({
            signatureVersion: 'v4'
        });

        let params = {
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
            ServerSideEncryption: 'aws:kms',
            SSEKMSKeyId: kmsKeyId,
            Expires: 900 //15 min
        };
        let url = s3.getSignedUrl('putObject', params);
        console.log('upload url: ', url);
        return url;
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

        docClient.get(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb('Error retrieving app configuration settings [ddb].', null);
            }

            return cb(null, data);
        });
    };

    return dataset;

})();

module.exports = dataset;
