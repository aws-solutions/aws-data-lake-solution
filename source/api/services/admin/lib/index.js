/*********************************************************************************************************************
 *  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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

/**
 * Lib
 */

let Group = require('./group.js');
let User = require('./user.js');
let Auth = require('./auth.js');
let Setting = require('./setting.js');
let ApiKey = require('./apikey.js');
let AccessLog = require('./access-log.js');
let AccessValidator = require('access-validator');
const servicename = 'data-lake-admin-service';

/**
 * Verifies user's authorization to execute requested action. If the request is
 * authorized, it is processed, otherwise a 401 unathorized result is returned
 * @param {JSON} event - Request event.
 * @param {respond~requestCallback} cb - The callback that handles the response.
 */
module.exports.respond = function(event, cb) {

    let _auth = new Auth();
    let _response = '';

    if (event.authcheck) {
        _auth.authorizeRequest(event, event.authcheck, function(err, ticket) {
            if (err) {
                return cb(null, {
                    auth_status: 'Unauthorized',
                    auth_status_reason: err
                });
            }

            cb(null, ticket);
        });
    } else if (event.resource === '/admin/users/{user_id}/forgotPassword' && event.httpMethod === 'POST') {
        let _ticket = {};
        processRequest(event, _ticket, cb);

    } else {
        let _accessValidator = new AccessValidator();
        let _authToken = _accessValidator.getAuthToken(event.headers);
        let _authPayload = {
            authorizationToken: _authToken
        };
        let _roles = ((event.resource === '/admin/groups' || event.resource === '/admin/users/{user_id}') && event.httpMethod === 'GET') ? ['admin', 'member'] : ['admin'];

        _auth.authorizeRequest(_authPayload, _roles, function(err, ticket) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                return cb(_response, null);
            }

            if (ticket.auth_status === 'authorized') {
                processRequest(event, ticket, cb);
            } else {
                _response = buildOutput(401, {
                    error: {
                        message: 'User is not authorized to perform the requested action.'
                    }
                });
                return cb(_response, null);
            }

        });
    }

};

/**
 * Routes the request to the appropriate logic based on the request resource and method.
 * @param {JSON} event - Request event.
 * @param {JSON} ticket - Data lake authorization ticket.
 * @param {processRequest~requestCallback} cb - The callback that handles the response.
 */
