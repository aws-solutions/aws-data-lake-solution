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

angular.module('dataLake.factory.search', ['ngResource', 'dataLake.service.auth'])

.factory('searchFactory', function($resource, $state, authService) {

    var factory = {};

    var searchResource = function(token) {
        var _url = [APIG_ENDPOINT, '/search'].join('');
        return $resource(_url, {}, {
            query: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var statsResource = function(token) {
        var _url = [APIG_ENDPOINT, '/search/stats'].join('');
        return $resource(_url, {}, {
            query: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    factory.search = function(terms, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            searchResource(_token).query({
                term: terms
            }, function(data) {
                return cb(null, data.Items);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };


    factory.stats = function(cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            statsResource(_token).query({
            }, function(data) {
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
