'use strict';

describe('dataLake.search module', function () {

    var searchCtrl;
    var $scope;
    var $state;
    var $stateParams;
    var $sce;
    var $_;
    var $blockUI;

    beforeEach(module('ui.router'));
    beforeEach(module('dataLake.utils'));
    beforeEach(module('dataLake.main'));
    beforeEach(module('dataLake.search'));

    beforeEach(inject(function ($controller, $rootScope, $stateParams, searchFactory) {
        $scope = $rootScope.$new(); //get a childscope

        spyOn(searchFactory, 'search').and.callFake(function (terms, cb) {
            cb(null, [{
                name: 'test package',
                description: 'description for test item',
                updated_at: '2016-11-01T12:00:00Z'
            }]); 
        });

        $blockUI = {
            start: function() {},
            stop: function( ) {} 
        };  

        searchCtrl = $controller('SearchCtrl', {
            $scope: $scope,
            $state: $state,
            $stateParams: $stateParams,
            $sce: $sce,
            $_: $_,
            $blockUI: $blockUI,
            searchFactory: searchFactory
        }); //Pass it as argument as $scope's value
    }));

    describe('search controller', function() {
 
        it('should be created', function() {
            expect(searchCtrl).toBeDefin ed();
        });

        it('should return results when searching', function() {
            $scope.search('myterm'); 
            expect($scope.results[0]).toEqual({
                name: 'test package [ 11/1/2016 08:00:00 AM ]',
                description: 'description for test item',
                updated_at: '2016-11-01T12:00:00Z'
            });
        });

    });
});
