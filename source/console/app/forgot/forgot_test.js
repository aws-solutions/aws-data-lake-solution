'use strict';

describe('dataLake.forgot module', function() {

    var forgotCtrl;
    var $scope;
    var $state;
    var $q;
    var deferred;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.forgot'));
    beforeEach(module('dataLake.service.auth'));

    beforeEach(inject(function($controller, $rootScope, _$q_, _$state_, authService) {
        $scope = $rootScope.$new(); //get a childscope

        $state = _$state_;
        spyOn($state, 'go');

        $q = _$q_;
        deferred = _$q_.defer();
        spyOn(authService, 'forgot').and.returnValue(deferred.promise);
        spyOn(authService, 'resetPassword').and.returnValue(deferred.promise);

        forgotCtrl = $controller("ForgotCtrl", {
            $scope: $scope,
            $state: $state,
            authService: authService
        }); //Pass it as argument as $scope's value
    }));

    describe('forgot controller', function() {

        it('should be created', function() {
            //spec body
            expect(forgotCtrl).toBeDefined();
        });

        it('should initiate congnito email when forgot password', function() {
            $scope.forgotPassword({
                email: 'user@amazon.com'
            }, true);
            deferred.resolve();
            $scope.$apply();
            expect($scope.showVerification).toEqual(true);
        });

        it('should show error when forgot password fails', function() {
            $scope.forgotPassword({
                email: 'user@amazon.com'
            }, true);
            deferred.reject();
            $scope.$apply();
            expect($scope.errormessage).toEqual(
                'An unexpected error has occurred. Please try again.');
        });

        it('should go to signin after changing password', function() {
            $scope.changePassword({
                email: 'user@amazon.com',
                verificationCode: '12345',
                password: 'test123&*2'
            }, true);
            deferred.resolve();
            $scope.$apply();
            expect($state.go).toHaveBeenCalledWith('signin', {});
        });

        it('should show error when changing password fails', function() {
            $scope.changePassword({
                email: 'user@amazon.com',
                verificationCode: '12345',
                password: 'test123&*2'
            }, true);
            deferred.reject();
            $scope.$apply();
            expect($scope.errormessage).toEqual(
                'An unexpected error has occurred. Please try again.');
        });

    });
});
