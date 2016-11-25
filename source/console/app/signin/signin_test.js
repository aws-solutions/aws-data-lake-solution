'use strict';

describe('dataLake.signin spec', function() {

    var signinCtrl;
    var $scope;
    var $state;
    var $q;
    var deferred;
    var $blockUI;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.signin'));
    beforeEach(module('dataLake.service.auth'));

    beforeEach(inject(function($controller, $rootScope, _$state_, _$q_, authService) {
        $scope = $rootScope.$new(); //get a childscope

        $state = _$state_;
        spyOn($state, 'go');

        $q = _$q_;
        deferred = _$q_.defer();
        spyOn(authService, 'signin').and.returnValue(deferred.promise);

        $blockUI = {
            start: function() {},
            stop: function() {}
        };

        signinCtrl = $controller('SigninCtrl', {
            $scope: $scope,
            $state: $state,
            authService: authService,
            $blockUI: $blockUI
        }); //Pass it as argument as $scope's value
    }));

    describe('signin controller', function() {

        it('can get an instance of SigninCtrl', function() {
            //spec body
            expect(signinCtrl).toBeDefined();
        });

        it('should go to confirm state when password change required', function() {
            $scope.signin({
                email: 'user@amazon.com',
                password: 'password'
            }, true);
            deferred.resolve({
                state: 'new_password_required'
            });
            $scope.$apply();
            expect($state.go).toHaveBeenCalledWith('confirm', {
                email: 'user@amazon.com',
                password: 'password'
            });
        });

    });
});
