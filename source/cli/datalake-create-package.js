'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

program
    .option('--package-name <value>', 'Name of the package')
    .option('--package-description <value>', 'Description of the package')
    .option('--metadata <value>', 'List of metadata to assign to the package')
    .parse(process.argv);

if (!program.packageName) {
    console.error('option "--package-name <value>" argument required');
    process.exit(1);
}

if (!program.packageDescription) {
    console.error('option "--package-description <value>" argument required');
    process.exit(1);
}

let _payload = {
    package: {
        name: program.packageName,
        description: program.packageDescription
    }
};

if (program.metadata) {
    _payload.metadata = JSON.parse(program.metadata);
}

//get the signed api credentials
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

// send api request
let _apiproxy = new ApiProxy();
_apiproxy.sendApiRequest('/prod/packages/new', 'POST', JSON.stringify(_payload), _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
