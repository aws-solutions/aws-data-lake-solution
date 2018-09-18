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

let manifest = require('./manifest.js');

module.exports.respond = function(event, cb) {

    let _authCheckPayload = {
        authcheck: ['admin', 'member'],
        authorizationToken: event.authorizationToken
    };

    let _response = '';

    // invoke data-lake-admin-service function to verify if user has
    // proper role for requested action
    let params = {
        FunctionName: 'data-lake-admin-service',
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload: JSON.stringify(_authCheckPayload)
    };
    let lambda = new AWS.Lambda();
    lambda.invoke(params, function(err, data) {
        if (err) {
            console.log(err);
            return cb(err, null);
        }

        let _ticket = JSON.parse(data.Payload);
        console.log('Authorization check result: ' + _ticket.auth_status);
        if (_ticket.auth_status === 'authorized') {

            let _manifest = new manifest();

            if (event.operation === 'import') {
                _manifest.import(event, cb);
            } else if (event.operation === 'generate') {
                _manifest.generate(event, cb);
            } else {
                return cb('Invalid operation request to manifest service.', null);
            }

        } else {
            return cb({
                error: {
                    message: 'User is not authorized to perform the requested action.'
                }
            }, null);
        }

    });

}
