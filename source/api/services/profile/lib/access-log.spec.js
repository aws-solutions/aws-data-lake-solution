'use strict';

let assert = require('assert');
let AWS = require('aws-sdk-mock');

let AccessLog = require('./access-log.js');

describe('AccessLog', function() {
    describe('#logEvent', function() {

        afterEach(function() {
            AWS.restore('DynamoDB.DocumentClient');
            AWS.restore('Lambda');
        });

        it('should log an event when logging is enabled', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, {
                    Item: {
                        setting: {
                            auditLogging: true
                        }
                    }
                });
            });

            AWS.mock('Lambda', 'invoke', function(params, callback) {
                callback(null, 'completed invoke');
            });

            let _accessLog = new AccessLog();
            _accessLog.logEvent('test', 'test-service', 'sampleuser',
                'testing event',
                'success',
                function(err, data) {
                    if (err) done(err);
                    else done();
                }
            );
        });

        it('should not log an event when logging is disabled', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, {
                    Item: {
                        setting: {
                            auditLogging: false
                        }
                    }
                });
            });

            let _accessLog = new AccessLog();
            _accessLog.logEvent('test', 'test-service', 'sampleuser',
                'testing event',
                'success',
                function(err, data) {
                    if (err) done(err);
                    else done();
                }
            );
        });
    });
});
