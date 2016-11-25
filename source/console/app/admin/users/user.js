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

angular.module('dataLake.admin.user', ['dataLake.main', 'dataLake.utils', 'dataLake.factory.admin'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('admin_user', {
        url: '/admin/users/:user_id',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@admin_user': {
                templateUrl: 'admin/users/user.html',
                controller: 'AdminUserCtrl'
            }
        },
        adminAuthenticate: true
    });
}])

.controller('AdminUserCtrl', function($scope, $state, $stateParams, $blockUI, adminUserFactory, adminApiKeysFactory) {

    $scope.user_found = true;
    $scope.title = '';
    $scope.roles = [{
        value: 'Member',
        text: 'Member'
    }, {
        value: 'Admin',
        text: 'Admin'
    }];
    $scope.tabs = [{
        label: 'Details',
        id: 'tab_details'
    }, {
        label: 'API Access',
        id: 'tab_apiaccess'
    }];
    $scope.currentTab = 'tab_details';
    $scope.showDeleteModal = false;
    $scope.api_access = [];
    $scope.showError = false;
    $scope.showErrorMessage = '';
    $scope.user_id = $stateParams.user_id;

    var getUserDetails = function() {
        $blockUI.start();

        adminUserFactory.getUser($stateParams.user_id, function(err, user) {
            if (err) {
                console.log('error', err);
                $scope.user_found = false;
                $blockUI.stop();
                return;
            }

            if (user && !user.errorMessage) {
                $scope.user = user;
                $scope.title = ['User:', user.display_name].join(' ');
                $scope.subtitle =
                    'Manage the data lake user by enabling, disabling and set the user\'s role.';
                $scope.tabs[1].disabled = !user.enabled;

                adminApiKeysFactory.getUserApiKeys($stateParams.user_id, function(err, keys) {
                    if (err) {
                        console.log('error', err);
                    }

                    $scope.api_access = keys;
                    $blockUI.stop();
                    return;
                });
            } else {
                $scope.user_found = false;
                $scope.title = 'User Not Found';
            }

            $blockUI.stop();
        });

    };

    $scope.removeUser = function() {
        $scope.showDeleteModal = true;
    };

    $scope.closeDeleteModal = function() {
        $scope.showDeleteModal = false;
    };

    $scope.deleteUser = function() {
        $blockUI.start();
        adminUserFactory.deleteUser($stateParams.user_id, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.showErrorMessage = [
                    'An unexpected error occured when attempting to delete the user. \n', err
                ].join('');
                $blockUI.stop();
                return;
            }

            $state.go('admin_users');
        });
    };

    $scope.updateUser = function(operation) {
        $blockUI.start();
        var _user = {
            username: $stateParams.user_id,
            role: $scope.user.role
        };

        adminUserFactory.updateUser(_user, operation, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.showErrorMessage = [
                    'An unexpected error occured when attempting to', operation, 'the user. \n', err
                ].join('');
                $blockUI.stop();
                return;
            }

            getUserDetails();
        });
    };

    $scope.generateAccessKey = function() {
        $blockUI.start();
        adminApiKeysFactory.createApiKey($stateParams.user_id, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.showErrorMessage = [
                    'An unexpected error occured when attempting to create the api key. \n', err
                ].join('');
                $blockUI.stop();
                return;
            }

            getUserDetails();
        });

    };

    $scope.deleteKey = function(index) {
        $blockUI.start();

        var _key = $scope.api_access[index];

        adminApiKeysFactory.deleteApiKey(_key.access_key_id, $stateParams.user_id, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.showErrorMessage = [
                    'An unexpected error occured when attempting to delete the user api key. \n',
                    err
                ].join('');
                $blockUI.stop();
                return;
            }

            getUserDetails();
        });

    };

    $scope.inactivateKey = function(index) {
        $blockUI.start();

        var _key = $scope.api_access[index];

        _key.key_status = 'Inactive';
        adminApiKeysFactory.updateApiKey(_key, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.showErrorMessage = [
                    'An unexpected error occured when attempting to inactivate the user api key. \n',
                    err
                ].join('');
                $blockUI.stop();
                return;
            }

            getUserDetails();
        });

    };

    $scope.activateKey = function(index) {
        $blockUI.start();

        var _key = $scope.api_access[index];

        _key.key_status = 'Active';
        adminApiKeysFactory.updateApiKey(_key, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.showErrorMessage = [
                    'An unexpected error occured when attempting to activate the user api key. \n',
                    err
                ].join('');
                $blockUI.stop();
                return;
            }

            getUserDetails();
        });
    };

    getUserDetails();

});
