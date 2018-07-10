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

let moment = require('moment');
let AWS = require('aws-sdk');
let shortid = require('shortid');
let _ = require('underscore');
let AccessValidator = require('access-validator');
let ContentPackage = require('./content-package.js');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials

const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const ddbTable = 'data-lake-datasets';

/**
 * Performs CRUD operations for the data lake package datasets interfacing primiarly with the
 * data-lake-datasets Amazon DynamoDB table.
 *
 * @class dataset
 */
let dataset = (function() {

    let accessValidator = new AccessValidator();

    /**
     * @class dataset
     * @constructor
     */
    let dataset = function() {};

    /**
     * Retrieves list of datasets associated with a data lake package.
     * @param {integer} packageId - ID of the package to list datasets.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {getPackageDatasets~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.getPackageDatasets = function(packageId, ticket, cb) {

        accessValidator.validate(packageId, ticket, 'dataset:getPackageDatasets', function(err, data) {
            if (err) {
                return cb(err, null);
            }

            let params = {
                TableName: ddbTable,
                KeyConditionExpression: 'package_id = :pid',
                ExpressionAttributeValues: {
                    ':pid': packageId
                }
            };

            let docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
            docClient.query(params, function(err, resp) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: `Failed to retrieve the list of datasets associated with data lake package ${packageId}.`}, null);
                }

                return cb(null, resp);
            });
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

        accessValidator.validate(packageId, ticket, 'dataset:createPackageDataset', function(err, data) {
            if (err) {
                return cb(err, null);
            }

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

                let docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
                docClient.put(params, function(err, data) {
                    if (err) {
                        console.log(err);
                        return cb({code: 502, message: `Failed to creates a new dataset in the data lake and attaches it to package ${packageId}.`}, null);
                    }

                    _dataset.uploadUrl = buildUploadUrl(_dataset.s3_bucket,
                        _dataset.s3_key,
                        _dataset.content_type,
                        config.Item.setting.kmsKeyId);

                    if (_dataset.type === 'manifest') {
                        return cb(null, _dataset);
                    }

                    var params = {
                        Bucket: config.Item.setting.defaultS3Bucket,
                        MaxKeys: 1,
                        Prefix: `${packageId}/`
                    };
                    let s3 = new AWS.S3();
                    s3.listObjectsV2(params, function(err, data) {
                        if (err) {
                            console.log("startCrawler Error to list package files: ", err);
                        }

                        if (data && data.Contents.length == 0) {
                            let _contentPackage = new ContentPackage();
                            _contentPackage.startCrawler(packageId, ticket,
                                function(err, data) {
                                    if (err) {
                                        console.log("startCrawler Error start crawler: ", err);
                                    }

                                    return cb(null, _dataset);
                                }
                            );
                        }
                        else {
                            return cb(null, _dataset);
                        }
                    });
                });
            });
        });
    };

    /**
     * Initiates import process to associate existing Amazon S3 object from a manifest file
     * attached to a data lake package
     * @param {string} packageId - ID of the package manifest file attached to.
     * @param {string} datasetId - ID of dataset manifest to process.
     * @param {string} token - Authorization header token of the request to pass to import process.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {processPackageDatasetManifest~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.processPackageDatasetManifest = function(packageId, datasetId, token, ticket, cb) {

        accessValidator.validate(packageId, ticket, 'dataset:processPackageDatasetManifest', function(err, data) {
            if (err) {
                return cb(err, null);
            }

            let params = {
                TableName: ddbTable,
                Key: {
                    package_id: packageId,
                    dataset_id: datasetId
                }
            };

            let docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
            docClient.get(params, function(err, dataset) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to validade if the user permission."}, null);
                }

                if (_.isEmpty(dataset)) {
                    let message;
                    return cb({code: 404, message: 'The manifest file requested for processing is not found.'}, null);
                }

                let _dataset = dataset.Item;
                if (_dataset.type != 'manifest' || _dataset.state_desc != 'Pending Upload') {
                    return cb({code: 400, message: 'Invalid request. Dataset is not a manifest file or is in ivalid state.'},null);
                }

                _dataset.state_desc = 'Processing';

                let params = {
                    TableName: ddbTable,
                    Item: _dataset
                };

                docClient.put(params, function(err, data) {
                    if (err) {
                        console.log(err);
                        return cb({code: 502, message: "Failed to save manifest."}, null);
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
                            return cb({code: 502, message: "Error occured when triggering manifest import."}, null);
                        }

                        return cb(null, _dataset);
                    });
                });
            });
        });

    };

    /**
     * Deletes a dataset from the data lake.
     * @param {string} packageId - ID of the package the dataset file is attached to.
     * @param {string} datasetId - ID of dataset to delete.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {deletePackageDataset~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.deletePackageDataset = function(packageId, datasetId, ticket, cb) {

        accessValidator.validate(packageId, ticket, 'dataset:deletePackageDataset', function(err, data) {
            if (err) {
                return cb(err, null);
            }

            getConfigInfo(function(err, config) {
                if (err) {
                    console.log(err);
                    return cb(err, null);
                }

                getDatasetDetails(packageId, datasetId)
                    .then( function(dataseResult) {
                        Promise.all([
                            deleteDatasetDbdEntries(dataseResult.Item),
                            deleteDatasetS3Entry(dataseResult.Item)
                        ]).then(function() {
                            return chekAndDeleteGlueReferences(dataseResult.Item, packageId, config, ticket);
                        });
                    })
                    .then(function() {
                        return cb(null, {code: 200, message: `Dataset ${datasetId} deleted from the data lake package ${packageId}.`});
                    })
                    .catch(function(err) {
                        return cb({code: 502, message: `Failed to delete dataset ${datasetId} from the data lake package ${packageId}.`}, null);
                    });
            });
        });

    };

    function chekAndDeleteGlueReferences(dataset, packageId, config, ticket) {
        var params = {
            Bucket: config.Item.setting.defaultS3Bucket,
            MaxKeys: 1,
            Prefix: packageId + '/'
        };
        let s3 = new AWS.S3();
        s3.listObjectsV2(params, function(err, data) {
            if (data && data.Contents.length == 0) {
                let _contentPackage = new ContentPackage();
                _contentPackage.deleteGlueReferences(packageId, null, ticket,
                    function(err, data) {
                        return new Promise((resolve) => resolve({message: `Delete request sent to AWS Glue. Package ${packageId}.`}));
                    }
                );
            }

            else if (dataset.type === 'manifest' || dataset.content_type === 'include-path') {
                let _contentPackage = new ContentPackage();
                _contentPackage.updateOrCreateCrawler(packageId, ticket, function(err, data) {
                    return new Promise((resolve) => resolve({message: `Update request sent to AWS Glue. Package ${packageId}.`}));
                });

            } else {
                return new Promise((resolve) => resolve({message: `Nothing need to be changed in AWS Glue. Package ${packageId}.`}));
            }
        });
    }

    function getDatasetDetails(packageId, datasetId) {
        let params = {
            TableName: ddbTable,
            Key: {
                package_id: packageId,
                dataset_id: datasetId
            }
        };
        let docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
        return docClient.get(params).promise();
    }

    function deleteDatasetDbdEntries(dataset) {
        let docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
        let datasetParam = {
            TableName: ddbTable,
            Key: {
                package_id: dataset.package_id,
                dataset_id: dataset.dataset_id
            }
        };

        if (dataset.type === 'manifest') {
            let childDatasetsParam = {
                TableName: ddbTable,
                KeyConditionExpression: 'package_id = :pid',
                ExpressionAttributeValues: {
                    ':pid': dataset.package_id
                }
            };

            Promise.all([
                docClient.get(datasetParam).promise(),
                docClient.query(childDatasetsParam).promise()])

            .then(function(values) {
                let toDelete = values[1].Items.filter((item) => {
                    return (item.parent_dataset_id === dataset.dataset_id)
                })
                toDelete.push(values[0].Item);
                return Promise.all(
                    toDelete.map(function(item) {
                        let params = {
                            TableName: ddbTable,
                            Key: {
                                package_id: item.package_id,
                                dataset_id: item.dataset_id
                            }
                        };
                        return docClient.delete(params).promise();
                    })
                );
            });
        } else {
            return docClient.delete(datasetParam).promise();
        }
    }

    function deleteDatasetS3Entry(dataset) {
        if (dataset.content_type != 'include-path' && !dataset.owner.toLowerCase().startsWith('imported from')) {
            let params = {
                Bucket: dataset.s3_bucket,
                Key: dataset.s3_key
            };
            let s3 = new AWS.S3();
            return s3.deleteObject(params).promise();
        }
        else {
            return new Promise((resolve) => resolve({message: 'Do nothing for maniefst file'}));
        }
    }

    /**
     * Retrieves a dataset from the data lake.
     * @param {string} packageId - ID of the package the dataset file is attached to.
     * @param {string} datasetId - ID of dataset to retrieve.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {getPackageDataset~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.getPackageDataset = function(packageId, datasetId, ticket, cb) {

        accessValidator.validate(packageId, ticket, 'dataset:getPackageDataset', function(err, data) {
            if (err) {
                return cb(err, null);
            }

            getDatasetDetails(packageId, datasetId)
                .then((dataseResult) => cb(null, dataseResult))
                .catch(cb({code: 502, message: `Failed to retrieve the dataset ${datasetId} from package ${packageId}.`}, null))
        });

    };

    /**
     * Updates a dataset in the data lake.
     * @param {JSON} dataset - Dataset objec to update.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {updatePackageDataset~requestCallback} cb - The callback that handles the response.
     */
    dataset.prototype.updatePackageDataset = function(dataset, ticket, cb) {

        accessValidator.validate(packageId, ticket, 'dataset:updatePackageDataset', function(err, data) {
            if (err) {
                return cb(err, null);
            }

            let _dataset = JSON.parse(dataset);

            let params = {
                TableName: ddbTable,
                Item: _dataset
            };

            docClient.put(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to update a dataset in the data lake."}, null);
                }

                return cb(null, _dataset);
            });
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

        let docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
        if (typeof cb !== 'undefined') {
            docClient.get(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to retrieving app configuration settings [ddb]."}, null);
                }

                return cb(null, data);
            });
        } else {
            return docClient.get(params).promise();
        }

    };

    return dataset;

})();

module.exports = dataset;
