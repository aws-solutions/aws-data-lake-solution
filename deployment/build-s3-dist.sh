#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-bucket-base-name version-code
#
# Paramenters:
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda
#    code from. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh solutions v2.1
#    The template will then expect the source code to be located in the solutions-[region_name] bucket
#
#  - version-code: version of the package

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Please provide the base source bucket name and version where the lambda code will eventually reside."
    echo "For example: ./build-s3-dist.sh solutions v1.0.0"
    exit 1
fi

# Get reference for all important folders
template_dir="$PWD"
dist_dir="$template_dir/dist"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "[Init] Clean old dist, node_modules and bower_components folders"
echo "------------------------------------------------------------------------------"
echo "rm -rf $dist_dir"
rm -rf $dist_dir
echo "find $source_dir -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null"
find $source_dir -iname "node_modules" -type d -exec rm -r "{}" \; 2> /dev/null
echo "find $source_dir -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null"
find $source_dir -iname "dist" -type d -exec rm -r "{}" \; 2> /dev/null
echo "find $source_dir -iname "bower_components" -type d -exec rm -r "{}" \; 2> /dev/null"
find $source_dir -iname "bower_components" -type d -exec rm -r "{}" \; 2> /dev/null
echo "find ../ -type f -name 'package-lock.json' -delete"
find $source_dir -type f -name 'package-lock.json' -delete
echo "find ../ -type f -name '.DS_Store' -delete"
find $source_dir -type f -name '.DS_Store' -delete
echo "mkdir -p $dist_dir"
mkdir -p $dist_dir

echo "------------------------------------------------------------------------------"
echo "[Packing] Templates"
echo "------------------------------------------------------------------------------"
echo "cp $template_dir/data-lake-deploy.yaml $dist_dir/data-lake-deploy.template"
cp $template_dir/data-lake-deploy.yaml $dist_dir/data-lake-deploy.template
echo "cp $template_dir/data-lake-deploy-federated.yaml $dist_dir/data-lake-deploy-federated.template"
cp $template_dir/data-lake-deploy-federated.yaml $dist_dir/data-lake-deploy-federated.template
echo "cp $template_dir/data-lake-storage.yaml $dist_dir"
cp $template_dir/data-lake-storage.yaml $dist_dir
echo "cp $template_dir/data-lake-services.yaml $dist_dir"
cp $template_dir/data-lake-services.yaml $dist_dir
echo "cp $template_dir/data-lake-api.yaml $dist_dir"
cp $template_dir/data-lake-api.yaml $dist_dir

echo "Updating code source bucket in template with $1"
replace="s/%%BUCKET_NAME%%/$1/g"
echo "sed -i '' -e $replace $dist_dir/data-lake-deploy.template"
sed -i '' -e $replace $dist_dir/data-lake-deploy.template
echo "Updating code source version in template with $2"
replace="s/%%VERSION%%/$2/g"
echo "sed -i '' -e $replace $dist_dir/data-lake-deploy.template"
sed -i '' -e $replace $dist_dir/data-lake-deploy.template

echo "Updating code source bucket in template with $1"
replace="s/%%BUCKET_NAME%%/$1/g"
echo "sed -i '' -e $replace $dist_dir/data-lake-deploy-federated.template"
sed -i '' -e $replace $dist_dir/data-lake-deploy-federated.template
echo "Updating code source version in template with $2"
replace="s/%%VERSION%%/$2/g"
echo "sed -i '' -e $replace $dist_dir/data-lake-deploy-federated.template"
sed -i '' -e $replace $dist_dir/data-lake-deploy-federated.template

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Console"
echo "------------------------------------------------------------------------------"
cd $source_dir/console
npm install bower
node_modules/bower/bin/bower install --allow-root

