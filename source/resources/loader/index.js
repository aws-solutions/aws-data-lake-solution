'use strict';

let moment = require('moment');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');
let async = require('async');

//get the signed api credentials
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

let sendMockData = function(data, cb) {

    let _payload = data;

    // send api request
    let _apiproxy = new ApiProxy();
    _apiproxy.sendApiRequest('/prod/packages/new', 'POST', JSON.stringify(_payload), _authKey, function(err, data) {
        if (err) {
            // cb(err, null);
            console.log([moment().format('YYYY-MM-DD HH:mm:ss'), 'data load failed..'].join(' '));
            return cb(null, [moment().format('YYYY-MM-DD HH:mm:ss'), 'data load failed..'].join(' '));
        }

        console.log([moment().format('YYYY-MM-DD HH:mm:ss'), 'data loaded succesfully..'].join(' '));
        return cb(null, [moment().format('YYYY-MM-DD HH:mm:ss'), 'data loaded succesfully..'].join(' '));
    });
};

let loadMockData = function(mockdata, index, cb) {
    if (index < mockdata.length) {
        var _index = index;
        sendMockData(mockdata[_index], function(err, data) {
            if (err) {
                console.log(err);
                process.exit(1);
            }

            console.log([data, _index].join(' '));

        });

        index++;
        if ((index % 10) === 0) {
            setTimeout(function() {
                loadMockData(mockdata, index, cb);
            }, 4000);
        } else {
            loadMockData(mockdata, index, cb);
        }

    } else {
        cb(null, 'done processing mock data');
    }
};

let validateJSON = function(body) {
    try {
        let data = JSON.parse(body);
        return data;
    } catch (e) {
        // failed to parse
        console.log('Manifest file contains invalid JSON.');
        return null;
    }
};

let fs = require('fs');
let file = './MOCK_DATA.json';
fs.readFile(file, 'utf8', function(err, data) {
    if (err) {
        console.log('Unable to read mock data file');
        console.log(err);
        process.exit(1);
    }

    let _mockdata = validateJSON(data);
    if (_mockdata) {

        loadMockData(_mockdata, 0, function(err, resp) {
            if (err) {
                console.log('Error occurred loading mock data file');
                console.log(err);
                process.exit(1);
            }

            console.log(resp);
        });

    } else {
        console.log('Invalid JSON in mock data file');
        process.exit(1);
    }

});
