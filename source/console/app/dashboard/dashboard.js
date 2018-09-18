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

angular.module('dataLake.dashboard', ['dataLake.main', 'dataLake.utils'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('dashboard', {
        url: '/dashboard',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@dashboard': {
                templateUrl: 'dashboard/dashboard.html',
                controller: 'DashboardCtrl'
            }
        },
        authenticate: true,
        activeWithFederation: true
    });
}])

.controller('DashboardCtrl', function($scope, $state, $localstorage, $blockUI, searchFactory) {

    $scope.showIntroModal = false;
    $scope.currentSlide = 0;
    $scope.slideTitle = 'Welcome to the Data Lake Solution';
    $scope.navText = 'Next';
    $scope.ownedPackages = 0;
    $scope.accessiblePackages = 0;

    var loadStats = function() {
        $blockUI.start();

        searchFactory.stats(function(err, stats) {
            $scope.ownedPackages = stats.owned_packages;
            $scope.accessiblePackages = stats.accessible_packages;
            $blockUI.stop();
        });
    };

    $scope.search = function(terms) {
        $state.go('search', {
            terms: terms
        });
    };

    $scope.nextIntroSlide = function() {
        $scope.currentSlide++;
        switch ($scope.currentSlide) {
            case 1:
                $scope.slideTitle = 'Secure, Durable and Highly-Scalable';
                break;
            case 2:
                $scope.slideTitle = 'Upload new data or link existing data';
                break;
            case 3:
                $scope.slideTitle = 'Get access to the data you\'re interested in';
                $scope.navText = 'Get Started';
                break;
            case 4:
                $localstorage.set('showIntro', 'false');
                $scope.showIntroModal = false;
                break;
            default:
                break;
        }
    };

    if ($localstorage.get('showIntro', 'true') === 'true') {
        $scope.showIntroModal = true;
    }

    loadStats();
});
