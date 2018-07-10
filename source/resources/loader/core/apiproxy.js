'use strict';
let https = require('https');

let apiproxy = (function() {

    let apiproxy = function() {};

    apiproxy.prototype.sendApiRequest = function(path, method, body, authkey, cb) {
        if (!process.env.DATALAKE_ENDPOINT_HOST) {
            console.error('DATALAKE_ENDPOINT_HOST environment variable is not defined.');
            process.exit(1);
        }

        let _options = buildRequestOptionSet(path, method, authkey);
        let request = https.request(_options, function(response) {
            // data is streamed in chunks from the server
            // so we have to handle the "data" event
            let buffer = '',
                data,
                route;

            response.on('data', function(chunk) {
                buffer += chunk;
            });

            response.on('end', function(err) {
                data = JSON.parse(buffer);
                cb(null, data);
            });
        });

        if (body) {
            request.write(body);
        }

        request.end();

        request.on('error', (e) => {
            console.error(e);
            cb(['Error occurred when sending', process.env.APIG_ENDPOINT_HOST, path, 'request.'].join(
                ' '), null);
        });
    };

    let buildRequestOptionSet = function(apipath, apimethod, authkey) {
        let _options = {
            hostname: process.env.DATALAKE_ENDPOINT_HOST,
            port: 443,
            path: apipath,
            method: apimethod,
            headers: {
                Auth: ['ak', authkey].join(':')
            }
        };
        return _options;
    };

    return apiproxy;

})();

module.exports = apiproxy;
