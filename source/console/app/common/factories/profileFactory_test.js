'use strict';

describe('dataLake.factory.profile spec', function() {

    var profileFactory;
    var $resource;
    var $state;
    var $q;
    var deferred;
    var $httpBackend;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.factory.profile'));

    beforeEach(inject(function($injector, _$q_, _$state_, authService) {
        $state = _$state_;
        spyOn($state, 'go');

        $httpBackend = $injector.get('$httpBackend');

        $q = _$q_;
        deferred = _$q_.defer();
        spyOn(authService, 'getUserAccessToken').and.returnValue(deferred.promise);

        profileFactory = $injector.get('profileFactory', {
            $resource: $resource,
            $state: $state,
            authService: authService
        }); //Pass it as argument as $scope's value

    }));

    describe('profile factory', function() {

        it('should be created', function() {
            expect(profileFactory).toBeDefined();
        });

        it('should return user profile information', function() {
            var _url = [APIG_ENDPOINT, '/profile'].join('');
            $httpBackend.expectGET(_url).respond({
                hostname: 'faketest.amazon.com'
            });

            var observer = {
                result: {},
                callback: function(data) {
                    this.result = data;
                }
            };

            profileFactory.getProfile(function(err, data) {
                observer.callback(data);
            });

            deferred.resolve({
                token: 'test-token'
            });

            $httpBackend.flush();
            expect(observer.result.hostname).toEqual('faketest.amazon.com');
        });

        it('should create secret access key', function() {
            var _url = [APIG_ENDPOINT, '/profile/apikey'].join('');
            $httpBackend.expectGET(_url).respond({
                key: 'fakesecretaccesskey'
            });

            var observer = {
                result: {},
                callback: function(data) {
                    this.result = data;
                }
            };

            profileFactory.getApiKey(function(err, data) {
                observer.callback(data);
            });

            deferred.resolve({
                token: 'test-token'
            });

            $httpBackend.flush();
            expect(observer.result.key).toEqual('fakesecretaccesskey');
        });

    });
});
