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

console.log('Loading function');

let AWS = require('aws-sdk');
let jwt = require('jsonwebtoken');
let request = require('request');
let jwkToPem = require('jwk-to-pem');
let _ = require('underscore');
let Base64 = require('js-base64').Base64;
let moment = require('moment');
let crypto = require('crypto');
let url = require('url');

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

exports.handler = function(event, context, callback) {

    getConfigInfo(function(err, config) {

        if (err) {
            console.log(err);
            return callback(err, null);
        }

        userPoolId = config.Item.setting.idp;
        iss = 'https://cognito-idp.' + region + '.amazonaws.com/' + userPoolId;

        let _url = url.parse(config.Item.setting.apiEndpoint);
        endpoint = _url.hostname;

        if (event.authorizationToken.startsWith('tk:')) {
            //Download PEM for your UserPool if not already downloaded
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
                        ValidateToken(pems, event, callback);
                    } else {
                        //Unable to download JWKs, fail the call
                        return callback('Unable to download JWKs', null);
                    }
                });
            } else {
                //PEMs are already downloaded, continue with validating the token
                ValidateToken(pems, event, callback);
            }
        } else if (event.authorizationToken.startsWith('ak:')) {
            ValidateApiToken(event, callback);
        } else {
            console.log('Not a valid Auth token');
            return callback('Unauthorized', null);
        }

    });

};

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
}

/**
 * Helper function to retrieve data lake configuration setting from Amazon DynamoDB [data-lake-settings].
 * @param {getConfigInfo~requestCallback} cb - The callback that handles the response.
 */
function getConfigInfo(cb) {
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
}

/**
 * Validates the user represented in the request Auth header token is authorized. The token
 * processed by this function is from the data lake GUI represented by the Amazon Cognito
 * JWT provided by an authenticated user
 * @param {Object} pems - JWKs from the data lake Amazon Cognito user pool in PEM format.
 * @param {JSON} event - Request event.
 * @param {ValidateToken~requestCallback} callback - The callback that handles the response.
 */
function ValidateToken(pems, event, callback) {

    let token = event.authorizationToken.substr(3);

    //Fail if the token is not jwt
    let decodedJwt = jwt.decode(token, {
        complete: true
    });
    console.log(decodedJwt);
    if (!decodedJwt) {
        console.log('Not a valid JWT token');
        return callback('Unauthorized', null);
    }

    //Fail if token is not from your UserPool
    if (decodedJwt.payload.iss != iss) {
        console.log('invalid issuer');
        return callback('Unauthorized', null);
    }

    //Reject the jwt if it's not an 'Access Token'
    if (decodedJwt.payload.token_use != 'access') {
        console.log('Not an access token');
        return callback('Unauthorized', null);
    }

    //Get the kid from the token and retrieve corresponding PEM
    let kid = decodedJwt.header.kid;
    let pem = pems[kid];
    if (!pem) {
        console.log('Invalid access token');
        return callback('Unauthorized', null);
    }

    //Verify the signature of the JWT token to ensure it's really coming from your User Pool

    jwt.verify(token, pem, {
        issuer: iss
    }, function(err, payload) {
        if (err) {
            return callback('Unauthorized', null);
        } else {
            //Valid token. Generate the API Gateway policy for the user
            //Always generate the policy on value of 'sub' claim and not for 'username' because username is reassignable
            //sub is UUID for a user which is never reassigned to another user.
            let principalId = payload.sub;

            //Get AWS AccountId and API Options
            let apiOptions = {};
            let tmp = event.methodArn.split(':');
            let apiGatewayArnTmp = tmp[5].split('/');
            let awsAccountId = tmp[4];
            apiOptions.region = tmp[3];
            apiOptions.restApiId = apiGatewayArnTmp[0];
            apiOptions.stage = apiGatewayArnTmp[1];

            //For more information on specifics of generating policy, refer to blueprint for API Gateway's
            //Custom authorizer in Lambda console
            let policy = new AuthPolicy(principalId, awsAccountId, apiOptions);
            policy.allowAllMethods();
            return callback(null, policy.build());
        }
    });
}

/**
 * Validates the user represented in the request Auth header token is authorized.
 * The token processed by this function is a native data lake API call represented by
 * an access key and secret access key
 * @param {JSON} event - Request event.
 * @param {ValidateApiToken~requestCallback} callback - The callback that handles the response.
 */
