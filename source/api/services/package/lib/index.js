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
let AWS = require('aws-sdk');

let ContentPackage = require('./content-package.js');
let Dataset = require('./dataset.js');
let Metadata = require('./metadata.js');
let AccessLog = require('./access-log.js');
let AccessValidator = require('access-validator');
const servicename = 'data-lake-package-service';

/**
 * Verifies user's authorization to execute requested action. If the request is
 * authorized, it is processed, otherwise a 401 unathorized result is returned
 * @param {JSON} event - Request event.
 * @param {respond~requestCallback} cb - The callback that handles the response.
 */
module.exports.respond = function(event, cb) {
    let _accessValidator = new AccessValidator();
    let _authToken = _accessValidator.getAuthToken(event.headers);
    let _authCheckPayload = {
        authcheck: ['admin', 'member'],
        authorizationToken: _authToken
    };

    let _response = '';

    // invoke data-lake-admin-service function to verify if user has
    // proper role for requested action
    let params = {
        FunctionName: 'data-lake-admin-service',
        InvocationType: 'RequestResponse',
        LogType: 'None',
        Payload: JSON.stringify(_authCheckPayload)
    };
    let lambda = new AWS.Lambda();
    lambda.invoke(params, function(err, data) {
        if (err) {
            console.log(err);
            _response = buildOutput(500, err);
            return cb(_response, null);
        }

        let _ticket = JSON.parse(data.Payload);
        console.log('Authorization check result: ' + _ticket.auth_status);
        if (_ticket.auth_status === 'authorized') {
            processRequest(event, _ticket, cb);
        } else {
            _response = buildOutput(401, {
                error: {
                    message: 'User is not authorized to perform the requested action.'
                }
            });
            return cb(_response, null);
        }

    });
};

/**
 * Routes the request to the appropriate logic based on the request resource and method.
 * @param {JSON} event - Request event.
 * @param {JSON} ticket - Data lake authorization ticket.
 * @param {processRequest~requestCallback} cb - The callback that handles the response.
 */
function processRequest(event, ticket, cb) {

    let _response = {};

    let INVALID_PATH_ERR = {
        Error: ['Invalid path request ', event.resource, ', ', event.httpMethod].join('')
    };

    let _accessValidator = new AccessValidator();
    let _package = new ContentPackage();
    let _dataset = new Dataset();
    let _metadata = new Metadata();
    let _accessLog = new AccessLog();
    let _operation = '';

    if (event.resource === '/packages' && event.httpMethod === 'POST') {
        let _body = JSON.parse(event.body);
        _operation = 'reading package metadata governance';
        _metadata.getMetadataGovernance(_body, function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}' && event.httpMethod === 'GET') {
        _operation = ['reading package', event.pathParameters.package_id].join(' ');
        _package.getPackage(event.pathParameters.package_id, ticket, function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}' && event.httpMethod === 'DELETE') {
        _operation = ['deleting package', event.pathParameters.package_id].join(' ');
        let _authToken = _accessValidator.getAuthToken(event.headers);
        _package.deletePackage(event.pathParameters.package_id, _authToken, ticket, function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}' && event.httpMethod === 'POST') {
        _operation = 'creating a new package';
        _package.createPackage(event, ticket, function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}' && event.httpMethod === 'PUT') {
        _operation = ['updating package', event.pathParameters.package_id].join(' ');
        _package.updatePackage(event, ticket, function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}/datasets' && event.httpMethod === 'GET') {
        _operation = ['listing datasets for package', event.pathParameters.package_id].join(' ');
        _dataset.getPackageDatasets(event.pathParameters.package_id, ticket, function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}/datasets/{dataset_id}' && event.httpMethod === 'GET') {
        _operation = ['reading dataset', event.pathParameters.dataset_id, 'from package',
            event.pathParameters.package_id
        ].join(' ');
        _dataset.getPackageDataset(event.pathParameters.package_id, event.pathParameters.dataset_id, ticket,
            function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}/datasets/{dataset_id}' && event.httpMethod === 'DELETE') {
        _operation = ['deleting dataset', event.pathParameters.dataset_id, 'from package',
            event.pathParameters.package_id
        ].join(' ');
        _dataset.deletePackageDataset(event.pathParameters.package_id, event.pathParameters.dataset_id, ticket,
            function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}/datasets/{dataset_id}' && event.httpMethod === 'POST') {
        _operation = ['adding a new dataset in package', event.pathParameters.package_id].join(' ');
        _dataset.createPackageDataset(event.pathParameters.package_id, event.body, ticket, function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}/datasets/{dataset_id}/process' && event.httpMethod === 'POST') {
        _operation = ['processing import manifest', event.pathParameters.dataset_id, 'for package',
            event.pathParameters.package_id
        ].join(' ');

        let _authToken = _accessValidator.getAuthToken(event.headers);
        _dataset.processPackageDatasetManifest(event.pathParameters.package_id, event.pathParameters.dataset_id,
            _authToken, ticket,
            function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}/metadata' && event.httpMethod === 'GET') {
        _operation = ['listing metadata for package', event.pathParameters.package_id].join(' ');
        _metadata.getAllPackageMetadata(event.pathParameters.package_id, function(err, data) {
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
    } else if (event.resource === '/packages/{package_id}/metadata/{metadata_id}' && event.httpMethod === 'GET') {
        _operation = ['reading metadata', event.pathParameters.metadata_id, 'for package',
            event.pathParameters.package_id
        ].join(' ');
        _metadata.getPackageMetadata(event.pathParameters.package_id, event.pathParameters.metadata_id,
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
    } else if (event.resource === '/packages/{package_id}/metadata/{metadata_id}' && event.httpMethod === 'POST') {
        _operation = ['creating metadata for package', event.pathParameters.package_id].join(' ');

        let _authToken = _accessValidator.getAuthToken(event.headers);
        _metadata.createPackageMetadata(event.pathParameters.package_id, event.body, _authToken, ticket,
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

    } else if (event.resource === '/packages/{package_id}/tables' && event.httpMethod === 'GET') {
        _operation = ['listing AWS Glue tables for package', event.pathParameters.package_id].join(' ');

        _package.getTables(event.pathParameters.package_id, ticket, function(err, data) {
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

    } else if (event.resource === '/packages/{package_id}/tables/{table_name}' && event.httpMethod === 'GET') {
        _operation = ['reading AWS Glue table ', event.pathParameters.table_name, 'for package',
            event.pathParameters.package_id
        ].join(' ');

        _package.viewTableData(event.pathParameters.package_id, decodeURI(event.pathParameters.table_name), ticket, function(err, data) {
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

    } else if (event.resource === '/packages/{package_id}/crawler' && event.httpMethod === 'GET') {
        _operation = ['reading AWS Glue crawler info for package', event.pathParameters.package_id].join(' ');

        _package.getCrawler(event.pathParameters.package_id, ticket, function(err, data) {
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

    } else if (event.resource === '/packages/{package_id}/crawler' && event.httpMethod === 'POST') {
        _operation = ['starting AWS Glue crawler for package', event.pathParameters.package_id].join(' ');

        _package.startCrawler(event.pathParameters.package_id, ticket,
            function(err, data) {
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

    } else if (event.resource === '/packages/{package_id}/crawler' && event.httpMethod === 'PUT') {
        _operation = ['update or create AWS Glue crawler for package', event.pathParameters.package_id].join(' ');

        _package.updateOrCreateCrawler(event.pathParameters.package_id, ticket,
            function(err, data) {
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
        _response = buildOutput(501, INVALID_PATH_ERR);
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
}
