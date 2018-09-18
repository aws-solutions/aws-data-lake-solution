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

angular.module('dataLake.admin.group.create', ['dataLake.main', 'dataLake.utils', 'dataLake.factory.admin'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('group', {
        url: '/admin/groups/create_group',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@group': {
                templateUrl: 'admin/groups/createGroup.html',
                controller: 'AdminCreateGroupCtrl'
            }
        },
        adminAuthenticate: true,
        activeWithFederation: false
    });
}])

.controller('AdminCreateGroupCtrl', function($scope, $state, $stateParams, $blockUI, adminGroupFactory) {

    $scope.awsUiAlert = {}
    $scope.awsUiAlert.show = false;
    $scope.awsUiAlert.type = "";
    $scope.awsUiAlert.header = "";
    $scope.awsUiAlert.content = "";

    $scope.showFormErrors = false;
    $scope.newGroup = {};
    var _token = '';

    $scope.createGroup = function(newGroup, isValid) {
        $blockUI.start();
        if (isValid) {
            $scope.showFormErrors = false;
            adminGroupFactory.createGroup(newGroup.name, newGroup.description, function(err, data) {
                if (err) {
                    showErrorAlert(`Error ${err.data.code} - ${err.data.message}`);
                    return;
                }

                console.log(JSON.stringify(data));
                $state.go('admin_groups', {});
            });
        } else {
            $scope.showFormErrors = true;
            $blockUI.stop();
        }
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

});
