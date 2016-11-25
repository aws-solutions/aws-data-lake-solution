'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

program
    .option('--format <format>', 'Manifest format', 'SIGNED_URL')
    .option('--package-id <identifier>', 'package json object')
    .parse(process.argv);

if (!program.format) {
    console.error('option "--format <format>" argument required');
    process.exit(1);
}

if (program.format !== 'SIGNED_URL' && program.format !== 'BUCKET_KEY') {
    console.error('option "--format <format>" argument required to be SIGNED_URL or BUCKET_KEY');
    process.exit(1);
}

//get the signed api credentials
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

// send api request
let _apiproxy = new ApiProxy();
let _format = program.format === 'BUCKET_KEY' ? 'bucket-key' : 'signed-url';
let _path = '/prod/cart/';
let _payload = JSON.stringify({
    operation: 'checkout',
    format: _format
});

_apiproxy.sendApiRequest(_path, 'POST', _payload, _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
