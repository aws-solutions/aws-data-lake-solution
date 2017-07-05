'use strict';

let assert = require('chai').assert;
let expect = require('chai').expect;
var path = require('path');
let AWS = require('aws-sdk-mock');
AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

let Logging = require('./logging.js');

describe('logging', function() {

    let message = {
        message: 'test-service:23f9fb24-072c-11e7-b7ce-af27093f357a test message'
    };

    let config = {
        Item: {
            setting: {
                sequence: 'abc123',
                stream: 'test-stream'
            }
        }
    };

    let writeSuccess = {
        nextSequenceToken: 'abc1234'
    };

    let updatedSetting = {
        Item: {
            setting: {
                sequence: 'abc124',
                stream: 'test-stream'
            }
        }
    };

    describe('#createEntry', function() {

        beforeEach(function() {});

        afterEach(function() {
            AWS.restore('DynamoDB.DocumentClient');
            AWS.restore('CloudWatchLogs');
        });

        it('should return success record when logging write successful', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, config);
            });

            AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
                callback(null, updatedSetting);
            });

            AWS.mock('CloudWatchLogs', 'putLogEvents', function(params, callback) {
                callback(null, {
                    nextSequenceToken: 'abc1234'
                });
            });

            let _logging = new Logging();
            _logging.createEntry(message, function(err, data) {
                if (err) done(err);
                else {
                    expect(data).to.deep.equal(writeSuccess);
                    done();
                }
            });
        });

        it('should return error when ddb get setting fails', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback('error', null);
            });

            AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
                callback(null, updatedSetting);
            });

            AWS.mock('CloudWatchLogs', 'putLogEvents', function(params, callback) {
                callback(null, {
                    nextSequenceToken: 'abc1234'
                });
            });

            let _logging = new Logging();
            _logging.createEntry(message, function(err, data) {
                if (err) {
                    expect(err).to.deep.equal(
                        "Error retrieving logging token settings [ddb].");
                    done();
                } else {
                    done('invalid failure for negative test');
                }
            });
        });

        it('should return success record when logging write successful after log stream created', function(
            done) {

            let _call = 0;

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, config);
            });

            AWS.mock('DynamoDB.DocumentClient', 'put', function(params, callback) {
                callback(null, updatedSetting);
            });

            AWS.mock('CloudWatchLogs', 'putLogEvents', function(params, callback) {
                if (_call === 0) {
                    _call = _call + 1;
                    callback({
                        code: 'ResourceNotFoundException',
                        message: 'The specified log stream does not exist.'
                    }, null);
                } else {
                    _call = _call + 1;
                    callback(null, {
                        nextSequenceToken: 'abc1234'
                    });
                }
            });

            AWS.mock('CloudWatchLogs', 'createLogStream', function(params, callback) {
                callback(null, {
                    result: 'success'
                });
            });

            let _logging = new Logging();
            _logging.createEntry(message, function(err, data) {
                if (err) done(err);
                else {
                    expect(data).to.deep.equal(writeSuccess);
                    done();
                }
            });
        });

    });

});
