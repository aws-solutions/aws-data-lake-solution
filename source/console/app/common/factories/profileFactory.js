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

angular.module('dataLake.factory.profile', ['ngResource', 'dataLake.service.auth'])

.factory('profileFactory', function($resource, $state, authService) {

    var factory = {};

    var profileResource = function(token) {
        var _url = [APIG_ENDPOINT, 'profile'].join('/');
        return $resource(_url, {}, {
            get: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var profileKeyResource = function(token) {
        var _url = [APIG_ENDPOINT, 'profile/apikey'].join('/');
        return $resource(_url, {}, {
            get: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    factory.getProfile = function(cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            profileResource(_token).get({}, function(data) {
                if (data.errorMessage) {
                    return cb(data.error, null);
                }

                return cb(null, data);
            }, function(err) {
                console.log(err);
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.getApiKey = function(cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            profileKeyResource(_token).get({}, function(data) {
                if (data.errorMessage) {
                    return cb(data.error, null);
                }

                return cb(null, data);
            }, function(err) {
                console.log(err);
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    return factory;

});
