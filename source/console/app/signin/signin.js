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

angular.module('dataLake.signin', ['dataLake.utils'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
    $stateProvider.state('signin', {
        url: '/signin',
        views: {
            '': {
                templateUrl: 'signin/signin.html',
                controller: 'SigninCtrl'
            }
        },
        activeWithFederation: false
    });
}])

.controller('SigninCtrl', function($scope, $state, authService, $blockUI, $window) {

    $scope.showLoginForm = true;
    $scope.errormessage = '';
    $blockUI.stop();

    if (FEDERATED_LOGIN) {
        $scope.showLoginForm = false;
        authService.signin().then(function(resp) {
            if (resp) {
                $state.go('dashboard', {});
            } else {
                $window.open(LOGIN_URL, '_self');
            }
        }, function(msg) {
            $window.open(LOGIN_URL, '_self');
        });
    }

    $scope.signin = function(user, isValid) {

        if (isValid) {
            authService.signin(user, '').then(function(resp) {
                if (resp.state == 'login_success') {
                    $state.go('dashboard', {});
                } else if (resp.state == 'new_password_required') {
                    $state.go('confirm', {
                        email: user.email,
                        password: user.password
                    });
                }
            }, function(msg) {
                $scope.errormessage = 'Unable to sign in user. Please check your username and password.';
                if ($scope.$$phase != '$digest') {
                    $scope.$apply();
                }

                return;
            });
        } else {
            $scope.errormessage = 'There are still invalid fields.';
        }
    };

});
