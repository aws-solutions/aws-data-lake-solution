'use strict';

let program = require('commander');
let Creds = require('./core/credentials.js');
let ApiProxy = require('./core/apiproxy.js');
const path = require('path');
const fs = require('fs');
const https = require('https');
const request = require('request');

program
    .option('--package-id <value>', 'package identifier')
    .option('--file <file path>', 'path to manifest file')
    .parse(process.argv);

if (!program.packageId) {
    console.error('option "--package-id <value>" argument required');
    process.exit(1);
}

if (!program.file) {
    console.error('option "--file <file path>" argument required');
    process.exit(1);
}

let _stats = fs.lstat(program.file, function(err, stats) {
    if (err) {
        console.error('error accessing provided --file argument');
        process.exit(1);
    }

    //get the signed api credentials
    let _creds = new Creds();
    let _authKey = _creds.getAuthSignature();

    // send api request
    let _apiproxy = new ApiProxy();
    let _basename = path.basename(program.file);

    let _payload = JSON.stringify({
        name: _basename,
        type: 'manifest',
        content_type: 'application/json'
    });
    let _path = ['/prod/packages/', program.packageId, '/datasets/new'].join('');
    _apiproxy.sendApiRequest(_path, 'POST', _payload, _authKey, function(err, data) {
        if (err) {
            console.log(err);
            process.exit(1);
        }

        let _stream = fs.createReadStream(program.file);

        var options = {
            url: data.uploadUrl,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': stats.size
            }
        };

        fs.createReadStream(program.file).pipe(request.put(options).on('response', function(response) {
            if (response.statusCode !== 200) {
                console.log('The manifest entry was created, but the file failed to upload.');
                process.exit(1);
            }

            let _processPath = ['/prod/packages/', program.packageId, '/datasets/', data.dataset_id,
                '/process'
            ].join('');
            _apiproxy.sendApiRequest(_processPath, 'POST', '{}', _authKey, function(err,
                resp) {
                if (err) {
                    console.log(err);
                    process.exit(1);
                }

                let _datasetPath = ['/prod/packages/', program.packageId, '/datasets/',
                    data.dataset_id
                ].join('');
                _apiproxy.sendApiRequest(_datasetPath, 'GET', null, _authKey, function(
                    err, dataset) {
                    if (err) {
                        console.log(err);
                        process.exit(1);
                    }

                    console.log(JSON.stringify(dataset));
                });

            });
        }));
    });
});
