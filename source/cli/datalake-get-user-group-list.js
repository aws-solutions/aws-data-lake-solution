'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

//-----------------------------------------------------------------------------
// validate input
//-----------------------------------------------------------------------------
program
    .option('--user-id <value>', 'Username of account to list groups.')
    .parse(process.argv);

if (!program.userId) {
    console.error('option "--user-id <value>" argument required');
    process.exit(1);
}
program.userId = encodeURIComponent(program.userId);

//-----------------------------------------------------------------------------
// get the signed api credentials
//-----------------------------------------------------------------------------
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

//-----------------------------------------------------------------------------
// send api request
//-----------------------------------------------------------------------------
let _apiproxy = new ApiProxy();
let _path = `/prod/admin/groups/membership/${program.userId}`;
let _payload = JSON.stringify({
});

//-----------------------------------------------------------------------------
// print result
//-----------------------------------------------------------------------------
_apiproxy.sendApiRequest(_path, 'GET', _payload, _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
