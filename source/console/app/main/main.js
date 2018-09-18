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

angular.module('dataLake.main', ['dataLake.factory.cart'])

.controller('MainCtrl', function($scope, $state, $location, $rootScope, authService, cartFactory) {

    $scope.username = '';
    $scope.cartCount = 0;
    $scope.showadmin = false;
    $scope.showUsers = false;
    $scope.showGroups = false;

    authService.getUserInfo().then(function(result) {
        $rootScope.username = result.display_name;
        $scope.username = $rootScope.username;
        if (result.role.toLowerCase() !== 'admin') {
            var myEl = angular.element(document.querySelector('#adminMenu'));
            myEl.empty();
        } else {
            $scope.showadmin = true;
            $scope.showUsers = true;
            $scope.showGroups = !FEDERATED_LOGIN;
        }
    }, function(msg) {
        console.log('Unable to retrieve the user session.');
        $state.go('signin', {});
    });

    $scope.$watch(function() {
        return cartFactory.cartCount;
    }, function(NewValue, OldValue) {
        $scope.cartCount = NewValue;
        if ($scope.$$phase != '$digest') {
            $scope.$apply();
        }
    });

    cartFactory.getCartCount(function(err, count) {
        if (err) {
            console.log('error', err);
            return;
        }
    });

    $scope.getMenuClass = function(path) {
        return ($location.path().substr(0, path.length) === path) ? 'active' : '';
    };

    $scope.signout = function() {
        if (authService.signOut()) {
            $state.go('signin', {});
        }
    };

});
