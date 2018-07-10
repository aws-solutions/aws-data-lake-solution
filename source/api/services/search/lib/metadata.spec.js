'use strict';

let assert = require('assert');
let AWS = require('aws-sdk-mock');
let es = require('elasticsearch');
const cAssert = require('chai').assert;
const expect = require('chai').expect;

let Metadata = require('../../search/lib/metadata.js');

describe('Metadata', function() {
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

    describe('#search', function() {
        beforeEach(function() {
            process.env.USER_POOL_ID = "";

            let estub = this.sandbox.stub(es, 'Client').value(function(params, cb) {
                return {
                    search: function(params, cb) {
                        return new Promise(function(fulfill, reject) {
                            if (params.index === 'test-index') {
                                if (params.body.query.bool.must.query_string.query === 'test') {
                                    fulfill({
                                        hits: {
                                            hits: [{
                                                _source: 'test result'
                                            }]
                                        }
                                    });
                                } else {
                                    fulfill({
                                        hits: {
                                            hits: []
                                        }
                                    });
                                }
                            } else {
                                reject({
                                    message: 'Error: Invalid index provided.'
                                });
                            }
                        });
                    }
                };
            });

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
                                defaultS3Bucket: "Default-S3-Bucket",
                                esurl: 'cluster.test',
                                esindex: 'test-index',
                                searchResultsLimit: 100
                            }
                        }
                    };
                    callback(null, response);
                }
                else {
                    callback(new Error("Invalid TableName"), null);
                }
            });


            AWS.mock('CognitoIdentityServiceProvider', 'adminListGroupsForUser', function(params, callback) {
                callback(null, {Groups:[{GroupName: "Group 01"}]});
            });

        });

        afterEach(function() {
            AWS.restore('DynamoDB.DocumentClient');
            AWS.restore('CognitoIdentityServiceProvider');
        });

        it('should return error with no valid configuration', function(done) {
            AWS.restore('DynamoDB.DocumentClient');
            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, {});
            });
            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };

            let _metadata = new Metadata();
            _metadata.search('test', _ticket, function(err, data) {
                if (err) {
                    expect(err).to.deep.equal({
                        error: {
                            message: 'No valid app configuration data available.'
                        }
                    }, 'Correct error returned for invalid configuration data');
                    done();
                } else {
                    done('error was not returned.');
                }
            });
        });

        it('should return results with valid configuration and terms', function(done) {
            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };

            let _metadata = new Metadata();
            _metadata.search('test', _ticket, function(err, data) {
                if (err) done(err);
                else {
                    expect(data.Items).to.not.be.empty;
                    done();
                }
            });
        });

        it('should return no results with valid configuration and term not found', function(done) {
            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };

            let _metadata = new Metadata();
            _metadata.search('invalid,term', _ticket, function(err, data) {
                if (err) done(err);
                else {
                    expect(data.Items).to.be.empty;
                    done();
                }
            });
        });

        it('should return an error with an invalid configuration', function(done) {
            AWS.restore('DynamoDB.DocumentClient');
            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                if (params.TableName == 'data-lake-packages') {
                    callback(null, packageSamples.valid);
                }
                else if (params.TableName == 'data-lake-settings') {
                    let response = {
                        Item: {
                            setting: {
                                defaultS3Bucket: "Default-S3-Bucket",
                                esurl: 'cluster.test',
                                esindex: 'invalid-index',
                                searchResultsLimit: 100
                            }
                        }
                    };
                    callback(null, response);
                }
                else {
                    callback(new Error("Invalid TableName"), null);
                }
            });

            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };

            let _metadata = new Metadata();
            _metadata.search('test', _ticket, function(err, data) {
                if (err) {
                    expect(err.message).to.equal('Error: Invalid index provided.');
                    done();
                } else {
                    done('An error was not thrown with invalid configuration');
                }
            });
        });

    });
});
