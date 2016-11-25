'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

program
    .option('--package-id <value>', 'package identifier')
    .option('--package-name <value>', 'Updated package name')
    .option('--package-description <value>', 'Updated package description')
    .parse(process.argv);

if (!program.packageId) {
    console.error('option "--package-id <value>" argument required');
    process.exit(1);
}

let _payload = {};

if (program.packageName) {
    _payload.name = program.packageName;
}

if (program.packageDescription) {
    _payload.description = program.packageDescription;
}

//get the signed api credentials
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

// send api request
let _apiproxy = new ApiProxy();
let _path = ['/prod/packages/', program.packageId].join('');
_apiproxy.sendApiRequest(_path, 'PUT', JSON.stringify(_payload), _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
