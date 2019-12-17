/*********************************************************************************************************************
*  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
*                                                                                                                    *
*  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
*  with the License. A copy of the License is located at                                                             *
*                                                                                                                    *
*      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
*                                                                                                                    *
*  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
*  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
*  and limitations under the License.                                                                                *
*********************************************************************************************************************/

/**
 * @author Solution Builders
 */

'use strict';

angular.module('dataLake.utils', [])

.factory('$_', function() {
    return window._;
})

.factory('$blockUI', function($document) {
    return {
        start: function() {
            var _body = $document.find('body').eq(0);
            _body.addClass('block-ui-active block-ui-visible');
        },
        stop: function() {
            var _body = $document.find('body').eq(0);
            _body.removeClass('block-ui-active');
            _body.removeClass('block-ui-visible');
        }
    };
})

.factory('$localstorage', ['$window', function($window) {
    return {
        set: function(key, value) {
            $window.localStorage[key] = value;
        },
        remove: function(key) {
            $window.localStorage.removeItem(key);
        },
        get: function(key, defaultValue) {
            return $window.localStorage[key] || defaultValue;
        },
        setObject: function(key, value) {
            $window.localStorage[key] = JSON.stringify(value);
        },
        getObject: function(key) {
            return JSON.parse($window.localStorage[key] || '{}');
        }
    };
}]);
