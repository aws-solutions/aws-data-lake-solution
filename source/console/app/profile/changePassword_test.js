'use strict';

describe('dataLake.profile.changepassword module', function() {

    var changePasswordCtrl;
    var $scope;
    var $state;
    var $q;
    var $stateParams;
    var $blockUI;
    var deferred;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.utils'));
    beforeEach(module('dataLake.main'));
    beforeEach(module('dataLake.profile.changepassword'));

    beforeEach(inject(function($controller, $rootScope, _$q_, _$state_, authService) {
        $scope = $rootScope.$new(); //get a childscope

        $state = _$state_;
        spyOn($state, 'go');

        $q = _$q_;
        deferred = _$q_.defer();
        spyOn(authService, 'changePassword').and.returnValue(deferred.promise);

        $blockUI = {
            start: function() {},
            stop: function() {}
        };

        changePasswordCtrl = $controller('ChangePasswordCtrl', {
            $scope: $scope,
            $state: $state,
            $stateParams: $stateParams,
            $blockUI: $blockUI,
            authService: authService
        }); //Pass it as argument as $scope's value

    }));

    describe('changepassword controller', function() {

        it('should be created', function() {
            expect(changePasswordCtrl).toBeDefined();
            $scope.$digest();
        });

        it('should change password if change password called', function() {
            $scope.changePassword({
                oldPassword: 'test123',
                newPassword: '321test'
            }, true);
            deferred.resolve('password changed');
            $scope.$apply();
            expect($state.go).toHaveBeenCalledWith('profile', {});
        });

    });
});
