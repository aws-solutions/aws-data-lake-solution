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

angular.module('dataLake.factory.cart', ['ngResource', 'dataLake.utils', 'dataLake.service.auth'])

.factory('cartFactory', function($resource, $_, $state, authService) {

    var factory = {};

    var cartResource = function(token) {
        var _url = [APIG_ENDPOINT, 'cart'].join('/');
        return $resource(_url, {}, {
            query: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            },
            checkout: {
                method: 'POST',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var cartItemResource = function(token) {
        var _url = [APIG_ENDPOINT, 'cart/:itemId'].join('/');
        return $resource(_url, {
            itemId: '@itemId'
        }, {
            get: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            },
            create: {
                method: 'POST',
                headers: {
                    Auth: token
                }
            },
            remove: {
                method: 'DELETE',
                headers: {
                    Auth: token
                }
            }
        });
    };

    factory.cartCount = 0;

    factory.getCartCount = function(cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            cartResource(_token).query({}, function(data) {
                var _cart = $_.filter(data.Items, function(o) {
                    return o.cart_item_status === 'pending' ||
                        o.cart_item_status === 'unable_to_process';
                });

                factory.cartCount = _cart.length;
                return cb(null, _cart.length);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    factory.checkoutCart = function(manifestType, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            cartResource(_token).checkout({}, {
                operation: 'checkout',
                format: manifestType
            }, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    factory.listCart = function(cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            cartResource(_token).query({}, function(data) {
                return cb(null, data.Items);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    factory.getCartItem = function(itemid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            cartItemResource(_token).get({
                itemId: itemid
            }, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data.Item);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    factory.createCartItem = function(newitem, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            cartItemResource(_token).create({
                itemId: 'new'
            }, newitem, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    factory.deleteCartItem = function(itemid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            cartItemResource(_token).remove({
                itemId: itemid
            }, function(data) {
                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    factory.deletePackage = function(packageId, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            cartResource(_token).query({}, function(data) {
                for (var i = 0; i < data.Items.length; i++) {
                    if (data.Items[i].package_id === packageId) {
                        cartItemResource(_token).remove({
                            itemId: data.Items[i].item_id

                        }, function(data) {
                            cartResource(_token).query({}, function(data) {
                                var _cart = $_.filter(data.Items, function(o) {
                                    return o.cart_item_status === 'pending' || o.cart_item_status === 'unable_to_process';
                                });

                                factory.cartCount = _cart.length;
                                return cb(null, null);

                            }, function(err) {
                                return cb(err, null);
                            });
                        }, function(err) {
                            return cb(err, null);
                        });
                    }
                }
                return cb(null, null);

            }, function(err) {
                return cb(err, null);
            });

        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    return factory;

});
