'use strict';

angular.module('dataLake.package', ['dataLake.main', 'dataLake.utils', 'dataLake.factory.package',
    'dataLake.factory.cart'
])

.config(['$stateProvider', '$urlRouterProvider', function($stateProvider,
    $urlRouterProvider) {
    $stateProvider.state('package', {
        url: '/package/:package_id',
        views: {
            '': {
                templateUrl: 'main/main.html',
                controller: 'MainCtrl'
            },
            '@package': {
                templateUrl: 'package/package.html',
                controller: 'PackageCtrl'
            }
        },
        authenticate: true
    });
}])

.controller('PackageCtrl', function($scope, $state, $stateParams, $sce, $_, $blockUI, $rootScope, authService,
    dataPackageFactory, metadataFactory, datasetFactory, cartFactory, $http) {

    $scope.newpackage = {};
    $scope.pckg = {};
    $scope.newMetadata = [];
    $scope.newContent = [];
    $scope.newLink = [];
    $scope.pckgMetadata = {
        metadata: []
    };
    $scope.pckgContent = [];
    $scope.pckgManifest = [];
    $scope.log = [];
    $scope.newPackage = true;
    $scope.invalidMetadata = false;
    $scope.showCreateError = false;
    $scope.createErrorMessage = '';
    $scope.showError = false;
    $scope.errorMessage = '';
    $scope.showDeleteModal = false;
    $scope.canEdit = false;
    $scope.metadataGovernance = [];

    $scope.tabs = [{
        label: 'Overview',
        id: 'tab_overview'
    }, {
        label: 'Content',
        id: 'tab_content'
    }, {
        label: 'History',
        id: 'tab_history'
    }];
    $scope.currentTab = 'tab_overview';

    var getPackageDetails = function(id) {
        $blockUI.start();
        dataPackageFactory.getDataPackage(id, function(err, datapackage) {
            if (err) {
                console.log('error', err);
                $blockUI.stop();
                return;
            }

            if (datapackage) {
                $scope.pckg = datapackage;

                authService.getUserInfo().then(function(userinfo) {
                    if (userinfo.username === datapackage.owner || userinfo.role === 'Admin') {
                        $scope.canEdit = true;
                    }

                    metadataFactory.listPackageMetadata(id, function(err, metadata) {
                        if (err) {
                            console.log('error', err);
                            return;
                        }

                        setMetadataHistory(metadata);
                        $scope.log.push({
                            entrydt: $scope.pckg.created_at,
                            entries: [
                                '<p>Package created by ' + $scope.pckg.owner +
                                '</p>'
                            ]
                        });

                        datasetFactory.listPackageDatasets(id, function(err, datasets) {
                            if (err) {
                                console.log('error', err);
                                $blockUI.stop();
                                return;
                            }

                            $scope.pckgContent = $_.where(datasets, {
                                type: 'dataset'
                            });

                            $scope.tabs = [{
                                label: 'Overview',
                                id: 'tab_overview'
                            }, {
                                label: ['Content', '(', $scope.pckgContent
                                    .length, ')'
                                ].join(' '),
                                id: 'tab_content'
                            }, {
                                label: 'History',
                                id: 'tab_history'
                            }];

                            $scope.pckgManifest = $_.filter(datasets, function(d) {
                                return d.type === 'manifest' && d.state_desc !=
                                    'Processed';
                            });

                            $blockUI.stop();
                        });
                    });

                }, function(msg) {
                    console.log('Unable to retrieve the user session.');
                    $state.go('signin', {});
                });

            } else {
                $scope.pckg = null;
                $scope.showError = true;
                $scope.errorMessage = ['The package', $stateParams.package_id,
                    'is not available in the data lake.'
                ].join(' ');
                $blockUI.stop();
            }
        });
    };

    var setMetadataHistory = function(metadata) {
        $scope.log = [];

        if (metadata.length > 0) {
            var _ordered = $_.sortBy(metadata, 'created_at');
            $scope.pckgMetadata = $_.last(_ordered);

            for (var i = 0; i < _ordered.length; i++) {
                var _entry = {
                    entrydt: _ordered[i].created_at,
                    entries: []
                };

                var _prev = {};
                if (i - 1 >= 0) {
                    _prev = _ordered[i - 1];
                }

                for (var j = 0; j < _ordered[i].metadata.length; j++) {
                    if (!$_.isEmpty(_prev)) {
                        var _meta = $_.find(_prev.metadata, function(item) {
                            return item.tag == _ordered[i].metadata[j].tag;
                        });

                        //is it different than the previous entry
                        if (!$_.isEmpty(_meta)) {
                            if (_meta.value != _ordered[i].metadata[j].value) {
                                _entry.entries.push(
                                    '<p>Metadata <span class="awsui-label-content awsui-label-type-warning">' +
                                    _ordered[i].metadata[j].tag +
                                    '</span> updated to [ ' + _ordered[i].metadata[j].value + ' ] by ' +
                                    _ordered[i].created_by + '</p>');
                            }
                        } else {
                            _entry.entries.push(
                                '<p>Metadata <span class="awsui-label-content awsui-label-type-info">' +
                                _ordered[i].metadata[j].tag +
                                '</span> created with value [ ' + _ordered[i].metadata[j].value + ' ] by ' +
                                _ordered[i].created_by + '</p>');
                        }

                    } else {
                        _entry.entries.push(
                            '<p>Metadata <span class="awsui-label-content awsui-label-type-info">' +
                            _ordered[i].metadata[j].tag +
                            '</span> created with value [ ' + _ordered[i].metadata[j].value + ' ] by ' +
                            _ordered[i].created_by + '</p>');
                    }

                }

                $scope.log.unshift(_entry);
            }
        }

    };

    var getRequiredMetadata = function() {
        $blockUI.start();
        dataPackageFactory.listGovernanceRequirements(function(err, governance) {
            if (err) {
                console.log('error', err);
                $blockUI.stop();
                return;
            }

            $scope.metadataGovernance = $_.sortBy(governance, 'governance').reverse();
            $blockUI.stop();
        });
    };

    var addManifest = function(cb) {
        if ($scope.newLink.length > 0) {
            for (var i = 0; i < $scope.newLink.length; i++) {
                if ($scope.newLink[i].file) {
                    var file = $scope.newLink[i].file;

                    var _dataset = {
                        name: file.name,
                        type: 'manifest',
                        content_type: file.type,
                        owner: $rootScope.username
                    };

                    datasetFactory.createDataset($stateParams.package_id, _dataset, function(err, dataset) {
                        if (err) {
                            console.log('error', err);
                            return cb('error occurred updating package manifest.', null);
                        }

                        if (file !== undefined && file.name !== undefined && file.name.length > 0) {
                            $scope.newLink = [];
                            console.log(dataset.uploadUrl);
                            datasetFactory.uploadFile(
                                dataset.uploadUrl,
                                file.type,
                                file,
                                function(err, filedata) {
                                    if (err) {
                                        console.log('error', err);
                                        return cb('error occurred updating package manifest.', null);
                                    }

                                    datasetFactory.processManifest($stateParams.package_id, dataset.dataset_id,
                                        function(err, pinfo) {
                                            if (err) {
                                                console.log('error', err);
                                                return cb(
                                                    'error occurred initiating package manifest processing.',
                                                    null);
                                            }

                                            return cb(null, 'done processing files...');
                                        });
                                });

                        };

                    });
                } else {
                    $scope.newLink = [];
                    return cb(null, 'no manifest to process...');
                }
            }
        } else {
            return cb(null, 'no manifest to process.');
        }
    };

    var addFiles = function(cb) {
        if ($scope.newContent.length > 0) {
            for (var i = 0; i < $scope.newContent.length; i++) {
                var file = $scope.newContent[i].file;

                var _dataset = {
                    name: file.name,
                    type: 'dataset',
                    content_type: file.type === '' ? 'application/octet-stream' : file.type,
                    owner: $rootScope.username
                };

                datasetFactory.createDataset($stateParams.package_id, _dataset, function(err, dataset) {
                    if (err) {
                        console.log('error', err);
                        return cb('error occurred updating package datasets.', null);
                    }

                    if (file !== undefined && file.name !== undefined && file.name.length > 0) {
                        $scope.newContent = [];
                        console.log(dataset.uploadUrl);
                        datasetFactory.uploadFile(
                            dataset.uploadUrl,
                            file.type,
                            file,
                            function(err, filedata) {
                                if (err) {
                                    console.log('error', err);
                                    return cb('error occurred updating package datasets.', null);
                                }

                                return cb(null, 'done processing files...');
                            });

                    };

                });
            }
        } else {
            return cb(null, 'no file to process.');
        }
    };

    var updatePackageMetadata = function(cb) {

        var _meta = {
            package_id: $scope.pckgMetadata.package_id,
            metadata: []
        };

        var _newMetaFound = false;

        if ($scope.newMetadata.length > 0) {
            for (var i = 0; i < $scope.newMetadata.length; i++) {
                if ($scope.newMetadata[i].value.length !== 0 && $scope.newMetadata[i].value.trim() !== '') {
                    _newMetaFound = true;
                    _meta.metadata.push({
                        tag: $scope.newMetadata[i].tag,
                        value: $scope.newMetadata[i].value
                    });
                }
            }
        }

        $scope.newMetadata = [];

        if (_newMetaFound) {
            metadataFactory.createMetadata($stateParams.package_id, _meta,
                function(err, data) {
                    if (err) {
                        console.log('error', err);
                        return cb('error occurred updating metadata.', null);
                    }

                    return cb(null, 'metadata updated.');
                });
        } else {
            return cb(null, 'no metadata to update.');
        }
    };

    $scope.trustSnippet = function(snippet) {
        return $sce.trustAsHtml(snippet);
    };

    $scope.addMetadata = function() {
        $scope.newMetadata.push({
            tag: '',
            value: ''
        });
    };

    $scope.removeMetadata = function(index) {
        if (index > -1 && index < $scope.newMetadata.length) {
            $scope.newMetadata.splice(index, 1);
        }
    };

    $scope.addFile = function() {
        $scope.newContent.push({
            name: ''
        });
    };

    $scope.removeFile = function(index) {
        if (index > -1 && index < $scope.newContent.length) {
            $scope.newContent.splice(index, 1);
        }
    };

    $scope.addLinkManifest = function() {
        $scope.newLink.push({
            name: ''
        });
    };

    $scope.removeLinkManifest = function(index) {
        if (index > -1 && index < $scope.newLink.length) {
            $scope.newLink.splice(index, 1);
        }
    };

    $scope.selectContent = function(index) {
        $scope.lastContentChanged = index;
        var elem = document.getElementById('fileDialog');

        if (elem && document.createEvent) {
            var evt = document.createEvent('MouseEvents');
            evt.initEvent('click', true, false);
            elem.dispatchEvent(evt);
        }
    };

    $scope.selectLink = function(index) {
        $scope.lastLinkChanged = index;
        var elem = document.getElementById('linkDialog');

        if (elem && document.createEvent) {
            var evt = document.createEvent('MouseEvents');
            evt.initEvent('click', true, false);
            elem.dispatchEvent(evt);
        }
    };

    $scope.fileNameChanged = function(contentChanged) {

        var files = contentChanged.files;
        $scope.newContent[$scope.lastContentChanged] = {
            file: files[0],
            progressLoaded: 0,
            progressTotal: 0
        };
        $scope.$apply();
    };

    $scope.linkNameChanged = function(contentChanged) {

        var files = contentChanged.files;
        $scope.newLink[$scope.lastLinkChanged] = {
            file: files[0],
            progressLoaded: 0,
            progressTotal: 0
        };
        $scope.$apply();
    };

    $scope.validateTag = function(metadata) {
        if (metadata.tag.length === 0 || metadata.tag.indexOf(' ') !== -1) {
            metadata.invalid = true;
            $scope.invalidMetadata = true;
        } else {
            metadata.invalid = false;
        }
    };

    $scope.addToCart = function(pckg) {
        var _item = {
            package_id: pckg.package_id
        };

        cartFactory.createCartItem(_item, function(err, data) {
            $blockUI.start();
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.errorMessage =
                    'An unexpected error occured when attempting to add package to your cart.';
                $blockUI.stop();
                return;
            }

            cartFactory.getCartCount(function(err, data) {
                if (err) {
                    console.log('error', err);
                    $scope.showError = true;
                    $scope.errorMessage =
                        'An unexpected error occured when attempting to retrieve your updated cart items.';
                    $blockUI.stop();
                    return;
                }

                $blockUI.stop();
            });

        });
    };

    $scope.createPackage = function(newpackage, isValid) {
        if (isValid) {
            $blockUI.start();

            var _newpckg = {
                package: newpackage
            };

            //check metadata requirements
            var _metadata = [];
            for (var i = 0; i < $scope.metadataGovernance.length; i++) {
                if ($scope.metadataGovernance[i].governance === 'Required') {
                    if ($scope.metadataGovernance[i].value) {
                        if ($scope.metadataGovernance[i].value
                            .trim() !== '') {
                            _metadata.push({
                                tag: $scope.metadataGovernance[i].tag,
                                value: $scope.metadataGovernance[i].value
                            });
                        } else {
                            $scope.showCreateError = true;
                            $scope.createErrorMessage = [$scope.metadataGovernance[i].tag,
                                'is a required field.'
                            ].join(' ');
                            $blockUI.stop();
                            return;
                        }
                    } else {
                        $scope.showCreateError = true;
                        $scope.createErrorMessage = [$scope.metadataGovernance[i].tag, 'is a required field.'].join(
                            ' ');
                        $blockUI.stop();
                        return;
                    }

                } else if ($scope.metadataGovernance[i].governance === 'Optional') {
                    if ($scope.metadataGovernance[i].value) {
                        if ($scope.metadataGovernance[i].value.trim() !== '') {
                            _metadata.push({
                                tag: $scope.metadataGovernance[i].tag,
                                value: $scope.metadataGovernance[i].value
                            });
                        }
                    }
                }
            }

            if (_metadata.length > 0) {
                _newpckg.metadata = _metadata;
            }

            dataPackageFactory.createDataPackage('new', _newpckg, function(err,
                data) {
                if (err) {
                    console.log('error', err);
                    $scope.showCreateError = true;
                    if (err.data) {
                        $scope.createErrorMessage = err.data;
                    } else {
                        $scope.createErrorMessage =
                            'An unexpected error occured when attempting to save the new package.';
                    }

                    $blockUI.stop();
                    return;
                }

                $state.go('package', {
                    package_id: data.package_id
                });
            });
        }
    };

    $scope.updatePackage = function(pckg, isValid) {
        if (isValid) {
            $blockUI.start();

            dataPackageFactory.updateDataPackage($stateParams.package_id, pckg, function(err,
                data) {
                if (err) {
                    console.log('error', err);
                    $scope.showError = true;
                    $scope.errorMessage =
                        'An unexpected error occured when attempting to save the package.';
                    $blockUI.stop();
                    return;
                }

                updatePackageMetadata(function(err, data) {
                    if (err) {
                        console.log('error', err);
                        $scope.showError = true;
                        $scope.errorMessage =
                            'An unexpected error occured when attempting to save the package.';
                        $blockUI.stop();
                        return;
                    }

                    addFiles(function(err, data) {
                        if (err) {
                            console.log('error', err);
                            $scope.showError = true;
                            $scope.errorMessage =
                                'An unexpected error occured when attempting to save the package.';
                            $blockUI.stop();
                            return;
                        }

                        addManifest(function(err, data) {
                            if (err) {
                                console.log('error', err);
                                $scope.showError = true;
                                $scope.errorMessage =
                                    'An unexpected error occured when attempting to save the package.';
                                $blockUI.stop();
                                return;
                            }

                            getPackageDetails($stateParams.package_id);

                        });

                    });

                });

            });
        }
    };

    $scope.removeDataset = function(datasetid) {
        $blockUI.start();
        datasetFactory.deleteDataset($stateParams.package_id, datasetid, function(err, data) {
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.errorMessage =
                    'An unexpected error occured when attempting to delete the dataset from the package.';
                $blockUI.stop();
                return;
            }

            getPackageDetails($stateParams.package_id);
        });
    };

    $scope.removePackage = function() {
        $scope.showDeleteModal = true;
    };

    $scope.closeDeleteModal = function() {
        $scope.showDeleteModal = false;
    };

    $scope.deletePackage = function(packageId) {
        $blockUI.start();
        dataPackageFactory.deleteDataPackage(packageId, function(err, resp) {
            $scope.showDeleteModal = false;
            if (err) {
                console.log('error', err);
                $scope.showError = true;
                $scope.errorMessage =
                    'An unexpected error occured when attempting to delete the package.';
                $blockUI.stop();
                return;
            }

            $blockUI.stop();
            $state.go('search', {});

        });
    };

    $scope.refresh = function() {
        getPackageDetails($stateParams.package_id);
    };

    if ($stateParams.package_id != 'new') {
        $scope.newPackage = false;
        getPackageDetails($stateParams.package_id);
    } else {
        $scope.newPackage = true;
        getRequiredMetadata();
    }

});
