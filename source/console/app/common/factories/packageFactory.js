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

angular.module('dataLake.factory.package', ['ngResource', 'dataLake.utils', 'dataLake.service.auth'])

.factory('dataPackageFactory', function($resource, $_, $state, authService) {

    var factory = {};

    var datapackagesResource = function(token) {
        var _url = [APIG_ENDPOINT, 'packages'].join('/');
        return $resource(_url, {}, {
            query: {
                method: 'GET',
                headers: {
                    Auth: token
                }
            },
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

    factory.listDataPackages = function(cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datapackagesResource(_token).query({}, function(data) {
                return cb(null, data.Items);
            }, function(err) {
                return cb(err, null);
            });
        }, function(msg) {
            console.log('Unable to retrieve the user session.');
            $state.go('signin', {});
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

    factory.getDataPackage = function(packageid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datapackageResource(_token).get({
                packageId: packageid
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

    factory.createDataPackage = function(packageid, newpackage, cb) {

        authService.getUserAccessTokenWithUsername().then(function(data) {
            var _token = ['tk:', data.token.jwtToken].join('');
            newpackage.owner = data.username;
            datapackageResource(_token).create({
                packageId: packageid
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

    factory.deleteDataPackage = function(packageid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datapackageResource(_token).remove({
                packageId: packageid
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

    factory.updateDataPackage = function(packageid, newpackage, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datapackageResource(_token).save({
                packageId: packageid
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

    factory.listPackageMetadata = function(packageid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            packageMetadataResource(_token).query({
                packageId: packageid
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

    factory.getMetadata = function(packageid, metadataid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            metadataResource(_token).get({
                packageId: packageid,
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

    factory.createMetadata = function(packageid, newmetadata, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            metadataResource(_token).create({
                packageId: packageid,
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

    factory.deleteMetadata = function(packageid, metadataid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            metadataResource(_token).remove({
                packageId: packageid,
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

    factory.listPackageDatasets = function(packageid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            packageDatasetResource(_token).query({
                packageId: packageid
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

    factory.getDataset = function(packageid, datasetid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datasetResource(_token).get({
                packageId: packageid,
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

    factory.createDataset = function(packageid, newdataset, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datasetResource(_token).create({
                packageId: packageid,
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

    factory.deleteDataset = function(packageid, datasetid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datasetResource(_token).remove({
                packageId: packageid,
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

    factory.processManifest = function(packageid, datasetid, cb) {

        authService.getUserAccessToken().then(function(token) {
            var _token = ['tk:', token.jwtToken].join('');
            datasetProcessResource(_token).process({
                packageId: packageid,
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
