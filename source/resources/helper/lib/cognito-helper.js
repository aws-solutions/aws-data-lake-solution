/*********************************************************************************************************************
 *  Copyright 2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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
let generatePassword = require('password-generator');
const MAX_PASSWORD_LENGTH = 18;
const MIN_PASSWORD_LENGTH = 12;

/**
 * Helper function to interact with dynamodb for data lake cfn custom resource.
 *
 * @class dynamoDBHelper
 */
let cognitoHelper = (function() {

    /**
     * @class cognitoHelper
     * @constructor
     */
    let cognitoHelper = function() {};

    /**
     * Provisions the Amazon Cognito User Pool for the data lake at deployment.
     * @param {string} appUrl - Settings to save in data-lake-settings.
     * @param {createDataLakeUserPool~requestCallback} cb - The callback that handles the response.
     */
    cognitoHelper.prototype.createDataLakeUserPool = function(appUrl, adminName, adminEmail, cb) {
        let _userPoolId = '';
        let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
        let params = {
            PoolName: 'data-lake',
            /* required */
            AdminCreateUserConfig: {
                AllowAdminCreateUserOnly: true,
                InviteMessageTemplate: {
                    EmailMessage: [
                        'You are invited to join the Data Lake. Your Data Lake username is {username} and temporary password is {####}. \n \n Please sign in to the Data Lake with your email address and your temporary password at',
                        appUrl, '.'
                    ].join(' '),
                    EmailSubject: 'Your Data Lake account.',
                    SMSMessage: 'Your username is {username} and temporary password is {####}.'
                },
                UnusedAccountValidityDays: 7
            },
            AliasAttributes: [
                'email'
            ],
            AutoVerifiedAttributes: [
                'email'
            ],
            MfaConfiguration: 'OFF',
            Policies: {
                PasswordPolicy: {
                    MinimumLength: 8,
                    RequireLowercase: true,
                    RequireNumbers: true,
                    RequireSymbols: false,
                    RequireUppercase: true
                }
            }
        };
        cognitoidentityserviceprovider.createUserPool(params, function(err, data) {
            if (err) {
                return cb(err, null);
            }

            _userPoolId = data.UserPool.Id;

            let params = {
                CustomAttributes: [{
                    AttributeDataType: 'String',
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Name: 'display_name',
                    Required: false,
                    StringAttributeConstraints: {
                        MaxLength: '256',
                        MinLength: '1'
                    }
                }, {
                    AttributeDataType: 'String',
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Name: 'role',
                    Required: false,
                    StringAttributeConstraints: {
                        MaxLength: '256',
                        MinLength: '1'
                    }
                }, {
                    AttributeDataType: 'String',
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Name: 'accesskey',
                    Required: false,
                    StringAttributeConstraints: {
                        MaxLength: '256',
                        MinLength: '1'
                    }
                }, {
                    AttributeDataType: 'String',
                    DeveloperOnlyAttribute: false,
                    Mutable: true,
                    Name: 'secretaccesskey',
                    Required: false,
                    StringAttributeConstraints: {
                        MaxLength: '512',
                        MinLength: '1'
                    }
                }],
                UserPoolId: _userPoolId
            };

            cognitoidentityserviceprovider.addCustomAttributes(params, function(err, newAttrData) {
                if (err) {
                    return cb(err, null);
                }

                var _password = generatedSecurePassword();

                let params = {
                    UserPoolId: _userPoolId,
                    Username: adminEmail.replace('@', '_').replace(/\./g, '_'),
                    DesiredDeliveryMediums: ['EMAIL'],
                    ForceAliasCreation: true,
                    TemporaryPassword: _password,
                    UserAttributes: [{
                        Name: 'email',
                        Value: adminEmail
                    }, {
                        Name: 'email_verified',
                        Value: 'true'
                    }, {
                        Name: 'custom:role',
                        Value: 'Admin'
                    }, {
                        Name: 'custom:display_name',
                        Value: adminName
                    }]
                };

                cognitoidentityserviceprovider.adminCreateUser(params, function(err, newUserData) {
                    if (err) {
                        return cb(err, null);
                    }

                    let params = {
                        ClientName: 'data-lake-ui',
                        UserPoolId: _userPoolId,
                        GenerateSecret: false,
                        RefreshTokenValidity: 1,
                        ReadAttributes: [
                            'email',
                            'custom:display_name',
                            'custom:role',
                            'custom:accesskey'
                        ],
                        WriteAttributes: [
                            'phone_number',
                            'email'
                        ]
                    };

                    cognitoidentityserviceprovider.createUserPoolClient(params, function(
                        err,
                        newClientData) {
                        if (err) {
                            return cb(err, null);
                        }

                        return cb(null, {
                            UserPoolId: _userPoolId,
                            UserPoolClientId: newClientData.UserPoolClient
                                .ClientId
                        });
                    });
                });

            });

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

    return cognitoHelper;

})();

module.exports = cognitoHelper;
