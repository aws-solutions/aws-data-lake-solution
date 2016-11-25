'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

program
    .parse(process.argv);

//get the signed api credentials
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

// send api request
let _apiproxy = new ApiProxy();
let _path = '/prod/cart/';
_apiproxy.sendApiRequest(_path, 'GET', null, _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
