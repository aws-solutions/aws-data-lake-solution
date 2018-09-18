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

angular.module('dataLake.cart', ['dataLake.main', 'dataLake.utils', 'dataLake.factory.cart'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('cart', {
        url: '/cart',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@cart': {
                templateUrl: 'cart/cart.html',
                controller: 'CartCtrl'
            }
        },
        authenticate: true,
        activeWithFederation: true
    });
}])

.controller('CartCtrl', function($scope, $state, $blockUI, $_, cartFactory) {

    $scope.cart = [];
    $scope.manifests = [];
    $scope.showerror = false;
    $scope.tabs = [{
        label: 'My Cart',
        id: 'tab_pending'
    }, {
        label: 'My Manifests',
        id: 'tab_manifests'
    }];
    $scope.currentTab = 'tab_pending';
    $scope.manifestType = 'signed-url';
    $scope.showCheckoutModal = false;

    var getCart = function() {
        $blockUI.start();
        cartFactory.listCart(function(err, cart) {
            if (err) {
                console.log('error', err);
                $scope.showerror = true;
                $blockUI.stop();
                return;
            }

            $scope.cart = $_.filter(cart, function(o) {
                return o.cart_item_status === 'pending' ||
                    o.cart_item_status === 'unable_to_process';
            });

            $scope.manifests = $_.where(cart, {
                cart_item_status: 'generated'
            });

            $scope.tabs = [{
                label: ['My Cart', '(', $scope.cart.length, ')'].join(' '),
                id: 'tab_pending'
            }, {
                label: ['My Manifests', '(', $scope.manifests.length, ')'].join(' '),
                id: 'tab_manifests'
            }];

            $blockUI.stop();
        });
    };

    $scope.removeCartItem = function(itemid) {
        $blockUI.start();
        cartFactory.deleteCartItem(itemid, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showerror = true;
                $blockUI.stop();
                getCart();
                return;
            }

            cartFactory.getCartCount(function(err, data) {
                if (err) {
                    console.log('error', err);
                    $scope.showError = true;
                    $scope.errorMessage =
                        'An unexpected error occurred when attempting to retrieve your updated cart items.';
                    $blockUI.stop();
                    return;
                }

                getCart();
            });

        });
    };

    $scope.refresh = function() {
        getCart();
    };

    $scope.checkout = function() {
        $scope.showCheckoutModal = true;
    };

    $scope.closeCheckoutModal = function() {
        $scope.manifestType = 'signed-url';
        $scope.showCheckoutModal = false;
    };

    $scope.generateManifest = function(type) {
        $scope.showCheckoutModal = false;
        $blockUI.start();
        cartFactory.checkoutCart(type, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showerror = true;
                $blockUI.stop();
                getCart();
                return;
            }

            cartFactory.getCartCount(function(err, data) {
                getCart();
            });
        });
    };

    getCart();

});
