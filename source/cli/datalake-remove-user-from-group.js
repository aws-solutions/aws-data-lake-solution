'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');

//-----------------------------------------------------------------------------
// validate input
//-----------------------------------------------------------------------------
program
    .option('--user-id <value>', 'Username of account to be removed from the user pool group.')
    .option('--group-name <value>', 'The name of the group to be updated.')
    .parse(process.argv);

if (!program.userId) {
    console.error('option "--user-id <value>" argument required');
    process.exit(1);
}
if (!program.groupName) {
    console.error('option "--group-name <value>" argument required');
    process.exit(1);
}

//-----------------------------------------------------------------------------
// get the signed api credentials
//-----------------------------------------------------------------------------
let _creds = new Creds();
let _authKey = _creds.getAuthSignature();

//-----------------------------------------------------------------------------
// send api request
//-----------------------------------------------------------------------------
let _apiproxy = new ApiProxy();
let _path = `/prod/admin/groups/${encodeURI(program.groupName)}/`;
let _payload = JSON.stringify({
    action: 'removeUserFromGroup',
    userId: program.userId
});

//-----------------------------------------------------------------------------
// print result
//-----------------------------------------------------------------------------
_apiproxy.sendApiRequest(_path, 'POST', _payload, _authKey, function(err, data) {
    if (err) {
        console.log(err);
        process.exit(1);
    }

    console.log(JSON.stringify(data));
});
