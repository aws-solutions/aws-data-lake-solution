'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

program
    .option('--package-id <identifier>', 'package json object')
    .parse(process.argv);

if (!program.packageId) {
    console.error('option "--package-id <identifier>" argument required');
    process.exit(1);
}

//get the signed api credentials
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

// send api request
let _apiproxy = new ApiProxy();
let _path = '/prod/cart/new';
let _payload = JSON.stringify({
    package_id: program.packageId
});
_apiproxy.sendApiRequest(_path, 'POST', _payload, _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
