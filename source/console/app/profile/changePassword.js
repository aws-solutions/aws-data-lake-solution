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

angular.module('dataLake.profile.changepassword', ['dataLake.main', 'dataLake.utils', 'dataLake.service.auth'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('changePassword', {
        url: '/profile/changepassword',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@changePassword': {
                templateUrl: 'profile/changePassword.html',
                controller: 'ChangePasswordCtrl'
            }
        },
        authenticate: true,
        activeWithFederation: false
    });
}])

.controller('ChangePasswordCtrl', function($scope, $state, $stateParams, $blockUI, authService) {

    $scope.changeinfo = {
        newPassword: ''
    };
    $scope.showError = false;

    $scope.changePassword = function(newinfo, isValid) {
        $blockUI.start();
        if (isValid) {
            authService.changePassword(newinfo.oldPassword, newinfo.newPassword).then(function(resp) {
                    $blockUI.stop();
                    $state.go('profile', {});
                },
                function(msg) {
                    $blockUI.stop();
                    $scope.showError = true;
                    console.log('Unable to change the user password.');
                    return;
                });
        } else {
            $scope.showError = true;
            $blockUI.stop();
        }
    };

});
