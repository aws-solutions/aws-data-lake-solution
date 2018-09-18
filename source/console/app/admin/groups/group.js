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

angular.module('dataLake.admin.group', ['dataLake.main', 'dataLake.utils', 'dataLake.factory.admin'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('admin_group', {
        url: '/admin/groups/:group_name',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@admin_group': {
                templateUrl: 'admin/groups/group.html',
                controller: 'AdminGroupCtrl'
            }
        },
        adminAuthenticate: true,
        activeWithFederation: false
    });
}])

.controller('AdminGroupCtrl', function($scope, $state, $stateParams, $blockUI, adminGroupFactory) {

    $scope.title = '';
    $scope.group = null;
    $scope.showDeleteModal = false;

    $scope.awsUiAlert = {}
    $scope.awsUiAlert.show = false;
    $scope.awsUiAlert.type = "";
    $scope.awsUiAlert.header = "";
    $scope.awsUiAlert.content = "";

    console.log(JSON.stringify($stateParams))

    var getGroupDetails = function() {
        $blockUI.start();

        adminGroupFactory.getGroup($stateParams.group_name, function(err, group) {
            if (err) {
                showErrorAlert(`Error ${err.data.code} - ${err.data.message}`);
                return;
            }

            $scope.group = group;
            $scope.title = ['Group:', group.GroupName].join(' ');
            if (group.UserList.length > 0) {
                $scope.subtitle = 'Manage the data lake group by updating user list and description.';
            } else {
                $scope.subtitle = 'Manage the data lake group by updating description.';
            }

            $blockUI.stop();
        });
    };

    $scope.removeGroup = function() {
        $scope.showDeleteModal = true;
    };

    $scope.closeDeleteModal = function() {
        $scope.showDeleteModal = false;
    };

    $scope.removeUserFromGroup = function(userId) {
        $blockUI.start();
        adminGroupFactory.removeUserFromGroup(userId, $stateParams.group_name, function(err, data) {
            if (err) {
                showErrorAlert(`Error ${err.data.code} - ${err.data.message}`);
                return;
            }

            showSuccessAlert(`User ${userId} removed from group.`);
            getGroupDetails();
        });
    };

    $scope.deleteGroup = function() {
        $blockUI.start();
        adminGroupFactory.deleteGroup($stateParams.group_name, function(err, data) {
            if (err) {
                showErrorAlert(`Error ${err.data.code} - ${err.data.message}`);
                return;
            }

            $state.go('admin_groups');
        });
    };

    $scope.updateGroup = function(operation) {
        $blockUI.start();
        adminGroupFactory.updateGroup($stateParams.group_name, $scope.group.Description, function(err, data) {
            if (err) {
                showErrorAlert(`Error ${err.data.code} - ${err.data.message}`);
                return;
            }

            showSuccessAlert(`Group ${$scope.group.GroupName} updated.`);
            getGroupDetails();
        });
    };

    $scope.dismissAwsUiAlert = function() {
        $scope.awsUiAlert.show = false;
        $scope.awsUiAlert.type = "";
        $scope.awsUiAlert.header = "";
        $scope.awsUiAlert.content = "";
    };

    var showSuccessAlert = function(message) {
        $scope.awsUiAlert.type = "success";
        $scope.awsUiAlert.header = "Success";
        $scope.awsUiAlert.content = message;
        $scope.awsUiAlert.show = true;
        $blockUI.stop();
    };

    var showErrorAlert = function(message) {
        $scope.awsUiAlert.type = "error";
        $scope.awsUiAlert.header = "Error";
        $scope.awsUiAlert.content = message;
        $scope.awsUiAlert.show = true;
        $blockUI.stop();
    };

    getGroupDetails();
});
