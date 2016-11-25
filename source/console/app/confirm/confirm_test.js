'use strict';

describe('dataLake.confirm module', function() {

    var confirmCtrl;
    var $scope;
    var $state;
    var $stateParams;
    var $q;
    var deferred;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.confirm'));
    beforeEach(module('dataLake.service.auth'));

    beforeEach(inject(function($controller, $rootScope, _$state_, _$q_, authService) {
        $scope = $rootScope.$new(); //get a childscope

        $state = _$state_;
        spyOn($state, 'go');

        $q = _$q_;
        deferred = _$q_.defer();
        spyOn(authService, 'signin').and.returnValue(deferred.promise);

        $stateParams = {
            email: 'user@amazon.com',
            password: 'test123**'
        };

        confirmCtrl = $controller('ConfirmCtrl', {
            $scope: $scope,
            $state: $state,
            $stateParams: $stateParams,
            authService: authService
        }); //Pass it as argument as $scope's value
    }));

    describe('confirm controller', function() {

        it('should be created', function() {
            //spec body
            expect(confirmCtrl).toBeDefined();
        });

        it('should update password when confirming new password succeeds', function() {
            $scope.setPassword({
                newPassword: 'test12312341234!!'
            }, true);
            deferred.resolve();
            $scope.$apply();
            expect($state.go).toHaveBeenCalledWith('dashboard', {});
        });

        it('should show error when confirming new password fails', function() {
            $scope.setPassword({
                newPassword: 'test12312341234!!'
            }, true);
            deferred.reject();
            $scope.$apply();
            expect($scope.errormessage).toEqual(
                'An unexpected error has occurred. Please try again.');
        });

    });
});
