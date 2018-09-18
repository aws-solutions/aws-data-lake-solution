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

angular.module('dataLake.admin.invitation', ['dataLake.main', 'dataLake.utils', 'dataLake.factory.admin'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('admin_invitation', {
        url: '/admin/invite',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@admin_invitation': {
                templateUrl: 'admin/users/invitation.html',
                controller: 'AdminInvitationCtrl'
            }
        },
        adminAuthenticate: true,
        activeWithFederation: false
    });
}])

.controller('AdminInvitationCtrl', function($scope, $state, $stateParams, $blockUI, adminInvitationFactory) {

    $scope.showCreateError = false;
    $scope.roles = [{
        value: 'Member',
        text: 'Member'
    }, {
        value: 'Admin',
        text: 'Admin'
    }];
    $scope.newinvite = {
        role: 'Member'
    };

    var _token = '';

    $scope.createInvitation = function(newinvite, isValid) {
        $blockUI.start();
        if (isValid) {
            adminInvitationFactory.createInvitation(newinvite, function(err,
                data) {
                if (err) {
                    console.log('error', err);
                    $scope.showCreateError = true;
                    $blockUI.stop();
                    return;
                }

                $state.go('admin_users', {});
            });
        } else {
            $scope.showCreateError = true;
            $blockUI.stop();
        }
    };

});
