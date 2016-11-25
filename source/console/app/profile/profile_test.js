'use strict';

describe('dataLake.profile module', function() {

    var profileCtrl;
    var $scope;
    var $state;
    var $stateParams;
    var $blockUI;
    var $q;
    var authDeferred;
    var profileDeferred;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.utils'));
    beforeEach(module('dataLake.main'));
    beforeEach(module('dataLake.profile'));

    beforeEach(inject(function($controller, $rootScope, _$q_, _$state_, authService, profileFactory) {
        $scope = $rootScope.$new(); //get a childscope

        $state = _$state_;
        spyOn($state, 'go');

        $q = _$q_;
        authDeferred = _$q_.defer();
        spyOn(authService, 'getUserInfo').and.returnValue(authDeferred.promise);
        spyOn(profileFactory, 'getProfile').and.callFake(function(cb) {
            cb(null, {
                hostname: 'faketest.amazon.com'
            }); 
        });

        spyOn(profileFactory, 'getApiKey').and.callFake(function(cb) {
            cb(null, {
                key: 'fakesecretaccesskey'
            }); 
        });

        $blockUI = {
            start: function() {},
            stop: function() {}
        };

        profileCtrl = $controller('ProfileCtrl', {
            $scope: $scope,
            $state: $state,
            $stateParams: $stateParams,
            $blockUI: $blockUI,
            authService: authService,
            profileFactory: profileFactory
        }); //Pass it as argument as $scope's value

    }));

    describe('profile controller', function() {

        it('should be created', function() {

            expect(profileCtrl).toBeDefined();
            authDeferred.resolve({
                email: 'user@amazon.com',
                name: 'User Name',
                username: 'user_amazon_com',
                display_name: 'User Name'
            });

            $scope.$apply();
            expect($scope.user.email).toEqual('user@amazon.com');
            expect($scope.user.username).toEqual('user_amazon_com');
            expect($scope.user.display_name).toEqual('User Name');
        });

        it('should change state to changePassword when selecting to change password', function() {

            $scope.changePassword();
            expect($state.go).toHaveBeenCalledWith('changePassword', {});

        });

        it('should generate a secret access key', function() {

            $scope.generateSecretKey();
            expect($scope.secret.key).toEqual('fakesecretaccesskey');

        });

    });
});
