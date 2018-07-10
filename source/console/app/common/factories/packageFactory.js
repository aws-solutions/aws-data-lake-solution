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

angular.module('dataLake.factory.package', ['ngResource', 'dataLake.utils', 'dataLake.service.auth'])

.factory('dataPackageFactory', function($resource, $_, $state, authService) {

    var factory = {};

    var datapackagesResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages'].join('/');
        return $resource(_url, {}, {
            getGovernance: {
                method: 'POST',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var datapackageResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages/:packageId'].join('/');
        return $resource(_url, {
            packageId: '@packageId'
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
            remove: {
                method: 'DELETE',
                headers: {
                    Auth: token
                }
            },
            save: {
                method: 'PUT',
                headers: {
                    Auth: token
                }
            }
        });
    };


    var tablesResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages/:packageId/tables'].join('/');
        return $resource(_url, {
            packageId: '@packageId'
        }, {
            getTables: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var tableResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages/:packageId/tables/:tableName'].join('/');
        return $resource(_url, {
            packageId: '@packageId',
            tableName: '@tableName'
        }, {
            viewTableData: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var crawlerResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages/:packageId/crawler'].join('/');
        return $resource(_url, {
            packageId: '@packageId'
        }, {
            getCrawler: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            },
            startCrawler: {
                method: 'POST',
                headers: {
                    Auth: token
                }
            },
            updateOrCreateCrawler: {
                method: 'PUT',
                headers: {
                    Auth: token
                }
            }
        });
    };

    factory.listGovernanceRequirements = function(cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datapackagesResource(_token).getGovernance({}, {
                operation: 'required_metadata'
            }, function(data) {
                return cb(null, data.Items);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    factory.getDataPackage = function(packageId, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datapackageResource(_token).get({
                packageId: packageId
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

    factory.createDataPackage = function(packageId, newpackage, cb) {

        authService.getUserAccessTokenWithUsername().then(function(data) {
            var _token = ['tk:', data.token.jwtToken].join('');
            newpackage.owner = data.username;
            datapackageResource(_token).create({
                packageId: packageId
            }, newpackage, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
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

    factory.deleteDataPackage = function(packageId, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datapackageResource(_token).remove({
                packageId: packageId
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

    factory.updateDataPackage = function(packageId, newpackage, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datapackageResource(_token).save({
                packageId: packageId
            }, newpackage, function(data) {
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

    //-------------------------------------------------------------------------
    // [AWS Glue Integration] Crawler
    //-------------------------------------------------------------------------
    factory.getCrawler = function(packageId, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            crawlerResource(_token).getCrawler({
                packageId: packageId
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

    factory.startCrawler = function(packageId, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            crawlerResource(_token).startCrawler({
                packageId: packageId
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

    factory.updateOrCreateCrawler = function(packageId, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            crawlerResource(_token).updateOrCreateCrawler({
                packageId: packageId
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

    //-------------------------------------------------------------------------
    // [AWS Glue Integration] Table
    //-------------------------------------------------------------------------
    factory.getTables = function(packageId, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            tablesResource(_token).getTables({
                packageId: packageId
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

    //-------------------------------------------------------------------------
    // [Amazon Athena Integration] Table Data
    //-------------------------------------------------------------------------
    factory.viewTableData = function(packageId, tableName, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            tableResource(_token).viewTableData({
                packageId: packageId,
                tableName: tableName
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

.factory('metadataFactory', function($resource, $_, $state, authService) {

    var factory = {};

    var packageMetadataResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages/:packageId/metadata'].join('/');
        return $resource(_url, {
            packageId: '@packageId'
        }, {
            query: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var metadataResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages/:packageId/metadata/:metadataId'].join('/');
        return $resource(_url, {
            packageId: '@packageId',
            metadataId: '@metadataId'
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
            remove: {
                method: 'DELETE',
                headers: {
                    Auth: token
                }
            }
        });
    };

    factory.listPackageMetadata = function(packageId, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            packageMetadataResource(_token).query({
                packageId: packageId
            }, function(data) {
                return cb(null, data.Items);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    factory.getMetadata = function(packageId, metadataid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            metadataResource(_token).get({
                packageId: packageId,
                metadataId: metadataid
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

    factory.createMetadata = function(packageId, newmetadata, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            metadataResource(_token).create({
                packageId: packageId,
                metadataId: 'new'
            }, newmetadata, function(data) {
                if ($_.isEmpty(data)) {
                    return cb(null, data);
                }

                return cb(null, data);
            }, function(err) {
                console.log(err)
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });

    };

    factory.deleteMetadata = function(packageId, metadataid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            metadataResource(_token).remove({
                packageId: packageId,
                metadataId: metadataid
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

.factory('datasetFactory', function($resource, $_, $state, authService) {

    var factory = {};

    var packageDatasetResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages/:packageId/datasets'].join('/');
        return $resource(_url, {
            packageId: '@packageId'
        }, {
            query: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var datasetResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages/:packageId/datasets/:datasetId'].join('/');
        return $resource(_url, {
            packageId: '@packageId',
            datasetId: '@datasetId'
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
            remove: {
                method: 'DELETE',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var datasetProcessResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages/:packageId/datasets/:datasetId/process'].join('/');
        return $resource(_url, {
            packageId: '@packageId',
            datasetId: '@datasetId'
        }, {
            process: {
                method: 'POST',
                headers: {
                    Auth: token
                }
            }
        });
    };

    var s3Resource = function(url, filetype) {
        return $resource(
            url, {}, {
                upload: {
                    method: 'PUT',
                    headers: {
                        'Content-Type': filetype
                    }
                }
            });
    };

    factory.listPackageDatasets = function(packageId, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            packageDatasetResource(_token).query({
                packageId: packageId
            }, function(data) {
                return cb(null, data.Items);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
        });
    };

    factory.getDataset = function(packageId, datasetid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datasetResource(_token).get({
                packageId: packageId,
                datasetId: datasetid
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

    factory.createDataset = function(packageId, newdataset, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datasetResource(_token).create({
                packageId: packageId,
                datasetId: 'new'
            }, newdataset, function(data) {
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

    factory.deleteDataset = function(packageId, datasetid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datasetResource(_token).remove({
                packageId: packageId,
                datasetId: datasetid
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

    factory.uploadFile = function(url, filetype, file, cb) {
        s3Resource(url, filetype).upload({}, file, function(data) {
            return cb(null, data);
        }, function(err) {
            return cb(err, null);
        });
    }

    factory.processManifest = function(packageId, datasetid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datasetProcessResource(_token).process({
                packageId: packageId,
                datasetId: datasetid
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

    return factory;

});
