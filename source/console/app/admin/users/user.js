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
        adminAuthenticate: true,
        activeWithFederation: true
    });
}])

.controller('AdminUserCtrl', function($scope, $state, $stateParams, $blockUI, $q, adminUserFactory, adminApiKeysFactory, adminGroupFactory) {

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

    $scope.groups = {};
    $scope.groups['all'] = false;
    $scope.groups['groups'] = {};

    $scope.federatedLogin = FEDERATED_LOGIN;

    var getUserDetails = function() {
        $blockUI.start();

        $q.all([
            getUser($stateParams.user_id),
            getUserApiKeys($stateParams.user_id),
            listGroups(),
            getUserGroups($stateParams.user_id)
        ])
        .then(values => {
            let user = values[0];
            if (!user || user.errorMessage) {
                console.log('error', err);
                $scope.user_found = false;
                $blockUI.stop();
                return;
            }

            $scope.user = user;
            $scope.title = ['User:', user.display_name].join(' ');
            $scope.subtitle = 'Manage the data lake user by enabling, disabling and set the user\'s role.';
            $scope.tabs[1].disabled = !user.enabled;
            $scope.api_access = values[1];

            let groups = values[2];
            let membershipList = values[3];
            if (membershipList.length > 0) {
                let allSelected = true;
                let processMembershipList = Object.keys(groups).map(function(key, index) {
                    if (membershipList.indexOf(key) > -1) {
                        groups[key].visible = true;
                    } else {
                        allSelected = false;
                    }
                });
                $q.all(processMembershipList).then(function(results) {
                    $scope.groups['all'] = allSelected;
                    $scope.groups['groups'] = groups;
                    console.log('getUserDetails - End');
                    $blockUI.stop();
                });
            } else {
                $scope.groups['groups'] = groups;
                console.log('getUserDetails - End');
                $blockUI.stop();
            }
        })
        .catch(function(err) {
            console.log('error', err);
            $scope.user_found = false;
            $blockUI.stop();
        });
    };

    var getUser = function(userId) {
        var deferred = $q.defer();
        adminUserFactory.getUser(userId, function(err, user) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(user);
            }
        });
        return deferred.promise;
    };

    var getUserApiKeys = function(userId) {
        var deferred = $q.defer();
        adminApiKeysFactory.getUserApiKeys(userId, function(err, keys) {
            if (err) {
                deferred.resolve(null);
            } else {
                deferred.resolve(keys);
            }
        });
        return deferred.promise;
    };

    var listGroups = function() {
        var deferred = $q.defer();
        adminGroupFactory.listGroups(function(err, data) {
            if (err) {
                deferred.resolve({});
            } else {
                var groups = {};
                let processGroups = data.Groups.map(function(group) {
                    groups[group.GroupName] = {name: group.GroupName, visible: false};
                });
                Promise.all(processGroups).then(function(results) {
                    deferred.resolve(groups);
                });
            }
        });
        return deferred.promise;
    };

    var getUserGroups = function(userId) {
        var deferred = $q.defer();

        adminGroupFactory.getUserGroups(userId, function(err, data) {
            if (err) {
                deferred.resolve([]);
            } else {
                Promise.all(
                    data.Groups.map(function(group) {
                        return group.GroupName;
                    })
                ).then(function(groupNames) {
                    deferred.resolve(groupNames);
                });
            }
        });

        return deferred.promise;
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
                    'An unexpected error occurred when attempting to delete the user. \n', err
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
                    'An unexpected error occurred when attempting to', operation, 'the user. \n',
                    err
                ].join('');
                $blockUI.stop();
                return;
            }

            var groupSet = [];
            let processGroups = Object.keys($scope.groups['groups']).map(function(group) {
                if ($scope.groups['all'] || $scope.groups['groups'][group].visible) {
                    groupSet.push(group);
                }
            });
            Promise.all(processGroups).then(function(results) {
                adminGroupFactory.updateUserMembership($stateParams.user_id, groupSet, function(err, data) {
                    if (err) {
                        console.log('error', err);
                    }
                    console.log('ok', data);
                    getUserDetails();
                });
            });
        });
    };

    $scope.generateAccessKey = function() {
        $blockUI.start();
        adminApiKeysFactory.createApiKey($stateParams.user_id, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.showErrorMessage = [
                    'An unexpected error occurred when attempting to create the api key. \n', err
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
                    'An unexpected error occurred when attempting to delete the user api key. \n',
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
                    'An unexpected error occurred when attempting to inactivate the user api key. \n',
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
                    'An unexpected error occurred when attempting to activate the user api key. \n',
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
