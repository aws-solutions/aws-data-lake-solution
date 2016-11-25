'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

program
    .option('--package-id <value>', 'The package identifier')
    .option('--metadata <list>', 'List of metadata to assign to the package')
    .parse(process.argv);

if (!program.packageId) {
    console.error('option "--package-id <value>" argument required');
    process.exit(1);
}

if (!program.metadata) {
    console.error('option "--metadata <list>" argument required');
    process.exit(1);
}

//get the signed api credentials
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

// send api request
let _apiproxy = new ApiProxy();
let _path = ['/prod/packages/', program.packageId, '/metadata/new'].join('');
let _passedMetadata = [];
try {
    _passedMetadata = JSON.parse(program.metadata);
} catch (ex) {
    console.error('Invalid JSON passed for metadata parameter.');
    process.exit(1);
}

let _metadata = {
    metadata: _passedMetadata
}
_apiproxy.sendApiRequest(_path, 'POST', JSON.stringify(_metadata), _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
