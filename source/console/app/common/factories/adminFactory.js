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

angular.module('dataLake.factory.admin', ['ngResource', 'dataLake.utils', 'dataLake.service.auth'])

.factory('adminInvitationFactory', function($resource, $_, $state, authService) {

    var factory = {};

    var invitationsResource = function(token) {
        var _url = [APIG_ENDPOINT, 'admin/invitations'].join('/');
        return $resource(_url, {}, {
            create: {
                method: 'POST',
                headers: {
                    Auth: token
                }
            }
        });
    };

    factory.createInvitation = function(invitation, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            invitationsResource(_token).create({}, invitation, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    return factory;

})

.factory('adminUserFactory', function($resource, $_, $state, authService) {

    var factory = {};

    var usersResource = function(token) {
        var _url = [APIG_ENDPOINT, 'admin/users'].join('/');
        return $resource(_url, {}, {
            query: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var userResource = function(token) {
        var _url = [APIG_ENDPOINT, 'admin/users/:userId'].join('/');
        return $resource(_url, {
            userId: '@id'
        }, {
            get: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            },
            update: {
                method: 'PUT',
                headers: {
                    Auth: token
                }
            },
            remove: {
                method: 'DELETE',
                headers: {
                    Auth: token
                }
            }
        });
    };

    factory.listUsers = function(cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            usersResource(_token).query({}, function(data) {
                if (data.errorMessage) {
                    return cb(data.errorMessage, null);
                }

                return cb(null, data.Items);
            }, function(err) {
                console.log(err);
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.getUser = function(userid, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            userResource(_token).get({
                userId: userid
            }, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.updateUser = function(user, operation, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            userResource(_token).update({
                userId: user.username
            }, {
                user: user,
                operation: operation
            }, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.deleteUser = function(username, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            userResource(_token).remove({
                userId: username
            }, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    return factory;


})

.factory('adminSettingsFactory', function($resource, $_, $state, authService) {

    var factory = {};

    var configSettingsResource = function(token) {
        var _url = [APIG_ENDPOINT, 'admin/settings/config'].join('/');
        return $resource(_url, {}, {
            query: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            },
            update: {
                method: 'PUT',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var governance_resource = function(token) {
        var _url = [APIG_ENDPOINT, 'admin/settings/governance'].join('/');
        return $resource(_url, {}, {
            query: {
                method: 'GET',
                headers: {
                    'Auth': token
                }
            }
        });
    };

    var governanceSettingResource = function(token) {
        var _url = [APIG_ENDPOINT, 'admin/settings/governance/:settingId'].join('/');
        return $resource(_url, {
            settingId: '@id'
        }, {
            get: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            },
            create: {
                method: 'POST',
                headers: {
                    Auth: token
                }
            },
            update: {
                method: 'PUT',
                headers: {
                    Auth: token
                }
            },
            remove: {
                method: 'DELETE',
                headers: {
                    Auth: token
                }
            }
        });
    };

    factory.listConfigSettings = function(cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            configSettingsResource(_token).query({}, function(data) {
                if (data.errorMessage) {
                    return cb(data.errorMessage, null);
                }

                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }
                return cb(null, data.Item);
            }, function(err) {
                console.log(err);
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.updateConfigSettings = function(config, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            configSettingsResource(_token).update({}, config, function(data) {
                if (data.errorMessage) {
                    return cb(data.errorMessage, null);
                }

                return cb(null, data);
            }, function(err) {
                console.log(err);
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.listGovernanceSettings = function(cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            governance_resource(_token).query({}, function(data) {
                if (data.errorMessage) {
                    return cb(data.errorMessage, null);
                }

                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data.Items);
            }, function(err) {
                console.log(err);
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.getGovernanceSetting = function(settingId, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            governanceSettingResource(_token).get({
                settingId: settingId
            }, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data.Item);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.createGovernanceSetting = function(setting, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            governanceSettingResource(_token).create({
                settingId: 'new'
            }, setting, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.updateGovernanceSetting = function(setting, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            governanceSettingResource(_token).update({
                settingId: setting.setting_id
            }, setting, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.deleteGovernanceSetting = function(settingId, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            governanceSettingResource(_token).remove({
                settingId: settingId
            }, function(data) {
                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    return factory;


})

.factory('adminApiKeysFactory', function($resource, $_, $state, authService) {

    var factory = {};

    var apikeysResource = function(token) {
        var _url = [APIG_ENDPOINT, 'admin/apikeys'].join('/');
        return $resource(_url, {}, {
            get: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var apikeyResource = function(token) {
        var _url = [APIG_ENDPOINT, 'admin/apikeys/:apiKeyId'].join('/');
        return $resource(_url, {
            apiKeyId: '@id'
        }, {
            get: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            },
            create: {
                method: 'POST',
                headers: {
                    Auth: token
                }
            },
            update: {
                method: 'PUT',
                headers: {
                    Auth: token
                }
            },
            remove: {
                method: 'DELETE',
                headers: {
                    Auth: token
                }
            }
        });
    };

    factory.getUserApiKeys = function(userid, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            apikeysResource(_token).get({
                user_id: userid
            }, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data.Items);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.getApiKey = function(apiKeyId, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            apikeyResource(_token).get({
                apiKeyId: apiKeyId
            }, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data.Item);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.createApiKey = function(userId, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            apikeyResource(_token).create({
                apiKeyId: 'new',
                user_id: userId
            }, {}, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.updateApiKey = function(apikey, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            apikeyResource(_token).update({
                apiKeyId: apikey.access_key_id
            }, apikey, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.deleteApiKey = function(apiKeyId, userId, cb) {
        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            apikeyResource(_token).remove({
                apiKeyId: apiKeyId,
                user_id: userId
            }, function(data) {
                return cb(null, data);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    return factory;

});