function ValidateApiToken(event, callback) {

    let _token = event.authorizationToken.substr(3);
    let _decodedToken = Base64.decode(_token);
    let _keyinfo = _decodedToken.split(':');

    if (_keyinfo.length === 2) {
        let _accessKeyId = _keyinfo[0];
        let _signature = _keyinfo[1];

        // get the user_id based on the accessKeyId [data-lake-keys] in ddb
        getApiKey(_accessKeyId, function(err, keydata) {
            if (err) {
                console.log('error getting api key from ddb', err);
                return callback('Unauthorized', null);
            }

            if (keydata.Items.length > 0) {
                if (keydata.Items[0].key_status === 'Active') {
                    // get the user from cognito and verify the accessKeyId and secretaccesskey match the user
                    // profile
                    getUserFromCognito(keydata.Items[0].user_id, function(err, user) {
                        if (err) {
                            console.log('error getting user from cognito', err);
                            return callback('Unauthorized', null);
                        }

                        validateSignature(_signature, user.secretaccesskey, function(err, validSignature) {
                            if (err) {
                                console.log('error validating api signing signature from request',
                                    err);
                                return callback('Unauthorized', null);
                            }

                            console.log('API signature validation result:' + validSignature);

                            if (user.accesskey === _accessKeyId && validSignature) {
                                let apiOptions = {};
                                let tmp = event.methodArn.split(':');
                                let apiGatewayArnTmp = tmp[5].split('/');
                                let awsAccountId = tmp[4];
                                apiOptions.region = tmp[3];
                                apiOptions.restApiId = apiGatewayArnTmp[0];
                                apiOptions.stage = apiGatewayArnTmp[1];

                                let policy = new AuthPolicy(user.sub, awsAccountId, apiOptions);
                                policy.allowAllMethods();
                                return callback(null, policy.build());
                            } else {
                                console.log('API authorization signature is not valid');
                                return callback('Unauthorized', null);
                            }

                        });
                    });
                } else {
                    console.log('Access key is inactive: ', keydata.Items[0].key_status);
                    return callback('Unauthorized', null);
                }

            } else {
                console.log('access key was not found in ddb: ', _accessKeyId);
                return callback('Unauthorized', null);
            }

        });

    } else {
        console.log('Not a valid api token');
        return callback('Unauthorized', null);
    }

}

/**
 * Helper function to retrieve api access key from Amazon DynamoDB [data-lake-keys].
 * @param {string} akid - Data Lake access key id sent in request.
 * @param {getApiKey~requestCallback} cb - The callback that handles the response.
 */
function getApiKey(akid, cb) {
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
}

/**
 * Helper function to retrieve user account from the data lake Amazon Cognito user pool.
 * @param {string} userId - Username of the user to retr from the data lake Amazon Cognito user pool.
 * @param {getUserFromCognito~requestCallback} cb - The callback that handles the response.
 */
