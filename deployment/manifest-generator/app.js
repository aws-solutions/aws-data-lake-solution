/*********************************************************************************************************************
 *  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance        *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://aws.amazon.com/asl/                                                                                    *
 *                                                                                                                    *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/**
 * @author Solution Builders
 */

'use strict';

const fs = require('fs');
const path = require('path');

let getFileList = function(path) {
    let fileInfo;
    let filesFound;
    let fileList = [];

    filesFound = fs.readdirSync(path);
    for (let i = 0; i < filesFound.length; i++) {
        fileInfo = fs.lstatSync([path, filesFound[i]].join('/'));
        if (fileInfo.isFile()) {
            fileList.push(filesFound[i]);
        }

        if (fileInfo.isDirectory()) {
            console.log([path, filesFound[i]].join('/'));
        }
    }

    return fileList;
};

// List all files in a directory in Node.js recursively in a synchronous fashion
let walkSync = function(dir, filelist) {
    // let filelist = []; //getFileList('./temp/site');
    let files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function(file) {
        if (fs.statSync(path.join(dir, file)).isDirectory()) {
            filelist = walkSync(path.join(dir, file), filelist);
        } else {
            filelist.push(path.join(dir, file));
        }
    });

    return filelist;
};

let _filelist = [];
let _manifest = {
    files: []
};
walkSync('../dist/site', _filelist);

for (let i = 0; i < _filelist.length; i++) {
    _manifest.files.push(_filelist[i].replace('../dist/site/', ''));
};

console.log(_manifest);
fs.writeFile('../dist/data-lake-site-manifest.json', JSON.stringify(_manifest, null, 4));
