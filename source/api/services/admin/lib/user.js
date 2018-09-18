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

let moment = require('moment');
let AWS = require('aws-sdk');
let _ = require('underscore');
let generatePassword = require('password-generator');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const ddbTable = 'data-lake-settings';
const MAX_PASSWORD_LENGTH = 18;
const MIN_PASSWORD_LENGTH = 12;

/**
 * Performs CRUD operations for data lake users interfacing primiarly with the data lake
 * Amazon Cogntio user pool.
 *
 * @class user
 */
let user = (function() {

    /**
     * @class user
     * @constructor
     */
    let user = function() {};

    /**
     * Retrieves data lake users from Amazon Cognito user pool .
     * @param {getUsers~requestCallback} cb - The callback that handles the response.
     */
    user.prototype.getUsers = function(cb) {

        getUserPoolConfigInfo(function(err, poolinfo) {
            if (err) {
                return cb(err, null);
            }

            let params = {
                UserPoolId: poolinfo,
                AttributesToGet: [
                    'email',
                    'custom:display_name',
                    'custom:role'
                ],
                Filter: '',
                Limit: 0
            };
            if(process.env.FEDERATED_LOGIN == 'true') {
                params.AttributesToGet = [ ];
            }

            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
            cognitoidentityserviceprovider.listUsers(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to list users."}, null);
                }

                let _users = [];
                if (!_.isEmpty(data.Users)) {
                    for (let i = 0; i < data.Users.length; i++) {
                        let _user = {
                            user_id: data.Users[i].Username,
                            name: '',
                            email: '',
                            role: '',
                            enabled: data.Users[i].Enabled,
                            status: data.Users[i].UserStatus
                        };

                        let _nm = _.where(data.Users[i].Attributes, {
                            Name: 'custom:display_name'
                        });

                        if (_nm.length > 0) {
                            _user.name = _nm[0].Value;
                        }

                        let _em = _.where(data.Users[i].Attributes, {
                            Name: 'email'
                        });
                        if (_em.length > 0) {
                            _user.email = _em[0].Value;
                        }

                        let _role = _.where(data.Users[i].Attributes, {
                            Name: 'custom:role'
                        });
                        if (_role.length > 0) {
                            _user.role = _role[0].Value;
                        }

                        _users.push(_user);
                    }
                }

                return cb(null, {Items: _users});
            });

        });

    };

    /**
     * Calling this API causes a message to be sent to the end user with a confirmation
     * code that is required to change the user's password.
     *
     * @param {string} userId - Username of account to start change password process.
     * @param {forgotPassword~requestCallback} cb - The callback that handles the response.
     */
    user.prototype.forgotPassword = function(userId, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        getUserPoolConfigInfo(function(err, poolinfo) {
            if (err) {
                console.log(err);
                return cb({code: 502, message: "Failed to process forgot request."}, null);
            }

            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
            let _password = generatedSecurePassword();
            let params = {
                ClientId: process.env.USER_POOL_CLIENT_ID,
                Username: userId
            };
            cognitoidentityserviceprovider.forgotPassword(params, function(err, data) {
                if (err) {
                    if (err.code === 'NotAuthorizedException') {
                        let params = {
                            UserPoolId: poolinfo,
                            Username: userId,
                            DesiredDeliveryMediums: ['EMAIL'],
                            MessageAction: 'RESEND',
                            TemporaryPassword: _password,
                            UserAttributes: []
                        };
                        cognitoidentityserviceprovider.adminCreateUser(params, function(err, data) {
                            if (err) {
                                console.log(err);
                                return cb({code: 502, message: "Failed to process forgot request."}, null);

                            } else {
                                return cb(null, {code: "INVITE_RESENT"});
                            }
                        });

                    } else {
                        console.log(err);
                        return cb({code: 502, message: "Failed to process forgot request."}, null);
                    }

                } else {
                    return cb(null, {code: "RESET_CODE_SENT"});
                }
            });
        });
    };

    /**
     * Disables a user account in the data lake Amazon Cognito user pool.
     * @param {string} userId - Username of account to disable in user pool.
     * @param {disableUser~requestCallback} cb - The callback that handles the response.
     */
    user.prototype.disableUser = function(userId, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        getUserPoolConfigInfo(function(err, poolinfo) {
            if (err) {
                return cb(err, null);
            }

            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

            let params = {
                UserPoolId: poolinfo,
                Username: userId
            };
            cognitoidentityserviceprovider.adminDisableUser(params, function(err,
                data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to disable user."}, null);
                }

                return cb(null, data);
            });

        });

    };

    /**
     * Enables a user account in the data lake Amazon Cognito user pool.
     * @param {string} userId - Username of account to enable in user pool.
     * @param {enableUser~requestCallback} cb - The callback that handles the response.
     */
    user.prototype.enableUser = function(userId, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        getUserPoolConfigInfo(function(err, poolinfo) {
            if (err) {
                return cb(err, null);
            }

            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

            let params = {
                UserPoolId: poolinfo,
                Username: userId
            };
            cognitoidentityserviceprovider.adminEnableUser(params, function(err,
                data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to enable user."}, null);
                }

                return cb(null, data);
            });

        });

    };

    /**
     * Deletes a user account from the data lake Amazon Cognito user pool.
     * @param {string} userId - Username of account to delete from the user pool.
     * @param {deleteUser~requestCallback} cb - The callback that handles the response.
     */
    user.prototype.deleteUser = function(userId, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        getUserPoolConfigInfo(function(err, poolinfo) {
            if (err) {
                return cb(err, null);
            }

            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

            let params = {
                UserPoolId: poolinfo,
                Username: userId
            };
            cognitoidentityserviceprovider.adminDeleteUser(params, function(err,
                data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to delete user."}, null);
                }

                return cb(null, data);
            });

        });

    };

    /**
     * Update the role for a user account in the data lake Amazon Cognito user pool.
     * @param {string} userId - Username of account to update in the user pool.
     * @param {JSON} user - User object with updated data.
     * @param {updateUser~requestCallback} cb - The callback that handles the response.
     */
    user.prototype.updateUser = function(userId, user, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        getUserPoolConfigInfo(function(err, poolinfo) {
            if (err) {
                return cb(err, null);
            }

            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

            let params = {
                UserAttributes: [{
                    Name: 'custom:role',
                    Value: user.role
                }],
                UserPoolId: poolinfo,
                Username: userId
            };
            cognitoidentityserviceprovider.adminUpdateUserAttributes(params, function(err,
                data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to update user."}, null);
                }

                return cb(null, data);
            });

        });
    };

    /**
     * Creates a user account in data lake Amazon Cognito user pool and send invitation to user.
     * @param {JSON} invite - Invitation object with user information to create invite.
     * @param {inviteUser~requestCallback} cb - The callback that handles the response.
     */
    user.prototype.inviteUser = function(invite, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        getUserPoolConfigInfo(function(err, poolinfo) {
            if (err) {
                return cb(err, null);
            }

            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

            let _invite = JSON.parse(invite);

            var _password = generatedSecurePassword();

            let params = {
                UserPoolId: poolinfo,
                Username: _invite.email.replace('@', '_').replace(/\./g, '_').toLowerCase(),
                DesiredDeliveryMediums: ['EMAIL'],
                ForceAliasCreation: true,
                TemporaryPassword: _password,
                UserAttributes: [{
                    Name: 'email',
                    Value: _invite.email
                }, {
                    Name: 'email_verified',
                    Value: 'true'
                }, {
                    Name: 'custom:role',
                    Value: _invite.role
                }, {
                    Name: 'custom:display_name',
                    Value: _invite.name
                }]
            };

            cognitoidentityserviceprovider.adminCreateUser(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to invite user."}, null);
                }

                return cb(null, data);
            });

        });
    };

    /**
     * Retrieves a user account from the data lake Amazon Cognito user pool.
     * @param {string} userId - Username of account to retrieve from the user pool.
     * @param {JSON} ticket - Data lake authorization ticket.
     * @param {getUser~requestCallback} cb - The callback that handles the response.
     */
    user.prototype.getUser = function(userId, ticket, cb) {
        if (userId != ticket.userid && ticket.role.toLowerCase() != 'admin') {
            return cb({code: 401, message: "User is not authorized to perform the requested action."}, null);
        }

        getUserPoolConfigInfo(function(err, poolinfo) {
            if (err) {
                return cb(err, null);
            }

            let params = {
                UserPoolId: poolinfo,
                Username: userId
            };

            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
            cognitoidentityserviceprovider.adminGetUser(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: "Failed to get user."}, null);
                }

                let _user = {
                    user_id: data.Username,
                    display_name: '',
                    email: '',
                    role: 'Member',
                    accesskey: '',
                    enabled: data.Enabled,
                    created_at: data.UserCreateDate,
                    updated_at: data.UserLastModifiedDate
                };
                let _nm = _.where(data.UserAttributes, {
                    Name: 'custom:display_name'
                });
                if (_nm.length > 0) {
                    _user.display_name = _nm[0].Value;

                } else {
                    let _nm = _.where(data.UserAttributes, {
                        Name: 'name'
                    });
                    let _fn = _.where(data.UserAttributes, {
                        Name: 'family_name'
                    });

                    if (_nm.length > 0 && _fn.length > 0) {
                        _user.display_name = `${_nm[0].Value} ${_fn[0].Value}`;
                    } else if (_nm.length > 0) {
                        _user.display_name = _nm[0].Value;
                    } else if (_fn.length > 0) {
                        _user.display_name = _fn[0].Value;
                    }
                }

                let _ak = _.where(data.UserAttributes, {
                    Name: 'custom:accesskey'
                });
                if (_ak.length > 0) {
                    _user.accesskey = _ak[0].Value;
                }

                let _em = _.where(data.UserAttributes, {
                    Name: 'email'
                });
                if (_em.length > 0) {
                    _user.email = _em[0].Value;
                }

                let _role = _.where(data.UserAttributes, {
                    Name: 'custom:role'
                });
                if (_role.length > 0) {
                    _user.role = _role[0].Value;
                }

                return cb(null, _user);

            });
        });

    };

    /**
     * Helper function to retrieve data lake user pool configuration setting from
     * Amazon DynamoDB [data-lake-settings].
     * @param {getUserPoolConfigInfo~requestCallback} cb - The callback that handles the response.
     */
    let getUserPoolConfigInfo = function(cb) {
        let params = {
            TableName: ddbTable,
            Key: {
                setting_id: 'app-config'
            }
        };

        docClient.get(params, function(err, config) {
            if (err) {
                console.log(err);
                return cb({code: 502, message: "Error retrieving app configuration settings [ddb]."}, null);
            }

            if (!_.isEmpty(config)) {
                cb(null, config.Item.setting.idp);
            } else {
                return cb({code: 502, message: "No valid IDP app configuration data available."}, null);
            }
        });
    };

    /**
     * Helper function to validate that a generated password is strong.
     * @param {string} password - Password to validate.
     */
    let isStrongEnough = function(password) {
        const uppercaseMinCount = 1;
        const lowercaseMinCount = 1;
        const numberMinCount = 2;
        const UPPERCASE_RE = /([A-Z])/g;
        const LOWERCASE_RE = /([a-z])/g;
        const NUMBER_RE = /([\d])/g;
        const NON_REPEATING_CHAR_RE = /([\w\d\?\-])\1{2,}/g;

        let uc = password.match(UPPERCASE_RE);
        let lc = password.match(LOWERCASE_RE);
        let n = password.match(NUMBER_RE);
        let nr = password.match(NON_REPEATING_CHAR_RE);
        return password.length >= MIN_PASSWORD_LENGTH &&
            !nr &&
            uc && uc.length >= uppercaseMinCount &&
            lc && lc.length >= lowercaseMinCount &&
            n && n.length >= numberMinCount;
    };

    /**
     * Helper function to generated a strong password.
     */
    let generatedSecurePassword = function() {
        var password = '';
        var randomLength = Math.floor(Math.random() * (MAX_PASSWORD_LENGTH - MIN_PASSWORD_LENGTH)) +
            MIN_PASSWORD_LENGTH;
        while (!isStrongEnough(password)) {
            password = generatePassword(randomLength, false, /[\w\d\?\-]/);
        }

        return password;
    };

    return user;

})();

module.exports = user;
