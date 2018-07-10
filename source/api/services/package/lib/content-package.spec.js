'use strict';

let assert = require('assert');
let AWS = require('aws-sdk-mock');
const cAssert = require('chai').assert;
const expect = require('chai').expect;
var chai = require("chai");
chai.should();
chai.use(require('chai-things'));

let ContentPackage = require('./content-package.js');

describe('ContentPackage', function() {
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

    var listGlueTables = {
       TableList: [{
               Name: 'table_name_01',
               Owner: 'owner',
               CreateTime: '1970-01-01T00:00:00Z',
               UpdateTime: '1970-01-01T00:00:00Z',
               LastAccessTime: '1970-01-01T00:00:00Z',
               Retention: 0,
               StorageDescriptor: [Object],
               PartitionKeys: [],
               TableType: 'EXTERNAL_TABLE',
               Parameters: [Object],
               CreatedBy: 'CreatedBy'
           },
           {
               Name: 'table_name_02',
               Owner: 'owner',
               CreateTime: '1970-01-01T00:00:00Z',
               UpdateTime: '1970-01-01T00:00:00Z',
               LastAccessTime: '1970-01-01T00:00:00Z',
               Retention: 0,
               StorageDescriptor: [Object],
               PartitionKeys: [],
               TableType: 'EXTERNAL_TABLE',
               Parameters: [Object],
               CreatedBy: 'CreatedBy'
           }
       ]
    };

    //=============================================================================================
    // beforeEach
    //=============================================================================================
    /**
     * Set a default value for every aws service called by content-package functions.
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
            else {
                callback(new Error("Invalid TableName"), null);
            }
        });

        AWS.mock('Glue', 'getCrawler', function(params, callback) {
            let result = {
                Crawler: {
                    Name: 'Crawler Name',
                    Role: 'role-name',
                    Targets: {
                        S3Targets: [Object],
                        JdbcTargets: []
                    },
                    DatabaseName: 'package_id',
                    Description: 'Glue crawler that creates tables based on S3 DataLake resources',
                    Classifiers: [],
                    SchemaChangePolicy: {
                        UpdateBehavior: 'UPDATE_IN_DATABASE',
                        DeleteBehavior: 'DEPRECATE_IN_DATABASE'
                    },
                    State: 'READY',
                    TablePrefix: 'package_name',
                    Schedule: {
                        ScheduleExpression: 'cron(0 0 * * ? *)',
                        State: 'SCHEDULED'
                    },
                    CrawlElapsedTime: '0',
                    CreationTime: '1970-01-01T00:00:00Z',
                    LastUpdated: '1970-01-01T00:00:00Z',
                    LastCrawl: {
                        Status: 'SUCCEEDED',
                        LogGroup: '/aws-glue/crawlers',
                        LogStream: 'Sample Crawler',
                        MessagePrefix: '7fd1bc96-5fc5-4305-94fe-3b235fb1e7f1',
                        StartTime: '1970-01-01T00:00:00Z'
                    },
                    Version: '2'
                }
            };
            callback(null, result);
        });

        AWS.mock('Glue', 'getTables', function(params, callback) {
            callback(null, listGlueTables);
        });

        AWS.mock('Glue', 'startCrawler', function(params, callback) {
            callback(null, {});
        });

        AWS.mock('Glue', 'createCrawler', function(params, callback) {
            callback(null, {});
        });

        AWS.mock('Athena', 'startQueryExecution', function(params, callback) {
            callback(null, { QueryExecutionId: 'QueryExecutionId'});
        });
    });

    //=============================================================================================
    // afterEarch
    //=============================================================================================
    /**
     * Restore all used aws services state
     */
    afterEach(function() {
        AWS.restore('Athena');
        AWS.restore('Glue');
        AWS.restore('DynamoDB.DocumentClient');
    });

    /**
     * Auxiliar function that checks authentication and authorization for package access. This set
     * of verifications is common for every service that accesses sensitive/restrited data.
     *
     * All functions here should implement and explicitly check against access control.
     */
    var accessControl = function(params, done, f) {

        if (!params) {
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
            f('valid', _ticket,
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
            f('inexistent', _ticket,
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
            f(null, _ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the package ID is invalid!"));
                }
            );

            //-----------------------------------------------------------------------------------------
            // should return error if the package ID is deleted
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f('deleted', _ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the package ID is deleted!"));
                }
            );

            //-----------------------------------------------------------------------------------------
            // should return error if the user does not have access to the package
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f("other", _ticket,
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
            f("other", _ticket,
                function(err, data) {
                    if (err) done(new Error("should not return error if the package belongs to other user but the current user is admin"));
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
            f('valid', _ticket,
                function(err, data) {
                    if (err) done(new Error("should not return error if the package exists and the user has access to it"));
                }
            );

            done();
        }

        else if (params.functionName == 'viewTableData') {
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
            f('valid', params.tableName, _ticket,
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
            f('inexistent', params.tableName, _ticket,
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
            f(null, params.tableName, _ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the package ID is invalid!"));
                }
            );

            //-----------------------------------------------------------------------------------------
            // should return error if the package ID is deleted
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f('deleted', params.tableName, _ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the package ID is deleted!"));
                }
            );

            //-----------------------------------------------------------------------------------------
            // should return error if the user does not have access to the package
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f("other", params.tableName, _ticket,
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
            f("other", params.tableName, _ticket,
                function(err, data) {
                    if (err) done(new Error("should not return error if the package belongs to other user but the current user is admin"));
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
            f('valid', params.tableName, _ticket,
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
    // getCrawler
    //=============================================================================================
    describe('#getCrawler', function() {

        //-----------------------------------------------------------------------------------------
        // Check Access Control
        //-----------------------------------------------------------------------------------------
        it('Check Access Control', function(done) {
            let _contentPackage = new ContentPackage();
            accessControl(null, done, _contentPackage.getCrawler);
        });

        //-----------------------------------------------------------------------------------------
        // Check getCrawler specific cases
        //-----------------------------------------------------------------------------------------
        it('should return all information if the package exists and the user has access to it', function(done) {
            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };

            let _contentPackage = new ContentPackage();
            _contentPackage.getCrawler('valid', _ticket,
                function(err, data) {
                    expect(err).to.be.a('null');
                    expect(data).to.have.property('name');
                    expect(data).to.have.property('status');
                    expect(data).to.have.property('lastRun');
                    done();
                }
            );
        });

        it('should return error if AWS Glue returns any error to get or create a crawler', function(done) {
            AWS.restore('Glue');
            AWS.mock('Glue', 'getCrawler', function(params, callback) {
                callback(new Error("General Error"), null);
            });

            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _contentPackage = new ContentPackage();
            _contentPackage.getCrawler('valid', _ticket,
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
    // getTables
    //=============================================================================================
    describe('#getTables', function() {

        //-----------------------------------------------------------------------------------------
        // Check Access Control
        //-----------------------------------------------------------------------------------------
        it('Check Access Control', function(done) {
            let _contentPackage = new ContentPackage();
            accessControl(null, done, _contentPackage.getTables);
        });

        //-----------------------------------------------------------------------------------------
        // Check getTables specific cases
        //-----------------------------------------------------------------------------------------
        it('should return all information if the package exists and the user has access to it', function(done) {
            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _contentPackage = new ContentPackage();
            _contentPackage.getTables('valid', _ticket,
                function(err, data) {
                    expect(err).to.be.a('null');
                    expect(data).to.have.deep.property('tables');
                    data.tables.should.all.have.property('DatabaseName');
                    data.tables.should.all.have.property('TableName');
                    data.tables.should.all.have.property('ViewTableUrl');
                    data.tables.should.all.have.property('Classification');
                    data.tables.should.all.have.property('LastUpdate');
                    done();
                }
            );
        });

        it('should return error if AWS Glue returns any error to list tables', function(done) {
            AWS.restore('Glue');
            AWS.mock('Glue', 'getTables', function(params, callback) {
                callback(new Error("General Error"), null);
            });

            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _contentPackage = new ContentPackage();
            _contentPackage.getTables('valid', _ticket,
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
    // viewTableData
    //=============================================================================================
    describe('#viewTableData', function() {

        //-----------------------------------------------------------------------------------------
        // Check Access Control
        //-----------------------------------------------------------------------------------------
        it('Check Access Control', function(done) {
            let params = {functionName: "viewTableData", tableName: "table_name"};
            let _contentPackage = new ContentPackage();
            accessControl(params, done, _contentPackage.viewTableData);
        });

        //-----------------------------------------------------------------------------------------
        // Check viewTableData specific cases
        //-----------------------------------------------------------------------------------------
        it('should return external link if the package and table exist and the user has access to it', function(done) {
            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _contentPackage = new ContentPackage();
            _contentPackage.viewTableData('valid', "table_name", _ticket,
                function(err, data) {
                    expect(err).to.be.a('null');
                    expect(data).to.have.property('link');
                    done();
                }
            );
        });

        it('should return error if Amazon Athena returns any error to query data on that table', function(done) {
            AWS.restore('Athena');
            AWS.mock('Athena', 'startQueryExecution', function(params, callback) {
                callback(new Error("General Error"), null);
            });

            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _contentPackage = new ContentPackage();
            _contentPackage.viewTableData('valid', "table_name", _ticket,
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
    // startCrawler
    //=============================================================================================
    describe('#startCrawler', function() {

        //-----------------------------------------------------------------------------------------
        // Check Access Control
        //-----------------------------------------------------------------------------------------
        it('Check Access Control', function(done) {
            let _contentPackage = new ContentPackage();
            accessControl(null, done, _contentPackage.startCrawler);
        });

        //-----------------------------------------------------------------------------------------
        // Check startCrawler specific cases
        //-----------------------------------------------------------------------------------------
        it('should return ok if the package and table exist and the user has access to it', function(done) {
            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _contentPackage = new ContentPackage();
            _contentPackage.startCrawler('valid', _ticket,
                function(err, data) {
                    expect(err).to.be.a('null');
                    expect(data).to.have.property('code', 200);
                    expect(data).to.have.property('message');
                    done();
                }
            );
        });

        it('should return error if AWS Glue returns any error to query data on that table', function(done) {
            AWS.restore('Glue');
            AWS.mock('Glue', 'createCrawler', function(params, callback) {
                callback(new Error("General Error"), null);
            });
            AWS.mock('Glue', 'startCrawler', function(params, callback) {
                callback(new Error("General Error"), null);
            });

            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            let _contentPackage = new ContentPackage();
            _contentPackage.startCrawler('valid', _ticket,
                function(err, data) {
                    expect(err).to.have.property('code');
                    expect(err).to.have.property('message');
                    expect(data).to.be.a('null');
                    done();
                }
            );
        });
    });
});

