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

angular.module('dataLake.confirm', [])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('confirm', {
        url: '/confirm',
        params: {
            email: '',
            password: ''
        },
        views: {
            '': {
                templateUrl: 'confirm/confirm.html',
                controller: 'ConfirmCtrl'
            }
        },
        activeWithFederation: false
    });
}])

.controller('ConfirmCtrl', function($scope, $state, $stateParams, authService) {

    $scope.errormessage = '';

    $scope.setPassword = function(newuser, isValid) {
        if (isValid) {
            newuser.email = $stateParams.email;
            newuser.password = $stateParams.password;

            authService.signin(newuser, 'password_challenge').then(function() {
                $state.go('dashboard', {});
            }, function(msg) {
                $scope.errormessage = 'An unexpected error has occurred. Please try again.';
                return;
            });

        } else {
            $scope.errormessage = 'There are still invalid fields.';
        }
    };

});
