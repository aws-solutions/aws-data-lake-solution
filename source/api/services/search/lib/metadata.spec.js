'use strict';

let assert = require('assert');
let AWS = require('aws-sdk-mock');
let es = require('elasticsearch');
const cAssert = require('chai').assert;
const expect = require('chai').expect;

let Metadata = require('../../search/lib/metadata.js');

describe('Metadata', function() {
    describe('#search', function() {

        before(function() {
            let estub = this.sandbox.stub(es, 'Client', function(params, cb) {
                return {
                    search: function(params, cb) {
                        return new Promise(function(fulfill, reject) {
                            if (params.index === 'test-index') {
                                if (params.q === 'test') {
                                    fulfill({
                                        hits: {
                                            hits: [{
                                                _source: 'test result'
                                            }]
                                        }
                                    });
                                } else {
                                    fulfill({
                                        hits: {
                                            hits: []
                                        }
                                    });
                                }
                            } else {
                                reject({
                                    message: 'Error: Invalid index provided.'
                                });
                            }
                        });
                    }
                };
            });
        });

        afterEach(function() {
            AWS.restore('DynamoDB.DocumentClient');
        });

        it('should return error with no valid configuration', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, {});
            });

            let _metadata = new Metadata();
            _metadata.search('test', function(err, data) {
                if (err) {
                    expect(err).to.deep.equal({
                        error: {
                            message: 'No valid app configuration data available.'
                        }
                    }, 'Correct error returned for invalid configuration data');
                    done();
                } else {
                    done('error was not returned.');
                }
            });
        });

        it('should return results with valid configuration and terms', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, {
                    Item: {
                        setting: {
                            esurl: 'cluster.test',
                            esindex: 'test-index',
                            searchResultsLimit: 100
                        }
                    }
                });
            });

            let _metadata = new Metadata();
            _metadata.search('test', function(err, data) {
                if (err) done(err);
                else {
                    expect(data.Items).to.not.be.empty;
                    done();
                }
            });
        });

        it('should return no results with valid configuration and term not found', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, {
                    Item: {
                        setting: {
                            esurl: 'cluster.test',
                            esindex: 'test-index',
                            searchResultsLimit: 100
                        }
                    }
                });
            });

            let _metadata = new Metadata();
            _metadata.search('invalid,term', function(err, data) {
                if (err) done(err);
                else {
                    expect(data.Items).to.be.empty;
                    done();
                }
            });
        });

        it('should return an error with an invalid configuration', function(done) {

            AWS.mock('DynamoDB.DocumentClient', 'get', function(params, callback) {
                callback(null, {
                    Item: {
                        setting: {
                            esurl: 'cluster.test',
                            esindex: 'invalid-index',
                            searchResultsLimit: 100
                        }
                    }
                });
            });

            let _metadata = new Metadata();
            _metadata.search('test', function(err, data) {
                if (err) {
                    expect(err.message).to.equal('Error: Invalid index provided.');
                    done();
                } else {
                    done('An error was not thrown with invalid configuration');
                }
            });
        });

    });
});
