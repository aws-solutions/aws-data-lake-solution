'use strict';

let assert = require('assert');
let AWS = require('aws-sdk-mock');
const cAssert = require('chai').assert;
const expect = require('chai').expect;

let lib = require('../../search/lib/');

describe('Index', function() {

    beforeEach(function() {
        var payload = {
            event: {
                headers: {
                    Auth: 'testauth-12345'
                }
            }
        };

        AWS.mock('Lambda', 'invoke', function(params, callback) {
            let _payload = JSON.parse(params.Payload);
            if (_payload.authorizationToken === 'testauth-12345') {
                let data = JSON.stringify({
                    auth_status: 'authorized',
                    auth_status_reason: 'User has the valid role for requested operation',
                    userid: 'testuser',
                    role: 'Member'
                });

                callback(null, {
                    Payload: data
                });
            } else {
                let data = JSON.stringify({
                    auth_status: 'Unauthorized',
                    auth_status_reason: 'Invalid access token'
                });

                callback(null, {
                    Payload: data
                });
            }
        });
    });

    afterEach(function() {
        AWS.restore('Lambda');
    });

    describe('#respond', function() {

        it('should return unathorized with no valid auth token', function(done) {

            var invalidPayload = {
                headers: {
                    Auth: 'badtoken'
                }
            };

            lib.respond(invalidPayload, function(err, data) {
                if (err) {
                    expect(err.body).to.be.equal(
                        '{"error":{"message":"User is not authorized to perform the requested action."}}'
                    );
                    done();
                } else {
                    done('Test failed with no error callback');
                }
            });
        });

    });
});
