#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh
#

# Get reference for all important folders
template_dir="$PWD"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "[Init] Clean old dist and node_modules folders"
echo "------------------------------------------------------------------------------"
echo "find $source_dir -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null"
find $source_dir -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null

echo "find $source_dir -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null"
find $source_dir -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null

echo "find ../ -type f -name 'package-lock.json' -delete"
find $source_dir -type f -name 'package-lock.json' -delete

echo "------------------------------------------------------------------------------"
echo "[Test] Helper"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/helper
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] Access Validator"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/access-validator
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] API - Authorizer"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/authorizer
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] API - Admin"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/admin
npm install
npm dedupe
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] API - Cart"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/cart
npm install
npm dedupe
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] API - Logging"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/logging
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] API - Manifest"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/manifest
npm install
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] API - Package"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/package
npm install
npm dedupe
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] API - Profile"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/profile
npm install
npm dedupe
npm test

echo "------------------------------------------------------------------------------"
echo "[Test] API - Search"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/search
npm install
npm dedupe
npm test
