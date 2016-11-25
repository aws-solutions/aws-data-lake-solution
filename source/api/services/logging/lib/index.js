"use strict";

let AWS = require('aws-sdk');
let logging = require('./logging.js');

module.exports.respond = function(event, cb) {

    let _logging = new logging();
    _logging.createEntry(event, cb);

}
