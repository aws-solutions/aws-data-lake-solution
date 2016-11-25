'use strict';

describe('dataLake.cart spec', function() {

    var cartCtrl;
    var $scope;
    var $state;
    var $blockUI;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.utils'));
    beforeEach(module('dataLake.cart'));

    beforeEach(inject(function($controller, $rootScope, $_, _$state_, cartFactory) {
        $scope = $rootScope.$new(); //get a childscope

        $state = _$state_;
        spyOn($state, 'go');

        var cartItems = [{
            item_id: 1,
            name: 'test package',
            description: 'description for test item',
            cart_item_status: 'pending'
        }, {
            item_id: 2,
            name: 'generated package',
            description: 'description for generated item',
            cart_item_status: 'generated'
        }];

        spyOn(cartFactory, 'listCart').and.callFake(function(cb) {
            cb(null, cartItems); 
        });

        spyOn(cartFactory, 'getCartCount').and.callFake(function(cb) {
            cb(null, cartItems.length); 
        });

        spyOn(cartFactory, 'deleteCartItem').and.callFake(function(itemid, cb) {
            cartItems.splice(0, 1);
            cb(null, {});
        });

        spyOn(cartFactory, 'checkoutCart').and.callFake(function(type, cb) {
            cartItems[0].cart_item_status = 'generated';
            cb(null, 'manifest file generation initiated');
        });

        $blockUI = {
            start: function() {},
            stop: function() {}
        };

        cartCtrl = $controller('CartCtrl', {
            $scope: $scope,
            $state: $state,
            $blockUI: $blockUI,
            $_: $_,
            cartFactory: cartFactory
        }); //Pass it as argument as $scope's value
    }));

    describe('cart controller', function() {

        it('should be created', function() {
            //spec body
            expect(cartCtrl).toBeDefined();
            $scope.$apply();
            expect($scope.cart.length).toEqual(1);
            expect($scope.manifests.length).toEqual(1);
        });

        it('should remove an item when deleting cart item succeeds', function() {
            $scope.removeCartItem(1);
            $scope.$apply();
            expect($scope.cart.length).toEqual(0);
            expect($scope.manifests.length).toEqual(1);
        });

        it('should show manifest options when checking out succeeds', function() {
            $scope.checkout();
            $scope.$apply();
            expect($scope.showCheckoutModal).toEqual(true);
        });

        it('should initiate manifest creation after selecting check out options', function() {
            $scope.generateManifest('bucket-key');
            $scope.$apply();
            expect($scope.showCheckoutModal).toEqual(false);
            expect($scope.cart.length).toEqual(0);
            expect($scope.manifests.length).toEqual(2);
        });

    });
});