mkdir -p $dist_dir/site/admin
cp -R $source_dir/console/app/admin/* $dist_dir/site/admin
mkdir -p $dist_dir/site/cart
cp -R $source_dir/console/app/cart/* $dist_dir/site/cart
mkdir -p $dist_dir/site/common
cp -R $source_dir/console/app/common/* $dist_dir/site/common
mkdir -p $dist_dir/site/confirm
cp -R $source_dir/console/app/confirm/* $dist_dir/site/confirm
mkdir -p $dist_dir/site/dashboard
cp -R $source_dir/console/app/dashboard/* $dist_dir/site/dashboard
mkdir -p $dist_dir/site/forgot
cp -R $source_dir/console/app/forgot/* $dist_dir/site/forgot
mkdir -p $dist_dir/site/images
cp -R $source_dir/console/app/images/* $dist_dir/site/images

mkdir $dist_dir/site/lib
cp -R $source_dir/console/app/lib/aws-ui $dist_dir/site/lib/aws-ui
cp -R $source_dir/console/app/lib/cognito $dist_dir/site/lib/cognito
mkdir -p $dist_dir/site/lib/bower_components/bootstrap/dist/css
cp $source_dir/console/app/lib/bower_components/bootstrap/dist/css/bootstrap.min.css $dist_dir/site/lib/bower_components/bootstrap/dist/css/bootstrap.min.css
mkdir -p $dist_dir/site/lib/bower_components/angular-block-ui/dist
cp $source_dir/console/app/lib/bower_components/angular-block-ui/dist/angular-block-ui.min.css $dist_dir/site/lib/bower_components/angular-block-ui/dist/angular-block-ui.min.css
mkdir -p $dist_dir/site/lib/bower_components/aws-sdk/dist
cp $source_dir/console/app/lib/bower_components/aws-sdk/dist/aws-sdk.min.js $dist_dir/site/lib/bower_components/aws-sdk/dist/aws-sdk.min.js
mkdir -p $dist_dir/site/lib/bower_components/jsbn
cp $source_dir/console/app/lib/bower_components/jsbn/jsbn.js $dist_dir/site/lib/bower_components/jsbn/jsbn.js
cp $source_dir/console/app/lib/bower_components/jsbn/jsbn2.js $dist_dir/site/lib/bower_components/jsbn/jsbn2.js
mkdir -p $dist_dir/site/lib/bower_components/sjcl
cp $source_dir/console/app/lib/bower_components/sjcl/sjcl.js $dist_dir/site/lib/bower_components/sjcl/sjcl.js
mkdir -p $dist_dir/site/lib/bower_components/moment/min
cp $source_dir/console/app/lib/bower_components/moment/min/moment.min.js $dist_dir/site/lib/bower_components/moment/min/moment.min.js
mkdir -p $dist_dir/site/lib/bower_components/underscore
cp $source_dir/console/app/lib/bower_components/underscore/underscore-min.js $dist_dir/site/lib/bower_components/underscore/underscore-min.js
mkdir -p $dist_dir/site/lib/bower_components/angular
cp $source_dir/console/app/lib/bower_components/angular/angular.js $dist_dir/site/lib/bower_components/angular/angular.js
mkdir -p $dist_dir/site/lib/bower_components/angular-resource
cp $source_dir/console/app/lib/bower_components/angular-resource/angular-resource.min.js $dist_dir/site/lib/bower_components/angular-resource/angular-resource.min.js
mkdir -p $dist_dir/site/lib/bower_components/angular-ui-router/release
cp $source_dir/console/app/lib/bower_components/angular-ui-router/release/angular-ui-router.min.js $dist_dir/site/lib/bower_components/angular-ui-router/release/angular-ui-router.min.js
mkdir -p $dist_dir/site/lib/bower_components/angular-messages
cp $source_dir/console/app/lib/bower_components/angular-messages/angular-messages.min.js $dist_dir/site/lib/bower_components/angular-messages/angular-messages.min.js

mkdir -p $dist_dir/site/main
cp -R $source_dir/console/app/main/* $dist_dir/site/main
mkdir -p $dist_dir/site/package
cp -R $source_dir/console/app/package/* $dist_dir/site/package
mkdir -p $dist_dir/site/profile
cp -R $source_dir/console/app/profile/* $dist_dir/site/profile
mkdir -p $dist_dir/site/search
cp -R $source_dir/console/app/search/* $dist_dir/site/search
mkdir -p $dist_dir/site/signin
cp -R $source_dir/console/app/signin/* $dist_dir/site/signin
mkdir -p $dist_dir/site/styles
cp -R $source_dir/console/app/styles/* $dist_dir/site/styles

cp $source_dir/console/app/app.js $dist_dir/site
cp $source_dir/console/app/index.html $dist_dir/site
find $dist_dir/site -name "*.spec.js" -type f -delete
find $dist_dir/site -name "*_test.js" -type f -delete
find $dist_dir/site -type f -name '.DS_Store' -delete

echo "------------------------------------------------------------------------------"
echo "[Rebuild] CLI"
echo "------------------------------------------------------------------------------"
cp -r $source_dir/cli $dist_dir/cli
replace="s/%%VERSION%%/$2/g"
sed -i '' -e $replace $dist_dir/cli/datalake.js
cd $dist_dir/cli
zip -rq $dist_dir/datalake-cli-bundle.zip .
zip -d $dist_dir/datalake-cli-bundle.zip '*.spec.js' '*_test.js'
rm -fR $dist_dir/cli

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Helper"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/helper
npm install --production
zip -q -r9 $dist_dir/data-lake-helper.zip *
zip -d $dist_dir/data-lake-helper.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Authorizer"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/authorizer
npm install --production
zip -q -r9 $dist_dir/data-lake-authorizer.zip *
zip -d $dist_dir/data-lake-authorizer.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Admin"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/admin
npm install --production
zip -q -r9 $dist_dir/data-lake-admin-service.zip *
zip -d $dist_dir/data-lake-admin-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Cart"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/cart
npm install --production
zip -q -r9 $dist_dir/data-lake-cart-service.zip *
zip -d $dist_dir/data-lake-cart-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Loggin"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/logging
npm install --production
zip -q -r9 $dist_dir/data-lake-logging-service.zip *
zip -d $dist_dir/data-lake-logging-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Manifest"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/manifest
npm install --production
zip -q -r9 $dist_dir/data-lake-manifest-service.zip *
zip -d $dist_dir/data-lake-manifest-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Package"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/package
npm install --production
zip -q -r9 $dist_dir/data-lake-package-service.zip *
zip -d $dist_dir/data-lake-package-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Profile"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/profile
npm install --production
zip -q -r9 $dist_dir/data-lake-profile-service.zip *
zip -d $dist_dir/data-lake-profile-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Search"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/search
npm install --production
zip -q -r9 $dist_dir/data-lake-search-service.zip *
zip -d $dist_dir/data-lake-search-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Run] Manifest Generator"
echo "------------------------------------------------------------------------------"
cd $template_dir/manifest-generator
npm install --production
node app.js
