#!/usr/bin/env node

'use strict';

const program = require('commander');

program
    .version('%%VERSION%%')
    .command('add-cart-item [parameters]', 'adds a package to the user\'s cart')
    .command('checkout-cart [parameters]', 'checks out a user\'s cart to generate manifest files for pending cart items')
    .command('create-group [parameters]', 'Creates a new group in the data lake Amazon Cognito user pool.')
    .command('create-package [parameters]', 'creates a new data lake package')
    .command('create-package-metadata [parameters]', 'creates a new data lake package')
    .command('delete-group [parameters]', 'Deletes the specified group from the data lake Amazon Cognito user pool. Currently only groups with no members can be deleted.')
    .command('describe-cart [parameters]', 'describes a user\'s cart')
    .command('describe-cart-item [parameters]', 'describes a item in the user\'s cart')
    .command('describe-package [parameters]', 'describes the details of a package')
    .command('describe-package-dataset [parameters]', 'describes a dataset associated to a package')
    .command('describe-package-datasets [parameters]', 'describes the datasets associated with a package')
    .command('describe-package-metadata [parameters]', 'describes the metadata associated with a package')
    .command('describe-required-metadata', 'list the required metadata for packages')
    .command('execute-package-crawler [parameters]', 'Starts a crawler for the specified package, regardless of what is scheduled. If the crawler is already running, the request is ignored.')
    .command('get-group [parameters]', 'Retrieves a group from the data lake Amazon Cognito user pool.')
    .command('get-package-crawler [parameters]', 'Retrieves crawler metadata for a specified package.')
    .command('get-package-table-data [parameters]', 'Retrieves the external link to view table data in Amazon Athena.')
    .command('get-user-group-list [parameters]', 'Lists the groups that the user belongs to.')
    .command('import-package-manifest [parameters]', 'uploads a new import manifest file for a package')
    .command('list-groups [parameters]', 'Retrieves data lake groups from Amazon Cognito group pool.')
    .command('list-package-tables [parameters]', 'Retrieves the definitions of some or all of the tables in a given package.')
    .command('remove-cart-item [parameters]', 'removes a package from the user\'s cart')
    .command('remove-package [parameters]', 'removes a package from the data lake')
    .command('remove-package-dataset [parameters]', 'removes a dataset from a package')
    .command('remove-user-from-group [parameters]', 'Remove the specified user from the specified group.')
    .command('search [parameters]', 'search data lake')
    .command('update-group [parameters]', 'Updates the specified group with the specified attributes.')
    .command('update-package [parameters]', 'overwrites the details for a package')
    .command('update-package-crawler [parameters]', 'Update the package crawler. If the package does not have one, a new crawler is created.')
    .command('update-user-group-list [parameters]', 'Updates the list of groups that the user belongs to.')
    .command('upload-package-dataset [parameters]', 'uploads a new dataset file for a package');

program.parse(process.argv);