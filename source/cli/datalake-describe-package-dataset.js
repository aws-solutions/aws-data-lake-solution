'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

program
    .option('--package-id <value>', 'package identifier')
    .option('--dataset-id <value>', 'dataset identifier')
    .parse(process.argv);

if (!program.packageId) {
    console.error('option "--package-id <value>" argument required');
    process.exit(1);
}

if (!program.datasetId) {
    console.error('option "--dataset-id <value>" argument required');
    process.exit(1);
}

//get the signed api credentials
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

// send api request
let _apiproxy = new ApiProxy();
let _path = ['/prod/packages/', program.packageId, '/datasets/', program.datasetId].join('');
_apiproxy.sendApiRequest(_path, 'GET', null, _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
