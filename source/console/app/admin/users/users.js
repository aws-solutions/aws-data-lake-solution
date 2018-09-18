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

angular.module('dataLake.admin.users', ['dataLake.main', 'dataLake.utils', 'dataLake.factory.admin'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('admin_users', {
        url: '/admin/users',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@admin_users': {
                templateUrl: 'admin/users/users.html',
                controller: 'AdminUsersCtrl'
            }
        },
        adminAuthenticate: true,
        activeWithFederation: true
    });
}])

.filter('encodeURIComponent', function($window) {
    return $window.encodeURIComponent;
})

.controller('AdminUsersCtrl', function($scope, $state, $blockUI, adminUserFactory) {

    $scope.results = [];
    $scope.showerror = false;
    $scope.federatedLogin = FEDERATED_LOGIN;

    var getUsers = function() {
        $blockUI.start();
        adminUserFactory.listUsers(function(err, users) {
            if (err) {
                console.log('error', err);
                $scope.showerror = true;
                $blockUI.stop();
                return;
            }

            $scope.users = users;
            $blockUI.stop();
        });
    };

    $scope.refresh = function() {
        getUsers();
    };

    getUsers();

});