function getUserFromCognito(userId, cb) {
    let params = {
        UserPoolId: userPoolId,
        Username: userId
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
            role: '',
            accesskey: '',
            secretaccesskey: '',
            enabled: data.Enabled
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
}

/**
 * Reconstructs the Data Lake Version 4 signature and compares it against the signature
 * recieved from the client.
 * @param {string} sig - Data Lake Version 4 signature sent in request.
 * @param {string} sak - User's secret access key retrieved from encrypted value in Amazon Cognito.
 * @param {validateSignature~requestCallback} cb - The callback that handles the response.
 */
function validateSignature(sig, sak, cb) {

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

}

/**
 * AuthPolicy receives a set of allowed and denied methods and generates a valid
 * AWS policy for the API Gateway authorizer. The constructor receives the calling
 * user principal, the AWS account ID of the API owner, and an apiOptions object.
 * The apiOptions can contain an API Gateway RestApi Id, a region for the RestApi, and a
 * stage that calls should be allowed/denied for. For example
 * {
 *   restApiId: "xxxxxxxxxx",
 *   region: "us-east-1",
 *   stage: "dev"
 * }
 *
 * let testPolicy = new AuthPolicy("[principal user identifier]", "[AWS account id]", apiOptions);
 * testPolicy.allowMethod(AuthPolicy.HttpVerb.GET, "/users/username");
 * testPolicy.denyMethod(AuthPolicy.HttpVerb.POST, "/pets");
 * context.succeed(testPolicy.build());
 *
 * @class AuthPolicy
 * @constructor
 */
function AuthPolicy(principal, awsAccountId, apiOptions) {
    /**
     * The AWS account id the policy will be generated for. This is used to create
     * the method ARNs.
     *
     * @property awsAccountId
     * @type {String}
     */
    this.awsAccountId = awsAccountId;

    /**
     * The principal used for the policy, this should be a unique identifier for
     * the end user.
     *
     * @property principalId
     * @type {String}
     */
    this.principalId = principal;

    /**
     * The policy version used for the evaluation. This should always be "2012-10-17"
     *
     * @property version
     * @type {String}
     * @default "2012-10-17"
     */
    this.version = '2012-10-17';

    /**
     * The regular expression used to validate resource paths for the policy
     *
     * @property pathRegex
     * @type {RegExp}
     * @default '^\/[/.a-zA-Z0-9-\*]+$'
     */
    this.pathRegex = new RegExp('^[/.a-zA-Z0-9-\*]+$');

    // these are the internal lists of allowed and denied methods. These are lists
    // of objects and each object has 2 properties: A resource ARN and a nullable
    // conditions statement.
    // the build method processes these lists and generates the approriate
    // statements for the final policy
    this.allowMethods = [];
    this.denyMethods = [];

    if (!apiOptions || !apiOptions.restApiId) {
        this.restApiId = '*';
    } else {
        this.restApiId = apiOptions.restApiId;
    }

    if (!apiOptions || !apiOptions.region) {
        this.region = '*';
    } else {
        this.region = apiOptions.region;
    }

    if (!apiOptions || !apiOptions.stage) {
        this.stage = '*';
    } else {
        this.stage = apiOptions.stage;
    }
};

/**
 * A set of existing HTTP verbs supported by API Gateway. This property is here
 * only to avoid spelling mistakes in the policy.
 *
 * @property HttpVerb
 * @type {Object}
 */
AuthPolicy.HttpVerb = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    HEAD: 'HEAD',
    DELETE: 'DELETE',
    OPTIONS: 'OPTIONS',
    ALL: '*'
};

