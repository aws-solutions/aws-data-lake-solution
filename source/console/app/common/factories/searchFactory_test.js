'use strict';

describe('dataLake.factory.search spec', function() {

    var searchFactory;
    var $resource;
    var $state;
    var $q;
    var deferred;
    var $httpBackend;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.factory.search'));

    beforeEach(inject(function($injector, _$q_, _$state_, authService) {
        $state = _$state_;
        spyOn($state, 'go');

        $httpBackend = $injector.get('$httpBackend');

        $q = _$q_;
        deferred = _$q_.defer();
        spyOn(authService, 'getUserAccessToken').and.returnValue(deferred.promise);

        searchFactory = $injector.get('searchFactory', {
            $resource: $resource,
            $state: $state,
            authService: authService
        }); //Pass it as argument as $scope's value

    }));

    describe('search factory', function() {

        it('should be created', function() {
            expect(searchFactory).toBeDefined();
        });

        it('should return results when searched', function() {
            var _url = [APIG_ENDPOINT, '/search?term=test'].join('');
            $httpBackend.expectGET(_url).respond({
                Items: [{
                    name: 'test package',
                    description: 'description for test item'
                }]
            });

            var observer = {
                result: {},
                callback: function(data) {
                    this.result = data;
                }
            };

            searchFactory.search('test', function(err, data) {
                observer.callback(data);
            });

            deferred.resolve({
                token: 'test-token'
            });

            $httpBackend.flush();

            // expect(result.username).toEqual('test');
            expect(observer.result[0]).toEqual({
                name: 'test package',
                description: 'description for test item'
            });
        });

    });
});
