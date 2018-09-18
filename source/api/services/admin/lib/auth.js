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

/**
 * @author Solution Builders
 */

'use strict';

let AWS = require('aws-sdk');
let jwt = require('jsonwebtoken');
let request = require('request');
let jwkToPem = require('jwk-to-pem');
let _ = require('underscore');
let Base64 = require('js-base64').Base64;
let crypto = require('crypto');
let url = require('url');
let moment = require('moment');

let userPoolId = '';
let endpoint = '';
let region = process.env.AWS_REGION; //e.g. us-east-1
let iss = '';
let pems;

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);

/**
 * Performs authorization function for data lake to determine if a user [via UI or API/CLI] has the access
 * role to perform the requested operation.
 *
 * @class auth
 */
let auth = (function() {

    /**
     * @class auth
     * @constructor
     */
    let auth = function() {

    };

    /**
     * Control logic for validating if the user represented in the request Auth header has the
     * appropriate role to perform the requested operation. Additionally, it downloads JWKs for
     * deconstruction of JWT from the data lake Amazon Cognito user pool
     * @param {JSON} event - Request event.
     * @param {array} authorizedRoles - Roles authorized to perform the requested operation.
     * @param {authorizeRequest~requestCallback} cb - The callback that handles the response.
     */
    auth.prototype.authorizeRequest = function(event, authorizedRoles, cb) {

        getConfigInfo(function(err, config) {

            if (err) {
                console.log(err);
                return cb(err, null);
            }

            userPoolId = config.Item.setting.idp;
            iss = 'https://cognito-idp.' + region + '.amazonaws.com/' + userPoolId;

            let _url = url.parse(config.Item.setting.apiEndpoint);
            endpoint = _url.hostname;

            if (event.authorizationToken.startsWith('tk:')) {
                console.log('processing UI token for authorization');
                if (!pems) {
                    //Download the JWKs and save it as PEM
                    request({
                        url: iss + '/.well-known/jwks.json',
                        json: true
                    }, function(error, response, body) {
                        if (!error && response.statusCode === 200) {
                            pems = {};
                            let keys = body['keys'];
                            for (let i = 0; i < keys.length; i++) {
                                //Convert each key to PEM
                                let keyId = keys[i].kid;
                                let modulus = keys[i].n;
                                let exponent = keys[i].e;
                                let keyType = keys[i].kty;
                                let jwk = {
                                    kty: keyType,
                                    n: modulus,
                                    e: exponent
                                };
                                let pem = jwkToPem(jwk);
                                pems[keyId] = pem;
                            }

                            //Now continue with validating the token
                            ValidateToken(pems, event, authorizedRoles, cb);
                        } else {
                            //Unable to download JWKs, fail the call
                            return cb('Unable to download JWKs', null);
                        }
                    });
                } else {
                    //PEMs are already downloaded, continue with validating the token
                    ValidateToken(pems, event, authorizedRoles, cb);
                }
            } else if (event.authorizationToken.startsWith('ak:')) {
                console.log('processing api access key for authorization');
                ValidateApiToken(event, authorizedRoles, cb);
            } else {
                console.log('Not a valid Auth token');
                return cb('Unauthorized', null);
            }
        });

    };

    /**
     * Validates the user represented in the request Auth header token has the
     * appropriate role to perform the requested operation. The token processed by this function
     * is from the data lake GUI represented by the Amazon Cognito JWT provided by an authenticated
     * user
     * @param {Object} pems - JWKs from the data lake Amazon Cognito user pool in PEM format.
     * @param {JSON} event - Request event.
     * @param {array} authorizedRoles - Roles authorized to perform the requested operation.
     * @param {ValidateToken~requestCallback} callback - The callback that handles the response.
     */
    let ValidateToken = function(pems, event, authorizedRoles, callback) {

        let _ticket = {
            auth_status: 'Unauthorized',
            auth_status_reason: ''
        };

        let token = event.authorizationToken.substr(3);

        //Fail if the token is not jwt
        let decodedJwt = jwt.decode(token, {
            complete: true
        });
        console.log(decodedJwt);
        if (!decodedJwt) {
            _ticket.auth_status_reason = 'Not a valid JWT token';
            console.log(_ticket);
            return callback(_ticket, null);
        }

        //Fail if token is not from your UserPool
        if (decodedJwt.payload.iss != iss) {
            _ticket.auth_status_reason = 'invalid issuer';
            console.log(_ticket);
            return callback(_ticket, null);
        }

        //Reject the jwt if it's not an 'Access Token'
        if (decodedJwt.payload.token_use != 'access') {
            _ticket.auth_status_reason = 'Not an access token';
            console.log(_ticket);
            return callback(_ticket, null);
        }

        //Get the kid from the token and retrieve corresponding PEM
        let kid = decodedJwt.header.kid;
        let pem = pems[kid];
        if (!pem) {
            _ticket.auth_status_reason = 'Invalid access token';
            console.log(_ticket);
            return callback(_ticket, null);
        }

        //Verify the signature of the JWT token to ensure it's really coming from your User Pool
        jwt.verify(token, pem, {
            issuer: iss
        }, function(err, payload) {
            if (err) {
                console.log(err);
                _ticket.auth_status_reason = err;
                return callback(err, null);
            } else {
                //Valid token. Check the role of the user.
                checkUserRole(authorizedRoles, decodedJwt.payload.username, _ticket, callback);
            }
        });
    };

    /**
     * Validates the user represented in the request Auth header token has the
     * appropriate role to perform the requested operation. The token processed by this function
     * is a native data lake API call represented by an access key and secret access key
     * @param {JSON} event - Request event.
     * @param {array} authorizedRoles - Roles authorized to perform the requested operation.
     * @param {ValidateApiToken~requestCallback} callback - The callback that handles the response.
     */
    function ValidateApiToken(event, authorizedRoles, callback) {

        let _ticket = {
            auth_status: 'Unauthorized',
            auth_status_reason: ''
        };
        let _token = event.authorizationToken.substr(3);
        let _decodedToken = Base64.decode(_token);
        let _keyinfo = _decodedToken.split(':');

        if (_keyinfo.length === 2) {
            let requestKeys = {
                accesskey: _keyinfo[0],
                signature: _keyinfo[1]
            };

            // get the user_id based on the accessKeyId [data-lake-keys] in ddb
            getApiKey(requestKeys.accesskey, function(err, keydata) {
                if (err) {
                    _ticket.auth_status_reason = 'Unable to retrieve user access key from ddb';
                    console.log(_ticket);
                    return callback(_ticket, null);
                }

                if (keydata.Items.length > 0) {
                    if (keydata.Items[0].key_status === 'Active') {

                        checkUserKeysAndRole(requestKeys, authorizedRoles, keydata.Items[0].user_id, _ticket,
                            callback);

                    } else {
                        _ticket.auth_status_reason = ['Access key is inactive:', requestKeys.accesskey].join(' ');
                        console.log(_ticket);
                        return callback(_ticket, null);
                    }

                } else {
                    _ticket.auth_status_reason = ['Access key was not found in ddb:', requestKeys.accesskey].join(' ');
                    console.log(_ticket);
                    return callback(_ticket, null);
                }

            });

        } else {
            _ticket.auth_status_reason = 'Not a valid api token';
            console.log(_ticket);
            return callback(_ticket, null);
        }

    }

    /**
     * Retrieves a user from the data lake Amazon Cognito user pool and validates that thier assigned
     * role is authorized to perform the requested operation.
     * @param {array} authorizedRoles - Roles authorized to perform the requested operation.
     * @param {string} username - Username of Amazon Cognito user to check role.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {checkUserRole~requestCallback} cb - The callback that handles the response.
     */
    let checkUserRole = function(authorizedRoles, username, ticket, cb) {

        // get the user from cognito
        getUserFromCognito(username, function(err, user) {
            if (err) {
                ticket.auth_status_reason = 'Unable to retrieve user from cognito and validate role.';
                console.log(ticket.auth_status_reason, err);
                return cb(ticket, null);
            }

            // verify the user role is in the authorized roles
            if (_.contains(authorizedRoles, user.role.toLowerCase())) {
                ticket.auth_status = 'authorized';
                ticket.auth_status_reason = 'User has the valid role for requested operation';
                ticket.userid = username;
                ticket.role = user.role;
                ticket.user_status = user.userstatus;
                return cb(null, ticket);
            } else {
                ticket.auth_status_reason = 'User does not have a valid role for requested operation';
                return cb(ticket, null);
            }

        });

    };

    /**
     * Retrieves a user from the data lake Amazon Cognito user pool and validates that thier assigned
     * role is authorized to perform the requested operation. It verfies the request by reconstructing
     * the Data Lake Version 4 signature and comparing against the signature recieved from the client.
     * @param {JSON} requestKeys - Represents the access key and Data Lake Version 4 signature sent in request.
     * @param {array} authorizedRoles - Roles authorized to perform the requested operation.
     * @param {string} username - Username of Amazon Cognito user to check role.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {checkUserKeysAndRole~requestCallback} cb - The callback that handles the response.
     */
    let checkUserKeysAndRole = function(requestKeys, authorizedRoles, username, ticket, cb) {

        // get the user from cognito
        getUserFromCognito(username, function(err, user) {
            if (err) {
                ticket.auth_status_reason = 'Unable to retrieve user from cognito and validate role.';
                console.log(ticket.auth_status_reason, err);
                return cb(ticket, null);
            }

            // verify the accessKeyId and secretaccesskey match the user profile
            validateSignature(requestKeys.signature, user.secretaccesskey, function(err, validSignature) {
                if (err) {
                    ticket.auth_status_reason =
                        'Unable to validate api signing signature from request.';
                    console.log(ticket.auth_status_reason, err);
                    return cb(ticket, null);
                }

                if (user.accesskey === requestKeys.accesskey && validSignature) {
                    // verify the user role is in the authorized roles
                    if (_.contains(authorizedRoles, user.role.toLowerCase())) {
                        ticket.auth_status = 'authorized';
                        ticket.auth_status_reason =
                            'User has the valid role for requested operation';
                        ticket.userid = username;
                        ticket.role = user.role;
                        ticket.user_status = user.userstatus;
                        return cb(null, ticket);
                    } else {
                        ticket.auth_status_reason =
                            'User does not have a valid role for requested operation';
                        console.log(ticket, err);
                        return cb(ticket, null);
                    }
                } else {
                    ticket.auth_status_reason =
                        'Access key and secret access key do not match user keys';
                    console.log(ticket, err);
                    return cb(ticket, null);
                }
            });

        });
    };

    /**
     * Reconstructs the Data Lake Version 4 signature and compares it against the signature
     * recieved from the client.
     * @param {string} sig - Data Lake Version 4 signature sent in request.
     * @param {string} sak - User's secret access key retrieved from encrypted value in Amazon Cognito.
     * @param {validateSignature~requestCallback} cb - The callback that handles the response.
     */
    let validateSignature = function(sig, sak, cb) {

        var params = {
            CiphertextBlob: new Buffer(sak, 'base64')
        };

        var kms = new AWS.KMS();
        kms.decrypt(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            let _key = String.fromCharCode.apply(null, new Uint16Array(data.Plaintext));
            console.log(_key);

            var kDate = crypto.createHmac('sha256', 'DATALAKE4' + _key);
            kDate.update(moment().utc().format('YYYYMMDD'));

            var kEndpoint = crypto.createHmac('sha256', kDate.digest('base64'));
            kEndpoint.update(endpoint);

            var kService = crypto.createHmac('sha256', kEndpoint.digest('base64'));
            kService.update('datalake');

            var kSigning = crypto.createHmac('sha256', kService.digest('base64'));
            kSigning.update('datalake4_request');

            let _validSig = kSigning.digest('base64');

            if (_validSig === sig) {
                return cb(null, true);
            } else {
                return cb(null, false);
            }
        });
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
                return cb({
                    error: {
                        message: 'Error retrieving app configuration settings [ddb].'
                    }
                }, null);
            }

            return cb(null, data);
        });
    };

    /**
     * Helper function to retrieve api access key from Amazon DynamoDB [data-lake-keys].
     * @param {string} akid - Data Lake access key id sent in request.
     * @param {getApiKey~requestCallback} cb - The callback that handles the response.
     */
    let getApiKey = function(akid, cb) {
        let params = {
            TableName: 'data-lake-keys',
            KeyConditionExpression: 'access_key_id = :akid',
            ExpressionAttributeValues: {
                ':akid': akid
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
     * Helper function to retrieve user account from the data lake Amazon Cognito user pool.
     * @param {string} userid - Username of the user to retr from the data lake Amazon Cognito user pool.
     * @param {getUserFromCognito~requestCallback} cb - The callback that handles the response.
     */
    let getUserFromCognito = function(userid, cb) {
        let params = {
            UserPoolId: userPoolId,
            Username: userid
        };

        let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
        cognitoidentityserviceprovider.adminGetUser(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err.message, null);
            }

            let _user = {
                user_id: data.Username,
                sub: '',
                role: 'Member',
                accesskey: '',
                secretaccesskey: '',
                enabled: data.Enabled,
                userstatus: data.UserStatus
            };

            let _sub = _.where(data.UserAttributes, {
                Name: 'sub'
            });
            if (_sub.length > 0) {
                _user.sub = _sub[0].Value;
            }

            let _ak = _.where(data.UserAttributes, {
                Name: 'custom:accesskey'
            });
            if (_ak.length > 0) {
                _user.accesskey = _ak[0].Value;
            }

            let _sak = _.where(data.UserAttributes, {
                Name: 'custom:secretaccesskey'
            });
            if (_sak.length > 0) {
                _user.secretaccesskey = _sak[0].Value;
            }

            let _role = _.where(data.UserAttributes, {
                Name: 'custom:role'
            });
            if (_role.length > 0) {
                _user.role = _role[0].Value;
            }

            return cb(null, _user);

        });
    };

    return auth;

})();

module.exports = auth;
