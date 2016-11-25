/*********************************************************************************************************************
 *  Copyright 2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance        *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://aws.amazon.com/asl/                                                                                    *
 *                                                                                                                    *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/**
 * @author Solution Builders
 */

'use strict';

angular.module('dataLake.search', ['dataLake.main', 'dataLake.utils', 'dataLake.factory.search'])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('search', {
        url: '/search',
        params: {
            terms: null
        },
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@search': {
                templateUrl: 'search/search.html',
                controller: 'SearchCtrl'
            }
        },
        authenticate: true
    });
}])

.controller('SearchCtrl', function($scope, $state, $stateParams, $resource, $sce, $_, $blockUI, searchFactory) {

    $scope.results = [];
    $scope.searchString = '';
    $scope.no_results = true;
    $scope.showSearchError = false;

    var replaceIndex = function(s, at, length, repl) {
        return s.substr(0, at) + repl + s.substr(at + length, s.length);
    };

    var markResultsText = function(data, terms) {
        var _terms = terms.split(',');
        for (var i = 0; i < data.length; i++) {
            for (var k = 0; k < _terms.length; k++) {
                if (_terms[k].trim() !== '*') {
                    var searchMask = _terms[k].replace(/ /g, '');
                    var regEx = new RegExp(searchMask, 'ig');
                    var resArray;

                    var _replaceIndexes = [];
                    while ((resArray = regEx.exec(data[i].description)) !== null) {
                        _replaceIndexes.push({
                            textIndex: regEx.lastIndex - resArray[0].length,
                            text: resArray[0]
                        });
                    }

                    var _replaceIndexesName = [];
                    while ((resArray = regEx.exec(data[i].name)) !== null) {
                        _replaceIndexesName.push({
                            textIndex: regEx.lastIndex - resArray[0].length,
                            text: resArray[0]
                        });
                    }

                    var _reversed = _replaceIndexes.reverse();
                    for (var j = 0; j < _reversed.length; j++) {
                        var replaceMask = ['<>', _reversed[j].text, '</>'].join('');
                        data[i].description = replaceIndex(data[i].description, _reversed[j].textIndex,
                            _reversed[j].text.length, replaceMask);
                    }

                    _reversed = _replaceIndexesName.reverse();
                    for (var j = 0; j < _reversed.length; j++) {
                        var replaceMask = ['<>', _reversed[j].text, '</>'].join('');
                        data[i].name = replaceIndex(data[i].name, _reversed[j].textIndex,
                            _reversed[j].text.length, replaceMask);
                    }
                }
            }

            data[i].description = data[i].description.replace(new RegExp('<>', 'ig'),
                '<span class="awsui-label-content awsui-label-type-warning">');
            data[i].description = data[i].description.replace(new RegExp('</>', 'ig'),
                '</span>');
            data[i].name = data[i].name.replace(new RegExp('<>', 'ig'),
                '<span class="awsui-label-content awsui-label-type-warning">'
            );
            data[i].name = data[i].name.replace(new RegExp('</>', 'ig'),
                '</span>');
            data[i].name = [data[i].name, '[', moment(data[i].updated_at).format('M/D/YYYY hh:mm:ss A'), ']'].join(
                ' ');
        }
    };

    var searchPackages = function(terms) {
        $blockUI.start();
        searchFactory.search(terms, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.no_results = true;
                $scope.showSearchError = true;
                $blockUI.stop();
                return;
            }

            $scope.results = data;

            if (data.length > 0) {
                $scope.no_results = false;
                markResultsText(data, terms);
            } else {
                $scope.no_results = true;
            }

            $blockUI.stop();

        });

    };

    $scope.trustSnippet = function(snippet) {
        return $sce.trustAsHtml(snippet);
    };

    $scope.search = function(terms) {
        if (terms.trim() !== '') {
            $scope.searchString = terms;
            searchPackages(terms);
        }
    };

    if ($stateParams.terms) {
        $scope.search.terms = $stateParams.terms;
        $scope.searchString = $stateParams.terms;
        searchPackages($stateParams.terms);
    }

});
