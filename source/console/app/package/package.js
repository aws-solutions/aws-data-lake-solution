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
        authenticate: true,
        activeWithFederation: true
    });
}])

.controller('PackageCtrl', function($scope, $state, $stateParams, $sce, $_, $q, $blockUI, $rootScope, authService,
    dataPackageFactory, metadataFactory, datasetFactory, cartFactory, adminGroupFactory, $http) {

    $scope.newpackage = {};
    $scope.pckg = {};
    $scope.pckgName = '';
    $scope.newMetadata = [];
    $scope.newContent = [];
    $scope.newLink = [];
    $scope.pckgMetadata = {
        metadata: []
    };
    $scope.pckgContent = [];
    $scope.pckgManifest = [];
    $scope.glueCrawler = {};
    $scope.glueTables = [];
    $scope.log = [];
    $scope.newPackage = true;
    $scope.invalidMetadata = false;

    $scope.awsUiAlert = {}
    $scope.awsUiAlert.show = false;
    $scope.awsUiAlert.criticalError = false;
    $scope.awsUiAlert.type = "";
    $scope.awsUiAlert.header = "";
    $scope.awsUiAlert.content = "";

    $scope.deleteModal = {};
    $scope.deleteModal.show = false;
    $scope.deleteModal.type = "";
    $scope.deleteModal.id = "";

    $scope.canEdit = false;
    $scope.processing = false;
    $scope.metadataGovernance = [];

    $scope.groups = {};
    $scope.groups['all'] = false;
    $scope.groups['groups'] = {};

    $scope.tabs = [{
        label: 'Overview',
        id: 'tab_overview'
    }, {
        label: 'Content',
        id: 'tab_content'
    }, {
        label: 'History',
        id: 'tab_history'
    }, {
        label: 'Integrations',
        id: 'tab_integrations'
    }];
    $scope.currentTab = 'tab_overview';

    var getPackageDetails = function(id) {
        $blockUI.start();
        dataPackageFactory.getDataPackage(id, function(err, datapackage) {
            if (err) {
                console.log('getDataPackage error', err);
                showErrorAlert(['Failed to load the package', $stateParams.package_id, '. Check if it exists and if you have access to it'].join(' '), true);
                $blockUI.stop();
                return;
            }

            if (datapackage) {
                $scope.pckg = datapackage;
                $scope.pckgName = datapackage.name;

                authService.getUserInfo().then(function(userinfo) {
                    if (userinfo.username === datapackage.owner || userinfo.role.toLowerCase() === 'admin') {
                        $scope.canEdit = true;
                    }

                    $q.all([
                        getCrawlerInfo(id),
                        getTablesInfo(id),
                        listPackageMetadata(id),
                        listPackageDatasets(id),
                        listGroups()
                    ])
                    .then(values => {
                        $scope.glueCrawler = values[0];
                        $scope.glueTables = values[1];
                        setMetadataHistory(values[2]);
                        $scope.log.push({
                            entrydt: $scope.pckg.created_at,
                            entries: [
                                '<p>Package created by ' + $scope.pckg.owner +
                                '</p>'
                            ]
                        });

                        $scope.processing = ($scope.glueCrawler.status === 'RUNNING' || $scope.glueCrawler.status === 'STOPPING');

                        if (values[3]) {
                            $scope.pckgContent = $_.where(values[3], {
                                type: 'dataset'
                            });

                            $scope.pckgManifest = $_.filter(values[3], function(d) {
                                return d.type === 'manifest';
                            });
                        }
                        if ($scope.pckgContent.length == 0) {
                            $scope.glueTables = values[3];
                        }

                        let groups = values[4];
                        if ('groups' in datapackage && datapackage.groups.length > 0) {
                            let allSelected = true;
                            let membershipList = datapackage.groups;
                            let processMembershipList = Object.keys(groups).map(function(key, index) {
                                if (membershipList.indexOf(key) > -1) {
                                    groups[key].visible = true;
                                } else {
                                    allSelected = false;
                                }
                            });
                            $q.all(processMembershipList).then(function(results) {
                                $scope.groups['all'] = allSelected;
                                $scope.groups['groups'] = groups;
                            });
                        } else {
                            $scope.groups['groups'] = groups;
                        }

                        if ($scope.pckgContent.length == 0) {
                            $scope.glueTables = [];
                        }
                        $scope.tabs[1].label = `Content (${$scope.pckgContent.length})`;
                        $scope.tabs[3].label = `Integrations (${$scope.glueTables.length})`;
                        $blockUI.stop();
                    })
                    .catch(function(err) {
                        console.log("getPackageDetails Error:", err);
                        showErrorAlert(['Failed to load the package', $stateParams.package_id, '. Check if it exists and if you have access to it'].join(' '), true);
                        $blockUI.stop();
                    });

                }, function(msg) {
                    console.log('Unable to retrieve the user session.');
                    $state.go('signin', {});
                });

            } else {
                $scope.pckg = null;
                showErrorAlert(['The package', $stateParams.package_id, 'is not available in the data lake.'].join(' '), true);
                return;
            }
        });
    };

    var listGroups = function() {
        var deferred = $q.defer();
        adminGroupFactory.listGroups(function(err, data) {
            if (err) {
                deferred.resolve({});
            } else {
                var groups = {};
                let processGroups = data.Groups.map(function(group) {
                    groups[group.GroupName] = {name: group.GroupName, visible: false};
                });
                Promise.all(processGroups).then(function(results) {
                    deferred.resolve(groups);
                });
            }
        });
        return deferred.promise;
    };

    var getCrawlerInfo = function(packageId) {
        var deferred = $q.defer();
        dataPackageFactory.getCrawler(packageId, function(err, glueCrawler) {
            if (err) {
                deferred.resolve({
                    name: "-",
                    status: err.data.message,
                    lastRun: "-"
                });
            } else {
                deferred.resolve(glueCrawler);
            }
        });
        return deferred.promise;
    };

    var getTablesInfo = function(packageId) {
        var deferred = $q.defer();
        dataPackageFactory.getTables(packageId, function(err, glueTables) {
            if (err) {
                deferred.resolve([]);
            } else {
                deferred.resolve(glueTables.tables);
            }
        });
        return deferred.promise;
    };

    var listPackageMetadata = function(packageId) {
        var deferred = $q.defer();
        metadataFactory.listPackageMetadata(packageId, function(err, metadata) {
            if (err) {
                console.log('listPackageMetadata error', err);
                deferred.resolve(null);
            } else {
                deferred.resolve(metadata);
            }
        });
        return deferred.promise;
    };

    var listPackageDatasets = function(packageId) {
        var deferred = $q.defer();
        datasetFactory.listPackageDatasets(packageId, function(err, datasets) {
            if (err) {
                console.log('listPackageDatasets - error', err);
                deferred.resolve(null);
            } else {
                deferred.resolve(datasets);
            }
        });
        return deferred.promise;
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

    var loadCreatePackageParams = function() {
        $blockUI.start();

        $q.all([
            listGovernanceRequirements(),
            listGroups()
        ])
        .then(values => {
            $scope.metadataGovernance = values[0];
            $scope.groups['groups'] = values[1];
            $blockUI.stop();
        })
        .catch(function(err) {
            console.log("loadCreatePackageParams Error:", err);
            $blockUI.stop();
        });
    };

    var listGovernanceRequirements = function() {
        var deferred = $q.defer();

        dataPackageFactory.listGovernanceRequirements(function(err, governance) {
            if (err) {
                deferred.resolve([]);
            } else {
                deferred.resolve($_.sortBy(governance, 'governance').reverse());
            }
        });

        return deferred.promise;
    };

    var addManifest = function(cb) {
        if ($scope.newLink.length > 0) {
            for (var i = 0; i < $scope.newLink.length; i++) {
                if ($scope.newLink[i].file) {
                    var file = $scope.newLink[i].file;

                    var _dataset = {
                        name: file.name,
                        type: 'manifest',
                        content_type: file.type === '' ? 'json' : file.type,
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
                        console.log('createDataset error', err);
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

                    }

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
                        console.log('createMetadata error', err);
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
            $scope.validateTag();
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

    $scope.validateTag = function() {
        $scope.invalidMetadata = false;
        if ($scope.newMetadata.length > 0) {
            for (var i = 0; i < $scope.newMetadata.length; i++) {
                if ($scope.newMetadata[i].tag.length === 0 || $scope.newMetadata[i].tag.indexOf(' ') !== -1) {
                    $scope.invalidMetadata = true;
                    return;
                }
            }
        }
    };

    $scope.addToCart = function(package_id) {
        var _item = {
            package_id: package_id
        };

        cartFactory.createCartItem(_item, function(err, data) {
            $blockUI.start();
            $scope.dismissAwsUiAlert();

            if (err) {
                console.log('createCartItem error', err);
                showErrorAlert('An unexpected error occured when attempting to add package to your cart.');
                return;
            }

            cartFactory.getCartCount(function(err, data) {
                if (err) {
                    console.log('getCartCount error', err);
                    showErrorAlert('An unexpected error occured when attempting to retrieve your updated cart items.');
                    return;
                }

                $blockUI.stop();
            });

        });
    };

    $scope.createPackage = function(newpackage, isValid) {
        if (isValid) {
            $blockUI.start();
            $scope.dismissAwsUiAlert();

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
                            showErrorAlert([$scope.metadataGovernance[i].tag, 'is a required field.'].join(' '));
                            return;
                        }
                    } else {
                        showErrorAlert([$scope.metadataGovernance[i].tag, 'is a required field.'].join(' '));
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

            var groupSet = [];
            let processGroups = Object.keys($scope.groups['groups']).map(function(group) {
                if ($scope.groups['all'] || $scope.groups['groups'][group].visible) {
                    groupSet.push(group);
                }
            });
            Promise.all(processGroups).then(function(results) {
                _newpckg.package.groups = groupSet;
                dataPackageFactory.createDataPackage('new', _newpckg, function(err,
                    data) {
                    if (err) {
                        console.log('createDataPackage error', err);
                        if (err.data) {
                            showErrorAlert(err.data);
                        } else {
                            showErrorAlert('An unexpected error occured when attempting to save the new package.');
                        }
                        return;
                    }

                    $state.go('package', {
                        package_id: data.package_id
                    });
                });
            });

        }
    };

    $scope.updatePackage = function(pckg, isValid) {
        if (isValid) {
            $blockUI.start();
            $scope.dismissAwsUiAlert();

            var groupSet = [];
            let processGroups = Object.keys($scope.groups['groups']).map(function(group) {
                if ($scope.groups['all'] || $scope.groups['groups'][group].visible) {
                    groupSet.push(group);
                }
            });
            Promise.all(processGroups).then(function(results) {
                pckg.groups = groupSet;
                dataPackageFactory.updateDataPackage($stateParams.package_id, pckg, function(err,
                    data) {
                    if (err) {
                        console.log('updateDataPackage error', err);
                        showErrorAlert('An unexpected error occured when attempting to save the package.');
                        return;
                    }

                    updatePackageMetadata(function(err, data) {
                        if (err) {
                            console.log('updatePackageMetadata error', err);
                            showErrorAlert('An unexpected error occured when attempting to save the package.');
                            return;
                        }

                        addFiles(function(err, data) {
                            if (err) {
                                console.log('addFiles error', err);
                                showErrorAlert('An unexpected error occured when attempting to save the package.');
                                return;
                            }

                            addManifest(function(err, data) {
                                if (err) {
                                    console.log('addManifest error', err);
                                    showErrorAlert('An unexpected error occured when attempting to save the package.');
                                    return;
                                }

                                getPackageDetails($stateParams.package_id);
                            });

                        });
                    });
                });
            });
        }
    };

    $scope.deleteDataset = function(datasetId, contentType) {
        $scope.deleteModal.show = true;
        $scope.deleteModal.type = (contentType === 'include-path') ? 'include-path' : 'dataset';
        $scope.deleteModal.id = datasetId;
    };

    $scope.deleteManifest = function(manifestId) {
        $scope.deleteModal.show = true;
        $scope.deleteModal.type = 'manifest';
        $scope.deleteModal.id = manifestId;
    };

    $scope.deletePackage = function(packageId) {
        $scope.deleteModal.show = true;
        $scope.deleteModal.type = 'package';
        $scope.deleteModal.id = packageId;
    };

    $scope.closeDeleteModal = function() {
        $scope.deleteModal.show = false;
        $scope.deleteModal.type = '';
        $scope.deleteModal.id = '';
    };

    $scope.confirmDeleteModal = function() {
        $blockUI.start();
        $scope.dismissAwsUiAlert();

        if ($scope.deleteModal.type === 'package') {
            dataPackageFactory.deleteDataPackage($scope.deleteModal.id, function(err, resp) {
                $scope.closeDeleteModal();
                if (err) {
                    console.log('deleteDataPackage error', err);
                    showErrorAlert('An unexpected error occured when attempting to delete the package.');
                    return;
                }

                cartFactory.deletePackage($scope.deleteModal.id, function(err, data) {
                    if (err) {
                        console.log('cartFactory.deletePackage error:', err);
                    }

                    $blockUI.stop();
                    $state.go('search', {});
                });
            });

        } else {
            datasetFactory.deleteDataset($scope.pckg.package_id, $scope.deleteModal.id, function(err, data) {
                $scope.closeDeleteModal();
                if (err) {
                    console.log('deleteDataset error', err);
                    showErrorAlert('An unexpected error occured when attempting to delete the dataset from the package.');
                    return;
                }

                getPackageDetails($scope.pckg.package_id);
            });
        }
    };

    $scope.refresh = function() {
        $scope.dismissAwsUiAlert();
        getPackageDetails($stateParams.package_id);
    };

    if ($stateParams.package_id != 'new') {
        $scope.newPackage = false;
        getPackageDetails($stateParams.package_id);
    } else {
        $scope.newPackage = true;
        loadCreatePackageParams();
    }

    $scope.startCrawler = function(packageId) {
        $scope.dismissAwsUiAlert();
        $blockUI.start();
        dataPackageFactory.startCrawler(packageId, function(err, data) {
            if (err) {
                showErrorAlert(err.data.message);
                return;
            }
            else {
                showSuccessAlert("Your request to run package's crawler was processed successfully.");
            }
        });
    };

    $scope.updateOrCreateCrawler = function(packageId) {
        $scope.dismissAwsUiAlert();
        $blockUI.start();
        dataPackageFactory.updateOrCreateCrawler(packageId, function(err, data) {
            if (err) {
                showErrorAlert(err.data.message);
                return;
            }
            else {
                showSuccessAlert("Your request to update package's crawler was processed successfully.");
            }
        });
    };

    $scope.viewTable = function(tableUrl) {
        $scope.dismissAwsUiAlert();
        var newTab =  window.open();
        newTab.location = tableUrl;
        win.focus();
    };

    $scope.viewTableData = function(packageId, tableName) {
        $scope.dismissAwsUiAlert();
        var newTab =  window.open();
        dataPackageFactory.viewTableData(packageId, tableName, function(err, data) {
            if (err) {
                showErrorAlert(err.data.message);
                return;
            }
            else {
                newTab.location = data.link;
                win.focus();
            }
        });
    };

    $scope.dismissAwsUiAlert = function() {
        $scope.awsUiAlert.show = false;
        $scope.awsUiAlert.criticalError = false;
        $scope.awsUiAlert.type = "";
        $scope.awsUiAlert.header = "";
        $scope.awsUiAlert.content = "";
    };

    var showSuccessAlert = function(message) {
        $scope.awsUiAlert.type = "success";
        $scope.awsUiAlert.header = "Success";
        $scope.awsUiAlert.content = message;
        $scope.awsUiAlert.show = true;
        $scope.awsUiAlert.criticalError = false;
        $blockUI.stop();
    };

    var showErrorAlert = function(message, critical = false) {
        $scope.awsUiAlert.type = "error";
        $scope.awsUiAlert.header = "Error";
        $scope.awsUiAlert.content = message;
        $scope.awsUiAlert.show = true;
        $scope.awsUiAlert.criticalError = critical;
        $blockUI.stop();
    };

});
