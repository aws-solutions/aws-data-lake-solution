"use strict";

let AWS = require('aws-sdk');
let moment = require('moment');
let _ = require('underscore');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials

const dynamoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};
const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
const cloudwatchlogs = new AWS.CloudWatchLogs({
    region: process.env.AWS_REGION
});
const ddbTable = 'data-lake-settings';
const logName = '/datalake/audit-log';

let logging = (function() {

    let logging = function() {};

    logging.prototype.createEntry = function(entry, cb) {

        getLoggingTokenInfo(function(err, token) {
            if (err) {
                return cb(err, null);
            }

            putAccessLogEvent(entry.message, token.Item, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                    return cb(err, null);
                } else {
                    return cb(null, data);
                }
            });
        });


    };

    let createAccessLogGroup = function(cb) {
        let params = {
            logGroupName: logName
        };
        cloudwatchlogs.createLogGroup(params, function(err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
                return cb(err, null);
            } else {
                console.log(data); // successful response
                return cb(null, data);
            }
        });
    };

    let createAccessLogStream = function(cb) {
        let params = {
            logGroupName: logName,
            logStreamName: moment.utc().format('YYYY/MM/DD/[access]')
        };
        cloudwatchlogs.createLogStream(params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                return cb(err, null);
            } else {
                console.log(data);
                return cb(null, data);
            }
        });
    };

    let putAccessLogEvent = function(message, token, cb) {

        console.log(token)

        let _logstream = moment.utc().format('YYYY/MM/DD/[access]');

        let params = {
            logEvents: [{
                message: message,
                timestamp: moment.utc().format('x')
            }],
            logGroupName: logName,
            logStreamName: _logstream
        };

        if (!_.isEmpty(token)) {
            if (token.setting.stream === _logstream) {
                params.sequenceToken = token.setting.sequence;
            }
        }
        console.log(params)
            // return;

        cloudwatchlogs.putLogEvents(params, function(err, data) {
            if (err) {
                console.log(err, err.stack);
                if (err.code === 'ResourceNotFoundException' && err.message ===
                    'The specified log group does not exist.') {
                    createAccessLogGroup(function(err, data) {
                        if (err) {
                            return cb(null, {
                                error: {
                                    message: 'Unable to create a data lake access log group'
                                }
                            });
                        }

                        createAccessLogStream(function(err, data) {
                            if (err) {
                                return cb(null, {
                                    error: {
                                        message: 'Unable to create a data lake access log stream for today.'
                                    }
                                });
                            }

                            putAccessLogEvent(message, token, cb);
                        });
                    });
                } else if (err.code === 'ResourceNotFoundException' && err.message ===
                    'The specified log stream does not exist.') {
                    createAccessLogStream(function(err, data) {
                        if (err) {
                            return cb(null, {
                                error: {
                                    message: 'Unable to create a data lake access log stream for today.'
                                }
                            });
                        }

                        putAccessLogEvent(message, token, cb);
                    });
                } else {
                    return cb(null, {
                        error: {
                            message: 'Unable to create the log entry.'
                        }
                    });
                }
            } else {
                updateLoggingToken(_logstream, data.nextSequenceToken, function(err, updateData) {
                    if (err) {
                        console.log("Error updating logging token settings [ddb].", err);
                    }
                    return cb(null, data);
                });
            }
        });
    };

    let getLoggingTokenInfo = function(cb) {
        console.log("Retrieving logging-token information...")
        let params = {
            TableName: ddbTable,
            Key: {
                setting_id: "logging-token"
            }
        };

        docClient.get(params, function(err, config) {
            if (err) {
                console.log(err);
                return cb("Error retrieving logging token settings [ddb].",
                    null);
            }

            cb(null, config);
        });
    };

    let updateLoggingToken = function(stream, token, cb) {

        let _setting = {
            setting_id: "logging-token",
            setting: {
                stream: stream,
                sequence: token
            },
            type: 'logging',
            created_at: moment.utc().format(),
            updated_at: moment.utc().format()
        };
        let params = {
            TableName: ddbTable,
            Item: _setting
        };

        docClient.put(params, function(err, data) {
            if (err) {
                console.log(err);
                return cb(err, null);
            }

            return cb(null, _setting);
        });


    };

    return logging;

})();

module.exports = logging;
