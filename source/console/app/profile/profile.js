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

angular.module('dataLake.profile', ['dataLake.main', 'dataLake.utils', 'dataLake.factory.profile',
    'dataLake.service.auth'
])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('profile', {
        url: '/profile',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@profile': {
                templateUrl: 'profile/profile.html',
                controller: 'ProfileCtrl'
            }
        },
        authenticate: true
    });
}])

.controller('ProfileCtrl', function($scope, $state, $stateParams, $blockUI, authService, profileFactory) {

    $scope.title = '';
    $scope.user = {};
    $scope.profile = {};
    $scope.secret = '';

    var getUserDetails = function() {
        $blockUI.start();

        authService.getUserInfo().then(function(result) {
            profileFactory.getProfile(function(err, profile) {
                if (err) {
                    console.log('error', err);
                    $blockUI.stop();
                    return;
                }

                $scope.profile = profile;
                $scope.user = result;
                $blockUI.stop();
            });
        }, function(msg) {
            $blockUI.stop();
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    $scope.closeSecretModal = function() {
        $scope.secret = '';
        $scope.showSecretModal = false;
    };

    $scope.changePassword = function() {
        $state.go('changePassword', {});
    };

    $scope.generateSecretKey = function() {
        profileFactory.getApiKey(function(err, secret) {
            if (err) {
                console.log('error', err);
                $blockUI.stop();
                return;
            }

            $scope.secret = secret;
            $scope.showSecretModal = true;
            $blockUI.stop();
        });

    };

    getUserDetails();

});
