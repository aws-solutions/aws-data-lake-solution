'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

program
    .option('--cart-item-id <value>', 'cart item identifier')
    .parse(process.argv);

if (!program.cartItemId) {
    console.error('option "--cart-item-id <value>" argument required');
    process.exit(1);
}

//get the signed api credentials
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

// send api request
let _apiproxy = new ApiProxy();
let _path = ['/prod/cart/', program.cartItemId].join('');
_apiproxy.sendApiRequest(_path, 'GET', null, _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
