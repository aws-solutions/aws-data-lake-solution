'use strict';

let assert = require('assert');
let AWS = require('aws-sdk-mock');
const cAssert = require('chai').assert;
const expect = require('chai').expect;
var chai = require("chai");
chai.should();
chai.use(require('chai-things'));

let Group = require('./group.js');

describe('Group', function() {
    //=============================================================================================
    // Sample Return Data
    //=============================================================================================

    //=============================================================================================
    // beforeEach
    //=============================================================================================
    /**
     * Set a default value for every aws service called by content-package functions.
     */
    beforeEach(function() {
        process.env.USER_POOL_ID = "";
    });

    //=============================================================================================
    // afterEarch
    //=============================================================================================
    /**
     * Restore all used aws services state
     */
    afterEach(function() {
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
            f(_ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the session is not valid!"));
                }
            );

            //-----------------------------------------------------------------------------------------
            // should return error if the user is not admin
            //-----------------------------------------------------------------------------------------
            _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the invalid role for requested operation',
                userid: "user_amazon_com",
                role: "role"
            };
            f(_ticket,
                function(err, data) {
                    if (!err) done(new Error("should return error if the user is not admin!"));
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
    describe('#listGroups', function() {

        //-----------------------------------------------------------------------------------------
        // Check Access Control
        //-----------------------------------------------------------------------------------------
        // it('Check Access Control', function(done) {
        //     let _group = new Group();
        //     accessControl(null, done, _group.listGroups);
        // });

        it('should return the group list if the user is admin', function(done) {
            AWS.mock('CognitoIdentityServiceProvider', 'listGroups', function(params, callback) {
                let result = { Groups:[
                    {
                        GroupName: 'group-01',
                        UserPoolId: 'user-pool-id',
                        LastModifiedDate: '1970-01-01T00:00:00Z',
                        CreationDate: '1970-01-01T00:00:00Z',
                    },
                    {
                        GroupName: 'group-02',
                        UserPoolId: 'user-pool-id',
                        LastModifiedDate: '1970-01-01T00:00:00Z',
                        CreationDate: '1970-01-01T00:00:00Z',
                    }
                ]};
                callback(null, result);
            });

            let _ticket = {
                auth_status: 'authorized',
                auth_status_reason: 'User has the valid role for requested operation',
                userid: "user_amazon_com",
                role: "Admin"
            };

            let _group = new Group();
            _group.listGroups(_ticket,
                function(err, data) {
                    expect(err).to.be.a('null');
                    data.Groups.should.all.have.property('GroupName');
                    data.Groups.should.all.have.property('CreationDate');
                    done();
                }
            );

            AWS.restore('CognitoIdentityServiceProvider');
        });

    });
});

