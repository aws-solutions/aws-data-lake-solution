#!/usr/bin/env node

'use strict';

const program = require('commander');

program
    .version('0.9.0')
    .command('add-cart-item [parameters]', 'adds a package to the user\'s cart')
    .command('checkout-cart [parameters]', 'checks out a user\'s cart to generate manifest files for pending cart items')
    .command('describe-cart [parameters]', 'describes a user\'s cart')
    .command('create-package-metadata [parameters]', 'creates a new data lake package')
    .command('create-package [parameters]', 'creates a new data lake package')
    .command('describe-cart-item [parameters]', 'describes a item in the user\'s cart')
    .command('describe-package-metadata [parameters]', 'describes the metadata associated with a package')
    .command('describe-package-dataset [parameters]', 'describes a dataset associated to a package')
    .command('describe-package-datasets [parameters]', 'describes the datasets associated with a package')
    .command('describe-package [parameters]', 'describes the details of a package')
    .command('describe-required-metadata', 'list the required metadata for packages')
    .command('import-package-manifest [parameters]', 'uploads a new import manifest file for a package')
    .command('remove-cart-item [parameters]', 'removes a package from the user\'s cart')
    .command('remove-package-dataset [parameters]', 'removes a dataset from a package')
    .command('remove-package [parameters]', 'removes a package from the data lake')
    .command('search [parameters]', 'search data lake')
    .command('update-package [parameters]', 'overwrites the details for a package')
    .command('upload-package-dataset [parameters]', 'uploads a new dataset file for a package');

program.parse(process.argv);