function processRequest(event, ticket, cb) {

    let INVALID_PATH_ERR = {
        Error: ['Invalid path request ', event.resource, ', ', event.httpMethod].join('')
    };

    let _group = new Group();
    let _user = new User();
    let _setting = new Setting();
    let _apikey = new ApiKey();
    let _accessLog = new AccessLog();
    let _response = {};
    let _operation = '';

    if (event.resource === '/admin/groups' && event.httpMethod === 'GET') {

        _operation = 'list groups';
        _group.listGroups(ticket, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });

    } else if (event.resource === '/admin/groups/{group_name}' && event.httpMethod === 'PUT') {

        _operation = 'create a new group';
        let _body = JSON.parse(event.body);
        _group.createGroup(decodeURI(event.pathParameters.group_name), _body.description, ticket, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });

    } else if (event.resource === '/admin/groups/{group_name}' && event.httpMethod === 'POST') {

        let groupName = decodeURI(event.pathParameters.group_name);
        let _body = JSON.parse(event.body);
        _operation = ['Update data lake group', groupName, _body.action].join(' ');

        if (_body.action == 'updateGroup') {
            _group.updateGroup(groupName, _body.description, ticket, function(err, data) {
                if (err) {
                    console.log(err);
                    _response = buildOutput(err.code, err);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'failed/error',
                        function(err, resp) {
                            return cb(_response, null);
                        });
                } else {
                    _response = buildOutput(200, data);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'success',
                        function(err, resp) {
                            return cb(null, _response);
                        });
                }
            });
        } else if (_body.action == 'removeUserFromGroup') {
            _group.removeUserFromGroup(_body.userId, groupName, ticket, function(err, data) {
                if (err) {
                    console.log(err);
                    _response = buildOutput(err.code, err);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'failed/error',
                        function(err, resp) {
                            return cb(_response, null);
                        });
                } else {
                    _response = buildOutput(200, data);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'success',
                        function(err, resp) {
                            return cb(null, _response);
                        });
                }
            });
        } else {
            let err = {code: 400, message: `Invalid parameters. Check if you are setting action for update group infomation or user list.`};
            _response = buildOutput(err.code, err);
            _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                'failed/error',
                function(err, resp) {
                    return cb(_response, null);
                });
        }

    } else if (event.resource === '/admin/groups/{group_name}' && event.httpMethod === 'GET') {
        let groupName = decodeURI(event.pathParameters.group_name);
        _operation = ['retrieve data lake group', groupName].join(' ');

        _group.getGroup(groupName, ticket, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });

    } else if (event.resource === '/admin/groups/{group_name}' && event.httpMethod === 'DELETE') {

        let groupName = decodeURI(event.pathParameters.group_name);
        _operation = ['delete data lake group', groupName].join(' ');

        _group.deleteGroup(groupName, ticket, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });

    } else if (event.resource === '/admin/groups/membership/{user_id}' && event.httpMethod === 'GET') {

        event.pathParameters.user_id = decodeURI(event.pathParameters.user_id);
        _operation = ['get ', event.pathParameters.user_id, ' groups'].join(' ');
        _group.getUserGroups(event.pathParameters.user_id, ticket, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });

    } else if (event.resource === '/admin/groups/membership/{user_id}' && event.httpMethod === 'POST') {

        event.pathParameters.user_id = decodeURI(event.pathParameters.user_id);
        _operation = ['update ', event.pathParameters.user_id, ' group membership'].join(' ');
        let _body = JSON.parse(event.body);
        _group.updateUserMembership(event.pathParameters.user_id, _body.groupSet, ticket, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });

    } else if (event.resource === '/admin/invitations' && event.httpMethod === 'POST') {
        _operation = 'create invitation for a new user';
        _user.inviteUser(event.body, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/users' && event.httpMethod === 'GET') {
        _operation = 'list data lake users';
        _user.getUsers(function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/users/{user_id}' && event.httpMethod === 'GET') {
        event.pathParameters.user_id = decodeURI(event.pathParameters.user_id);
        _operation = ['retrieve data lake user', event.pathParameters.user_id].join(' ');
        _user.getUser(event.pathParameters.user_id, ticket, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/users/{user_id}' && event.httpMethod === 'DELETE') {
        event.pathParameters.user_id = decodeURI(event.pathParameters.user_id);
        _operation = ['delete data lake user', event.pathParameters.user_id].join(' ');
        _user.deleteUser(event.pathParameters.user_id, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/users/{user_id}' && event.httpMethod === 'PUT') {
        event.pathParameters.user_id = decodeURI(event.pathParameters.user_id);
        let _body = JSON.parse(event.body);
        if (_body.operation === 'update') {
            _operation = ['update data lake user', event.pathParameters.user_id].join(' ');
            _user.updateUser(event.pathParameters.user_id, _body.user, function(err, data) {
                if (err) {
                    console.log(err);
                    _response = buildOutput(err.code, err);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'failed/error',
                        function(err, resp) {
                            return cb(_response, null);
                        });
                } else {
                    _response = buildOutput(200, data);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'success',
                        function(err, resp) {
                            return cb(null, _response);
                        });
                }
            });
        } else if (_body.operation === 'disable') {
            event.pathParameters.user_id = decodeURI(event.pathParameters.user_id);
            _operation = ['disable data lake user', event.pathParameters.user_id].join(' ');
            _user.disableUser(event.pathParameters.user_id, function(err, data) {
                if (err) {
                    console.log(err);
                    _response = buildOutput(err.code, err);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'failed/error',
                        function(err, resp) {
                            return cb(_response, null);
                        });
                } else {
                    _response = buildOutput(200, data);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'success',
                        function(err, resp) {
                            return cb(null, _response);
                        });
                }
            });
        } else if (_body.operation === 'enable') {
            event.pathParameters.user_id = decodeURI(event.pathParameters.user_id);
            _operation = ['enable data lake user', event.pathParameters.user_id].join(' ');
            _user.enableUser(event.pathParameters.user_id, function(err, data) {
                if (err) {
                    console.log(err);
                    _response = buildOutput(err.code, err);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'failed/error',
                        function(err, resp) {
                            return cb(_response, null);
                        });
                } else {
                    _response = buildOutput(200, data);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'success',
                        function(err, resp) {
                            return cb(null, _response);
                        });
                }
            });
        } else {
            _response = buildOutput(401, 'Invalid user operation requested.');
            return cb(_response, null);
        }

    } else if (event.resource === '/admin/users/{user_id}/forgotPassword' && event.httpMethod === 'POST') {
        event.pathParameters.user_id = decodeURI(event.pathParameters.user_id);
        _operation = ['forgot password ', event.pathParameters.user_id].join(' ');
        _user.forgotPassword(event.pathParameters.user_id, function(err, data) {
            if (err) {
                _response = buildOutput(err.code, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });

    } else if (event.resource === '/admin/settings/config' && event.httpMethod === 'GET') {
        _operation = 'list data lake configuration settings';
        _setting.getAppSettings(function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/settings/config' && event.httpMethod === 'PUT') {
        _operation = 'update data lake configuration settings';
        _setting.updateAppSettings(event.body, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/settings/governance' && event.httpMethod === 'GET') {
        _operation = 'retrieve data lake governance settings';
        _setting.getGovernanceSettings(function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/settings/governance/{setting_id}' && event.httpMethod === 'GET') {
        _operation = ['retrieve data lake governance setting', event.pathParameters.setting_id].join(' ');
        _setting.getGovernanceSetting(event.pathParameters.setting_id, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/settings/governance/{setting_id}' && event.httpMethod === 'DELETE') {
        _operation = ['delete data lake governance setting', event.pathParameters.setting_id].join(' ');
        _setting.deleteGovernanceSetting(event.pathParameters.setting_id, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/settings/governance/{setting_id}' && event.httpMethod === 'POST') {
        _operation = 'create new governance setting';
        _setting.createGovernanceSetting(event.body, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/settings/governance/{setting_id}' && event.httpMethod === 'PUT') {
        _operation = ['update data lake governance setting', event.pathParameters.setting_id].join(' ');
        _setting.updateGovernanceSetting(event.pathParameters.setting_id, event.body, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/apikeys' && event.httpMethod === 'GET') {
        event.queryStringParameters.user_id = decodeURI(event.queryStringParameters.user_id);
        _operation = ['retrieve api access key for user', event.queryStringParameters.user_id].join(' ');
        _apikey.getApiKeyByUserid(event.queryStringParameters.user_id, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/apikeys/{access_key_id}' && event.httpMethod === 'GET') {
        _operation = ['retrieve api access key', event.pathParameters.access_key_id].join(' ');
        _apikey.getApiKey(event.pathParameters.access_key_id, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/apikeys/{access_key_id}' && event.httpMethod === 'DELETE') {
        event.queryStringParameters.user_id = decodeURI(event.queryStringParameters.user_id);
        _operation = ['delete api access key', event.pathParameters.access_key_id, 'for user',
            event.queryStringParameters.user_id
        ].join(' ');
        _apikey.deleteApiKey(event.pathParameters.access_key_id, event.queryStringParameters.user_id,
            function(err, data) {
                if (err) {
                    console.log(err);
                    _response = buildOutput(500, err);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'failed/error',
                        function(err, resp) {
                            return cb(_response, null);
                        });
                } else {
                    _response = buildOutput(200, data);
                    _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                        'success',
                        function(err, resp) {
                            return cb(null, _response);
                        });
                }
            });
    } else if (event.resource === '/admin/apikeys/{access_key_id}' && event.httpMethod === 'POST') {
        event.queryStringParameters.user_id = decodeURI(event.queryStringParameters.user_id);
        _operation = ['create an api access key for user', event.queryStringParameters.user_id].join(' ');
        _apikey.createApiKey(event.queryStringParameters.user_id, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else if (event.resource === '/admin/apikeys/{access_key_id}' && event.httpMethod === 'PUT') {
        _operation = ['update api access key', event.pathParameters.access_key_id].join(' ');
        _apikey.updateApiKey(event.pathParameters.access_key_id, event.body, function(err, data) {
            if (err) {
                console.log(err);
                _response = buildOutput(500, err);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'failed/error',
                    function(err, resp) {
                        return cb(_response, null);
                    });
            } else {
                _response = buildOutput(200, data);
                _accessLog.logEvent(event.requestContext.requestId, servicename, ticket.userid, _operation,
                    'success',
                    function(err, resp) {
                        return cb(null, _response);
                    });
            }
        });
    } else {
        _response = buildOutput(500, INVALID_PATH_ERR);
        return cb(_response, null);
    }

}

/**
 * Constructs the appropriate HTTP response.
 * @param {integer} statusCode - HTTP status code for the response.
 * @param {JSON} data - Result body to return in the response.
 */
function buildOutput(statusCode, data) {

    let _response = {
        statusCode: statusCode,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data)
    };

    return _response;
};
