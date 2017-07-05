'use strict';

let assert = require('chai').assert;
let expect = require('chai').expect;
var path = require('path');
let AWS = require('aws-sdk-mock');
AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

let Profile = require('./profile.js');

describe('profile', function() {

    let ticket = {
        auth_status: 'authorized',
        auth_status_reason: '',
        userid: 'user_test_com',
        role: 'Admin'
    };

    let config = {
        Item: {
            setting: {
                apiEndpoint: 'https://hostname.test.com/gatewayid',
                kmsKeyId: 'testkeyid',
                idp: 'test-ipd'
            }
        }
    };

    let profile = {
        hostname: 'hostname.test.com'
    };

    describe('#getProfile', function() {

        beforeEach(function() {});

        afterEach(function() {
            AWS.restore('DynamoDB.DocumentClient');
        });

        it('should return profile record when ddb query successful', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, config);
            });

            let _profile = new Profile();
            _profile.getProfile(ticket, function(err, data) {
                if (err) done(err);
                else {
                    expect(data).to.deep.equal(profile);
                    done();
                }
            });
        });

        it('should return error information when ddb query fails', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback('error', null);
            });

            let _profile = new Profile();
            _profile.getProfile(ticket, function(err, data) {
                if (err) {
                    expect(err).to.deep.equal({
                        error: {
                            message: 'Error retrieving app configuration settings [ddb].'
                        }
                    });
                    done();
                } else {
                    done('invalid failure for negative test');
                }
            });

        });
    });

    describe('#createApiKey', function() {

        beforeEach(function() {});

        afterEach(function() {
            AWS.restore('DynamoDB.DocumentClient');
            AWS.restore('KMS');
            AWS.restore('CognitoIdentityServiceProvider');
        });

        it('should return new api key when successful', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, config);
            });

            AWS.mock('KMS', 'encrypt', function(params, callback) {
                callback(null, {
                    CiphertextBlob: 'encrypted_data'
                });
            });

            AWS.mock('CognitoIdentityServiceProvider', 'adminUpdateUserAttributes', function(params,
                callback) {
                callback(null, {
                    result: 'success'
                });
            });

            let _profile = new Profile();
            _profile.createApiKey(ticket, function(err, data) {
                if (err) done(err);
                else {
                    expect(data).to.have.all.keys('key');
                    done();
                }
            });
        });

        it('should return error information when ddb query fails', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback('error', null);
            });

            AWS.mock('KMS', 'encrypt', function(params, callback) {
                callback(null, {
                    CiphertextBlob: 'encrypted_data'
                });
            });

            AWS.mock('CognitoIdentityServiceProvider', 'adminUpdateUserAttributes', function(params,
                callback) {
                callback(null, {
                    result: 'success'
                });
            });

            let _profile = new Profile();
            _profile.createApiKey(ticket, function(err, data) {
                if (err) {
                    expect(err).to.deep.equal({
                        error: {
                            message: 'Error retrieving app configuration settings [ddb].'
                        }
                    });
                    done();
                } else {
                    done('invalid failure for negative test');
                }
            });

        });

        it('should return error information when encrypt fails', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, config);
            });

            AWS.mock('KMS', 'encrypt', function(params, callback) {
                callback('error', null);
            });

            AWS.mock('CognitoIdentityServiceProvider', 'adminUpdateUserAttributes', function(params,
                callback) {
                callback(null, {
                    result: 'success'
                });
            });

            let _profile = new Profile();
            _profile.createApiKey(ticket, function(err, data) {
                if (err) {
                    expect(err).to.equal('error');
                    done();
                } else {
                    console.log(data)
                    done('invalid failure for negative test');
                }
            });

        });

        it('should return error information when update user attributes fails', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, config);
            });


            AWS.mock('KMS', 'encrypt', function(params, callback) {
                callback(null, {
                    CiphertextBlob: 'encrypted_data'
                });
            });

            AWS.mock('CognitoIdentityServiceProvider', 'adminUpdateUserAttributes', function(params,
                callback) {
                callback('error', null);
            });

            let _profile = new Profile();
            _profile.createApiKey(ticket, function(err, data) {
                if (err) {
                    expect(err).to.equal('error');
                    done();
                } else {
                    console.log(data)
                    done('invalid failure for negative test');
                }
            });

        });
    });

});
