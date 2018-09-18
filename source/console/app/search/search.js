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

angular.module(
    'dataLake.search',
    [
        'dataLake.main',
        'dataLake.utils',
        'dataLake.factory.search',
        'dataLake.factory.package',
        'dataLake.factory.cart'
    ]
)
.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('search', {
        url: '/search',
        params: {
            terms: null
        },
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@search': {
                templateUrl: 'search/search.html',
                controller: 'SearchCtrl'
            }
        },
        authenticate: true,
        activeWithFederation: true
    });
}])

.controller('SearchCtrl', function($scope, $state, $stateParams, $resource, $sce, $_, $blockUI, searchFactory, dataPackageFactory, cartFactory, authService) {

    $scope.results = [];
    $scope.searchString = '';

    $scope.awsUiAlert = {}
    $scope.awsUiAlert.show = false;
    $scope.awsUiAlert.criticalError = false;
    $scope.awsUiAlert.type = "";
    $scope.awsUiAlert.header = "";
    $scope.awsUiAlert.content = "";

    $scope.deleteModal = {};
    $scope.deleteModal.show = false;
    $scope.deleteModal.type = "";
    $scope.deleteModal.id = "";
    $scope.deleteModal.name = "";

    var searchPackages = function(terms) {
        $blockUI.start();
        $scope.closeDeleteModal();
        $scope.dismissAwsUiAlert();

        searchFactory.search(terms, function(err, data) {
            if (err) {
                $scope.results = [];
                console.log('searchFactory search error:', err);
                showErrorAlert('An unexpected error occurred when searching the data lake repository.');
                return;
            }

            $scope.searchString = terms;
            if (data.length > 0) {
                cartFactory.listCart(function(err, cart) {
                    if (err) {
                        $scope.results = [];
                        console.log('cartFactory listCart error:', err);
                        showErrorAlert('An unexpected error occurred when searching the data lake repository.');
                        return;
                    }

                    cart = $_.filter(cart, function(o) {
                        return o.cart_item_status === 'pending' || o.cart_item_status === 'unable_to_process';
                    });

                    for (var i = 0; i < data.length; i++) {
                        data[i].updated_at_pretty = moment(data[i].updated_at).format('M/D/YYYY hh:mm:ss A');
                        data[i].created_at_pretty = moment(data[i].created_at).format('M/D/YYYY hh:mm:ss A');
                        data[i].cart_item = $_.findWhere(cart, { package_id: data[i].package_id });
                        data[i].cart_flag = data[i].cart_item ? true : false;
                    }

                    $scope.results = data;
                    $blockUI.stop();
                });
            } else {
                $scope.results = data;
                $blockUI.stop();
            }
        });
    };

    $scope.trustSnippet = function(snippet) {
        return $sce.trustAsHtml(snippet);
    };

    $scope.search = function(terms) {
        if (terms.trim() !== '') {
            searchPackages(terms);
        } else {
            $scope.results = [];
            $scope.searchString = '';
            showErrorAlert('Invalid search string.');
        }
    };

    $scope.deletePackage = function(packageId, packageName) {
        $scope.deleteModal.show = true;
        $scope.deleteModal.type = 'package';
        $scope.deleteModal.id = packageId;
        $scope.deleteModal.name = packageName;
    };

    $scope.closeDeleteModal = function() {
        $scope.deleteModal.show = false;
        $scope.deleteModal.type = '';
        $scope.deleteModal.id = '';
        $scope.deleteModal.name = '';
    };

    $scope.confirmDeleteModal = function() {
        $blockUI.start();
        $scope.dismissAwsUiAlert();

        if ($scope.deleteModal.type === 'package') {
            dataPackageFactory.deleteDataPackage($scope.deleteModal.id, function(err, resp) {
                $scope.closeDeleteModal();
                if (err) {
                    console.log('deleteDataPackage error', err);
                    showErrorAlert('An unexpected error occured when attempting to delete the package.');
                    return;
                }

                cartFactory.deletePackage($scope.deleteModal.id, function(err, data) {
                    if (err) {
                        console.log('cartFactory.deletePackage error:', err);
                    }

                    $scope.search($scope.search.terms);
                });
            });
        }
    };

    $scope.toggleCart = function(pkg) {
        if (pkg.cart_flag) {
            addToCart(pkg);
        } else {
            removeFromCart(pkg);
        }
    };

    var addToCart = function(pkg) {
        $blockUI.start();

        var _item = {
            package_id: pkg.package_id
        };
        cartFactory.createCartItem(_item, function(err, data) {
            if (err) {
                console.log('cartFactory.createCartItem error:', err);
                showErrorAlert('An unexpected error occurred when adding package to the cart.');
                return;
            }

            // Store cart item on package so that we know package is in cart
            pkg.cart_item = data;
            pkg.cart_flag = true;

            // This updates the cart count, shown top right in the badge
            cartFactory.getCartCount(function(err, data) {
                if (err) {
                    console.log('cartFactory.getCartCount error:', err);
                    showErrorAlert('An unexpected error occurred when adding package to the cart.');
                    return;
                }

                $blockUI.stop();
            });
        });
    };

    var removeFromCart = function(pkg) {
        $blockUI.start();

        cartFactory.deleteCartItem(pkg.cart_item.item_id, function(err, data) {
            if (err) {
                console.log('cartFactory.deleteCartItem error:', err);
                showErrorAlert('An unexpected error occurred when removing the package from cart.');
                return;
            }

            // Store cart item on package so that we know package is in cart
            pkg.cart_item = null;
            pkg.cart_flag = false;

            // This updates the cart count, shown top right in the badge
            cartFactory.getCartCount(function(err, data) {
                if (err) {
                    console.log('cartFactory.getCartCount error:', err);
                    showErrorAlert('An unexpected error occurred when removing the package from cart.');
                    return;
                }

                $blockUI.stop();
            });
        });
    };

    $scope.dismissAwsUiAlert = function() {
        $scope.awsUiAlert.show = false;
        $scope.awsUiAlert.criticalError = false;
        $scope.awsUiAlert.type = "";
        $scope.awsUiAlert.header = "";
        $scope.awsUiAlert.content = "";
    };

    var showSuccessAlert = function(message) {
        $scope.awsUiAlert.type = "success";
        $scope.awsUiAlert.header = "Success";
        $scope.awsUiAlert.content = message;
        $scope.awsUiAlert.show = true;
        $scope.awsUiAlert.criticalError = false;
        $blockUI.stop();
    };

    var showErrorAlert = function(message, critical = false) {
        $scope.awsUiAlert.type = "error";
        $scope.awsUiAlert.header = "Error";
        $scope.awsUiAlert.content = message;
        $scope.awsUiAlert.show = true;
        $scope.awsUiAlert.criticalError = critical;
        $scope.closeDeleteModal();
        $blockUI.stop();
    };

    if ($stateParams && $stateParams.terms) {
        $scope.search.terms = $stateParams.terms
        $scope.search($stateParams.terms);
    }
});
