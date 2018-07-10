'use strict';

let assert = require('assert');
let AWS = require('aws-sdk-mock');
const cAssert = require('chai').assert;
const expect = require('chai').expect;
var chai = require("chai");
chai.should();
chai.use(require('chai-things'));

let Dataset = require('./dataset.js');

describe('Dataset', function() {
    //=============================================================================================
    // Sample Return Data
    //=============================================================================================
    var packageSamples = {
        valid: {
            Item: {
                updated_at: '1970-01-01T00:00:00Z',
                package_id: 'valid_id',
                created_at: '1970-01-01T00:00:00Z',
                deleted: false,
                owner: 'user_amazon_com',
                description: 'valid sample package',
                name: 'valid'
            }
        },
        deleted: {
            Item: {
                updated_at: '1970-01-01T00:00:00Z',
                package_id: 'valid_id',
                created_at: '1970-01-01T00:00:00Z',
                deleted: true,
                owner: 'user_amazon_com',
                description: 'deleted sample package',
                name: 'deleted'
            }
        },
        other: {
            Item: {
                updated_at: '1970-01-01T00:00:00Z',
                package_id: 'valid_id',
                created_at: '1970-01-01T00:00:00Z',
                deleted: false,
                owner: 'other_amazon_com',
                description: 'Package owned by someone else',
                name: 'other'
            }
        },
        inexistent: {}
    };

    //=============================================================================================
    // beforeEach
    //=============================================================================================
    /**
     * Set a default value for every aws service called by dataset functions.
     */
    beforeEach(function() {
        AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
            if (params.TableName == 'data-lake-packages') {
                if (!params.Key.package_id) {
                    callback(new Error("Invalid package_id"), null);

                } else if (params.Key.package_id === 'valid') {
                    callback(null, packageSamples.valid);

                } else if (params.Key.package_id === 'deleted') {
                    callback(null, packageSamples.deleted);

                } else if (params.Key.package_id === 'other') {
                    callback(null, packageSamples.other);

                } else {
                    callback(null, packageSamples.inexistent);
                }
            }
            else if (params.TableName == 'data-lake-settings') {
                let response = {
                    Item: {
                        setting: {
                            defaultS3Bucket: "Default-S3-Bucket"
                        }
                    }
                };
                callback(null, response);
            }
            else if (params.TableName == 'data-lake-datasets') {
                let response = {
                    Item: {
                        content_type: 'application/json',
                        created_at: '1970-01-01T00:00:00Z',
                        created_by: 'user_amazon_com',
                        dataset_id: 'dataset_id',
                        name: 'filename.json',
                        owner: 'admin_amazon_com',
                        package_id: 'package_id',
                        s3_bucket: 'bucket_name',
                        s3_key: 's3_key/filename.json',
                        type: 'dataset',
                        updated_at: '1970-01-01T00:00:00Z'
                    }
                };
                callback(null, response);
            }
            else {
                callback(new Error("Invalid TableName"), null);
            }
        });

        AWS.mock('DynamoDB.DocumentClient', 'delete', function(params, callback) {
            callback(null, {});
        });

        AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
            callback(null, {});
        });

        AWS.mock('S3', 'deleteObject', function(params, callback) {
            callback(null, {});
        });

        AWS.mock('Glue', 'deleteCrawler', function(params, callback) {
            callback(null, {});
        });

        AWS.mock('Glue', 'deleteDatabase', function(params, callback) {
            callback(null, {});
        });

        AWS.mock('S3', 'listObjectsV2', function(params, callback) {
            let response = {
                IsTruncated: true,
                Contents: [
                    {
                        Key: "sample_folder/sample_file.zip",
                        LastModified: '1970-01-01T00:00:00Z',
                        ETag: '"etag"',
                        Size: 1000,
                        StorageClass: 'STANDARD'
                    }
                ],
                Name: 'bucket_name',
                Prefix: "sample_folder/",
                MaxKeys: 1,
                CommonPrefixes: [],
                KeyCount: 1,
                NextContinuationToken: 'next_token'
            };
            callback(null, response);
        });
    });

    //=============================================================================================
    // afterEarch
    //=============================================================================================
    /**
     * Restore all used aws services state
     */
    afterEach(function() {
        AWS.restore('DynamoDB.DocumentClient');
        AWS.restore('S3');
    });

    /**
     * Auxiliar function that checks authentication and authorization for package access. This set
     * of verifications is common for every service that accesses sensitive/restrited data.
     *
     * All functions here should implement and explicitly check against access control.
     */
    var accessControl = function(params, done, f) {

        if (params) {
            let _ticket = {}

            //-----------------------------------------------------------------------------------------
            // should return error if the session is not valid
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'invalid',
                auth_status_reason: 'User has the invalid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f('valid', params.dataset, _ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the session is not valid!"));
                }
            );

            //-----------------------------------------------------------------------------------------
            // should return error if the package does not exist
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f('inexistent', params.dataset, _ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the package does not exist!"));
                }
            );

            //-----------------------------------------------------------------------------------------
            // should return error if the package ID is invalid
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f(null, params.dataset, _ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the package ID is invalid!"));
                }
            );

            if (params.errorOnDelete) {
                //-------------------------------------------------------------------------------------
                // should return error if the package ID is deleted
                //-------------------------------------------------------------------------------------
                _ticket = {
                    auth_status: 'authorized',
                    auth_status_reason: 'User has the valid role for requested operation',
                    userid: "user_amazon_com",
                    role: "role"
                };
                f('deleted', params.dataset, _ticket,
                    function(err, data) {
                        if (!err) done(new Error("should return error if the package ID is deleted!"));
                    }
                );
            } else {
                //-------------------------------------------------------------------------------------
                // should return ok even if the package ID is deleted
                //-------------------------------------------------------------------------------------
                _ticket = {
                    auth_status: 'authorized',
                    auth_status_reason: 'User has the valid role for requested operation',
                    userid: "user_amazon_com",
                    role: "role"
                };
                f('deleted', params.dataset, _ticket,
                    function(err, data) {
                        if (err) done(err);
                    }
                );
            }

            //-----------------------------------------------------------------------------------------
            // should return error if the user does not have access to the package
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f("other", params.dataset, _ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the user does not have access to the package!"));
                }
            );

            //-----------------------------------------------------------------------------------------
            // should not return error if the package belongs to other user but the current user is admin
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "Admin"
            };
            f("other", params.dataset, _ticket,
                function(err, data) {
                    if (err) done(err);
                }
            );

            //-----------------------------------------------------------------------------------------
            // should not return error if the package exists and the user has access to it
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f('valid', params.dataset, _ticket,
                function(err, data) {
                    if (err) done(new Error("should not return error if the package exists and the user has access to it"));
                }
            );

            done();

        } else {
            done(new Error("ERROR function name passed is not supported"));
        }
    };

    //=============================================================================================
    // deletePackageDataset
    //=============================================================================================
    describe('#deletePackageDataset', function() {

        //-----------------------------------------------------------------------------------------
        // Check Access Control
        //-----------------------------------------------------------------------------------------
        it('Check Access Control', function(done) {
            let _dataset = new Dataset();
            let params = {
                functionName: 'deletePackageDataset',
                dataset: 'datasetId',
                errorOnDelete: false
            }
            accessControl(params, done, _dataset.deletePackageDataset);
        });

        //-----------------------------------------------------------------------------------------
        // Check deletePackageDataset specific cases
        //-----------------------------------------------------------------------------------------
        it('Should delete DDB dataset entry and S3 internal files', function(done) {
            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _dataset = new Dataset();
            _dataset.deletePackageDataset('valid', 'datasetId', _ticket,
                function(err, data) {
                    expect(err).to.be.a('null');
                    expect(data).to.have.property('code');
                    expect(data).to.have.property('message');
                    done();
                }
            );
        });

        it('should return error if AWS S3 API returns any error', function(done) {
            AWS.restore('S3');
            AWS.mock('S3', 'deleteObject', function(params, callback) {
                callback(new Error("General Error"), null);
            });

            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _dataset = new Dataset();
            _dataset.deletePackageDataset('valid', 'datasetId', _ticket,
                function(err, data) {
                    expect(err).to.have.property('code');
                    expect(err).to.have.property('message');
                    expect(data).to.be.a('null');
                    done();
                }
            );
        });

        it('should return error if DynamoDB API returns any error', function(done) {
            AWS.restore('DynamoDB.DocumentClient', 'delete');
            AWS.mock('DynamoDB.DocumentClient', 'delete', function(params, callback) {
                callback(new Error("General Error"), null);
            });

            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _dataset = new Dataset();
            _dataset.deletePackageDataset('valid', 'datasetId', _ticket,
                function(err, data) {
                    expect(err).to.have.property('code');
                    expect(err).to.have.property('message');
                    expect(data).to.be.a('null');
                    done();
                }
            );
        });

    });

    //=============================================================================================
    // createPackageDataset
    //=============================================================================================
    describe('#createPackageDataset', function() {

        //-----------------------------------------------------------------------------------------
        // Check Access Control
        //-----------------------------------------------------------------------------------------
        it('Check Access Control', function(done) {
            let _dataset = new Dataset();
            let params = {
                functionName: 'createPackageDataset',
                errorOnDelete: true,
                dataset: JSON.stringify({
                    content_type: 'application/json',
                    created_at: '1970-01-01T00:00:00Z',
                    created_by: 'user_amazon_com',
                    dataset_id: 'dataset_id',
                    name: 'filename.json',
                    owner: 'admin_amazon_com',
                    package_id: 'package_id',
                    s3_bucket: 'bucket_name',
                    s3_key: 's3_key/filename.json',
                    type: 'dataset',
                    updated_at: '1970-01-01T00:00:00Z'
                })
            }
            accessControl(params, done, _dataset.createPackageDataset);
        });

    });

});