AuthPolicy.prototype = (function() {
    /**
     * Adds a method to the internal lists of allowed or denied methods. Each object in
     * the internal list contains a resource ARN and a condition statement. The condition
     * statement can be null.
     *
     * @method addMethod
     * @param {String} The effect for the policy. This can only be "Allow" or "Deny".
     * @param {String} he HTTP verb for the method, this should ideally come from the
     *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
     * @param {String} The resource path. For example "/pets"
     * @param {Object} The conditions object in the format specified by the AWS docs.
     * @return {void}
     */
    let addMethod = function(effect, verb, resource, conditions) {
        if (verb != '*' && !AuthPolicy.HttpVerb.hasOwnProperty(verb)) {
            throw new Error('Invalid HTTP verb ' + verb + '. Allowed verbs in AuthPolicy.HttpVerb');
        }

        if (!this.pathRegex.test(resource)) {
            throw new Error('Invalid resource path: ' + resource + '. Path should match ' + this.pathRegex);
        }

        let cleanedResource = resource;
        if (resource.substring(0, 1) == '/') {
            cleanedResource = resource.substring(1, resource.length);
        }

        let resourceArn = 'arn:aws:execute-api:' +
            this.region + ':' +
            this.awsAccountId + ':' +
            this.restApiId + '/' +
            this.stage + '/' +
            verb + '/' +
            cleanedResource;

        if (effect.toLowerCase() == 'allow') {
            this.allowMethods.push({
                resourceArn: resourceArn,
                conditions: conditions
            });
        } else if (effect.toLowerCase() == 'deny') {
            this.denyMethods.push({
                resourceArn: resourceArn,
                conditions: conditions
            });
        }
    };

    /**
     * Returns an empty statement object prepopulated with the correct action and the
     * desired effect.
     *
     * @method getEmptyStatement
     * @param {String} The effect of the statement, this can be 'Allow" or "Deny"
     * @return {Object} An empty statement object with the Action, Effect, and Resource
     *                  properties prepopulated.
     */
    let getEmptyStatement = function(effect) {
        effect = effect.substring(0, 1).toUpperCase() + effect.substring(1, effect.length).toLowerCase();
        let statement = {};
        statement.Action = 'execute-api:Invoke';
        statement.Effect = effect;
        statement.Resource = [];

        return statement;
    };

    /**
     * This function loops over an array of objects containing a resourceArn and
     * conditions statement and generates the array of statements for the policy.
     *
     * @method getStatementsForEffect
     * @param {String} The desired effect. This can be "Allow" or "Deny"
     * @param {Array} An array of method objects containing the ARN of the resource
     *                and the conditions for the policy
     * @return {Array} an array of formatted statements for the policy.
     */
    let getStatementsForEffect = function(effect, methods) {
        let statements = [];

        if (methods.length > 0) {
            let statement = getEmptyStatement(effect);

            for (let i = 0; i < methods.length; i++) {
                let curMethod = methods[i];
                if (curMethod.conditions === null || curMethod.conditions.length === 0) {
                    statement.Resource.push(curMethod.resourceArn);
                } else {
                    let conditionalStatement = getEmptyStatement(effect);
                    conditionalStatement.Resource.push(curMethod.resourceArn);
                    conditionalStatement.Condition = curMethod.conditions;
                    statements.push(conditionalStatement);
                }
            }

            if (statement.Resource !== null && statement.Resource.length > 0) {
                statements.push(statement);
            }
        }

        return statements;
    };

    return {
        constructor: AuthPolicy,

        /**
         * Adds an allow "*" statement to the policy.
         *
         * @method allowAllMethods
         */
        allowAllMethods: function() {
            addMethod.call(this, 'allow', '*', '*', null);
        },

        /**
         * Adds a deny '*' statement to the policy.
         *
         * @method denyAllMethods
         */
        denyAllMethods: function() {
            addMethod.call(this, 'deny', '*', '*', null);
        },

        /**
         * Adds an API Gateway method (Http verb + Resource path) to the list of allowed
         * methods for the policy
         *
         * @method allowMethod
         * @param {String} The HTTP verb for the method, this should ideally come from the
         *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
         * @param {string} The resource path. For example "/pets"
         * @return {void}
         */
        allowMethod: function(verb, resource) {
            addMethod.call(this, 'allow', verb, resource, null);
        },

        /**
         * Adds an API Gateway method (Http verb + Resource path) to the list of denied
         * methods for the policy
         *
         * @method denyMethod
         * @param {String} The HTTP verb for the method, this should ideally come from the
         *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
         * @param {string} The resource path. For example "/pets"
         * @return {void}
         */
        denyMethod: function(verb, resource) {
            addMethod.call(this, 'deny', verb, resource, null);
        },

        /**
         * Adds an API Gateway method (Http verb + Resource path) to the list of allowed
         * methods and includes a condition for the policy statement. More on AWS policy
         * conditions here: http://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html#Condition
         *
         * @method allowMethodWithConditions
         * @param {String} The HTTP verb for the method, this should ideally come from the
         *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
         * @param {string} The resource path. For example "/pets"
         * @param {Object} The conditions object in the format specified by the AWS docs
         * @return {void}
         */
        allowMethodWithConditions: function(verb, resource, conditions) {
            addMethod.call(this, 'allow', verb, resource, conditions);
        },

        /**
         * Adds an API Gateway method (Http verb + Resource path) to the list of denied
         * methods and includes a condition for the policy statement. More on AWS policy
         * conditions here: http://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements.html#Condition
         *
         * @method denyMethodWithConditions
         * @param {String} The HTTP verb for the method, this should ideally come from the
         *                 AuthPolicy.HttpVerb object to avoid spelling mistakes
         * @param {string} The resource path. For example "/pets"
         * @param {Object} The conditions object in the format specified by the AWS docs
         * @return {void}
         */
        denyMethodWithConditions: function(verb, resource, conditions) {
            addMethod.call(this, 'deny', verb, resource, conditions);
        },

        /**
         * Generates the policy document based on the internal lists of allowed and denied
         * conditions. This will generate a policy with two main statements for the effect:
         * one statement for Allow and one statement for Deny.
         * Methods that includes conditions will have their own statement in the policy.
         *
         * @method build
         * @return {Object} The policy object that can be serialized to JSON.
         */
        build: function() {
            if ((!this.allowMethods || this.allowMethods.length === 0) &&
                (!this.denyMethods || this.denyMethods.length === 0)) {
                throw new Error('No statements defined for the policy');
            }

            let policy = {};
            policy.principalId = this.principalId;
            let doc = {};
            doc.Version = this.version;
            doc.Statement = [];

            doc.Statement = doc.Statement.concat(getStatementsForEffect.call(this, 'Allow', this.allowMethods));
            doc.Statement = doc.Statement.concat(getStatementsForEffect.call(this, 'Deny', this.denyMethods));

            policy.policyDocument = doc;

            return policy;
        }
    };

})();
