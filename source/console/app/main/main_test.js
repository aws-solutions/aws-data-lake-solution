'use strict';

describe('dataLake.main module', function() {

    var mainCtrl;
    var mockDataSrv;
    var $scope;
    var $state;
    var $q;
    var $location;
    var authDeferred;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.utils'));
    beforeEach(module('dataLake.main'));

    beforeEach(inject(function($controller, $rootScope, _$state_, _$q_, authService, cartFactory) {
        $scope = $rootScope.$new(); //get a childscope

        $state = _$state_;
        spyOn($state, 'go');

        $q = _$q_;
        authDeferred = _$q_.defer();
        spyOn(authService, 'getUserInfo').and.returnValue(authDeferred.promise);
        spyOn(authService, 'signOut').and.returnValue(authDeferred.promise);

        spyOn(cartFactory, 'getCartCount').and.callFake(function(cb) {
            cb(null, 0); 
        });

        mainCtrl = $controller('MainCtrl', {
            $scope: $scope,
            $state: $state,
            $location: $location,
            $rootScope: $rootScope,
            authService: authService,
            cartFactory: cartFactory
        });
    }));

    describe('main controller', function() {

        it('should be created', function() {
            authDeferred.resolve({
                email: 'user@amazon.com',
                name: 'User Name',
                username: 'user_amazon_com',
                display_name: 'User Name'
            });
            expect(mainCtrl).toBeDefined();
            $scope.$apply();
            expect($scope.username).toEqual('User Name');
            expect($scope.cartCount).toEqual(0);
        });

        it('should change state to signin when selecting to sign out', function() {
            authDeferred.resolve(true);
            $scope.signout();
            expect($state.go).toHaveBeenCalledWith('signin', {});

        });

    });
});
