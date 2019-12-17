#!/bin/bash 
# 
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned 
# 
# This script should be run from the repo's deployment directory 
# cd deployment 
# ./build-s3-dist.sh source-bucket-base-name trademarked-solution-name version-code 
# 
# Paramenters: 
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda 
#    code from. The template will append '-[region_name]' to this bucket name. 
#    For example: ./build-s3-dist.sh solutions my-solution v1.0.0 cf-template-bucket
#    The template will then expect the source code to be located in the solutions-[region_name] bucket 
# 
#  - trademarked-solution-name: name of the solution for consistency 
# 
#  - version-code: version of the package 
 
# Check to see if input has been provided:
[ "$DEBUG" == 'true' ] && set -x
set -e

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ]; then 
    echo "Please provide the base source bucket name, trademark approved solution name and version where the lambda code will eventually reside." 
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.0.0 cf-template-bucket" 
    exit 1 
fi 
 
# Get reference for all important folders 
template_dir="$PWD" 
template_dist_dir="$template_dir/global-s3-assets" 
build_dist_dir="$template_dir/regional-s3-assets" 
source_dir="$template_dir/../source" 

echo "------------------------------------------------------------------------------" 
echo "[Init] Clean old dist, node_modules and bower_components folders" 
echo "------------------------------------------------------------------------------" 
echo "rm -rf $template_dist_dir" 
rm -rf $template_dist_dir 
echo "mkdir -p $template_dist_dir" 
mkdir -p $template_dist_dir 
echo "rm -rf $build_dist_dir" 
rm -rf $build_dist_dir 
echo "mkdir -p $build_dist_dir" 
mkdir -p $build_dist_dir 

echo "------------------------------------------------------------------------------"
echo "[Packing] Templates"
echo "------------------------------------------------------------------------------"
for file in $template_dir/*.template
do
    echo "cp $file $template_dist_dir/"
    cp $file $template_dist_dir/
done

echo "------------------------------------------------------------------------------" 
echo "[Updating Source Bucket name]"
echo "------------------------------------------------------------------------------" 
replace="s/%%BUCKET_NAME%%/$1/g"
for file in $template_dist_dir/*.template
do
    echo "sed -i  -e $replace $file" 
    sed -i  -e $replace $file
done

echo "------------------------------------------------------------------------------" 
echo "[Updating Template Bucket name]"
echo "------------------------------------------------------------------------------" 
replace="s/%%TEMPLATE_BUCKET_NAME%%/$4/g"
for file in $template_dist_dir/*.template
do
    echo "sed -i  -e $replace $file"
    sed -i  -e $replace $file
done

echo "------------------------------------------------------------------------------" 
echo "[Updating Solution name]"
echo "------------------------------------------------------------------------------" 
replace="s/%%SOLUTION_NAME%%/$2/g"
for file in $template_dist_dir/*.template
do
    echo "sed -i  -e $replace $file"
    sed -i  -e $replace $file
done

echo "------------------------------------------------------------------------------" 
echo "[Updating version name]"
echo "------------------------------------------------------------------------------" 
replace="s/%%VERSION%%/$3/g"
for file in $template_dist_dir/*.template
do
    echo "sed -i  -e $replace $file"
    sed -i  -e $replace $file
done

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Console"
echo "------------------------------------------------------------------------------"
cd $source_dir/console
npm install bower
node_modules/bower/bin/bower install --allow-root

mkdir -p $build_dist_dir/site/admin
cp -R $source_dir/console/app/admin/* $build_dist_dir/site/admin
mkdir -p $build_dist_dir/site/cart
cp -R $source_dir/console/app/cart/* $build_dist_dir/site/cart
mkdir -p $build_dist_dir/site/common
cp -R $source_dir/console/app/common/* $build_dist_dir/site/common
mkdir -p $build_dist_dir/site/confirm
cp -R $source_dir/console/app/confirm/* $build_dist_dir/site/confirm
mkdir -p $build_dist_dir/site/dashboard
cp -R $source_dir/console/app/dashboard/* $build_dist_dir/site/dashboard
mkdir -p $build_dist_dir/site/forgot
cp -R $source_dir/console/app/forgot/* $build_dist_dir/site/forgot
mkdir -p $build_dist_dir/site/images
cp -R $source_dir/console/app/images/* $build_dist_dir/site/images

mkdir $build_dist_dir/site/lib
cp -R $source_dir/console/app/lib/aws-ui $build_dist_dir/site/lib/aws-ui
cp -R $source_dir/console/app/lib/cognito $build_dist_dir/site/lib/cognito
mkdir -p $build_dist_dir/site/lib/bower_components/bootstrap/dist/css
cp $source_dir/console/app/lib/bower_components/bootstrap/dist/css/bootstrap.min.css $build_dist_dir/site/lib/bower_components/bootstrap/dist/css/bootstrap.min.css
mkdir -p $build_dist_dir/site/lib/bower_components/angular-block-ui/dist
cp $source_dir/console/app/lib/bower_components/angular-block-ui/dist/angular-block-ui.min.css $build_dist_dir/site/lib/bower_components/angular-block-ui/dist/angular-block-ui.min.css
mkdir -p $build_dist_dir/site/lib/bower_components/aws-sdk/dist
cp $source_dir/console/app/lib/bower_components/aws-sdk/dist/aws-sdk.min.js $build_dist_dir/site/lib/bower_components/aws-sdk/dist/aws-sdk.min.js
mkdir -p $build_dist_dir/site/lib/bower_components/jsbn
cp $source_dir/console/app/lib/bower_components/jsbn/jsbn.js $build_dist_dir/site/lib/bower_components/jsbn/jsbn.js
cp $source_dir/console/app/lib/bower_components/jsbn/jsbn2.js $build_dist_dir/site/lib/bower_components/jsbn/jsbn2.js
mkdir -p $build_dist_dir/site/lib/bower_components/sjcl
cp $source_dir/console/app/lib/bower_components/sjcl/sjcl.js $build_dist_dir/site/lib/bower_components/sjcl/sjcl.js
mkdir -p $build_dist_dir/site/lib/bower_components/moment/min
cp $source_dir/console/app/lib/bower_components/moment/min/moment.min.js $build_dist_dir/site/lib/bower_components/moment/min/moment.min.js
mkdir -p $build_dist_dir/site/lib/bower_components/underscore
cp $source_dir/console/app/lib/bower_components/underscore/underscore-min.js $build_dist_dir/site/lib/bower_components/underscore/underscore-min.js
mkdir -p $build_dist_dir/site/lib/bower_components/angular
cp $source_dir/console/app/lib/bower_components/angular/angular.js $build_dist_dir/site/lib/bower_components/angular/angular.js
mkdir -p $build_dist_dir/site/lib/bower_components/angular-resource
cp $source_dir/console/app/lib/bower_components/angular-resource/angular-resource.min.js $build_dist_dir/site/lib/bower_components/angular-resource/angular-resource.min.js
mkdir -p $build_dist_dir/site/lib/bower_components/angular-ui-router/release
cp $source_dir/console/app/lib/bower_components/angular-ui-router/release/angular-ui-router.min.js $build_dist_dir/site/lib/bower_components/angular-ui-router/release/angular-ui-router.min.js
mkdir -p $build_dist_dir/site/lib/bower_components/angular-messages
cp $source_dir/console/app/lib/bower_components/angular-messages/angular-messages.min.js $build_dist_dir/site/lib/bower_components/angular-messages/angular-messages.min.js

mkdir -p $build_dist_dir/site/main
cp -R $source_dir/console/app/main/* $build_dist_dir/site/main
mkdir -p $build_dist_dir/site/package
cp -R $source_dir/console/app/package/* $build_dist_dir/site/package
mkdir -p $build_dist_dir/site/profile
cp -R $source_dir/console/app/profile/* $build_dist_dir/site/profile
mkdir -p $build_dist_dir/site/search
cp -R $source_dir/console/app/search/* $build_dist_dir/site/search
mkdir -p $build_dist_dir/site/signin
cp -R $source_dir/console/app/signin/* $build_dist_dir/site/signin
mkdir -p $build_dist_dir/site/styles
cp -R $source_dir/console/app/styles/* $build_dist_dir/site/styles

cp $source_dir/console/app/app.js $build_dist_dir/site
cp $source_dir/console/app/index.html $build_dist_dir/site
find $build_dist_dir/site -name "*.spec.js" -type f -delete
find $build_dist_dir/site -name "*_test.js" -type f -delete
find $build_dist_dir/site -type f -name '.DS_Store' -delete

echo "------------------------------------------------------------------------------"
echo "[Rebuild] CLI"
echo "------------------------------------------------------------------------------"
cp -r $source_dir/cli $build_dist_dir/cli
replace="s/%%VERSION%%/$2/g"
sed -i  -e $replace $build_dist_dir/cli/datalake.js
cd $build_dist_dir/cli
zip -q -r9 $build_dist_dir/datalake-cli-bundle.zip .
rm -fR $build_dist_dir/cli

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Helper"
echo "------------------------------------------------------------------------------"
cd $source_dir/resources/helper
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Helper. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
zip -q -r9 $build_dist_dir/data-lake-helper.zip *
zip -d $build_dist_dir/data-lake-helper.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Authorizer"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/authorizer
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Authorizer. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
zip -q -r9 $build_dist_dir/data-lake-authorizer.zip *
zip -d $build_dist_dir/data-lake-authorizer.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Admin"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/admin
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Admin. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
zip -q -r9 $build_dist_dir/data-lake-admin-service.zip *
zip -d $build_dist_dir/data-lake-admin-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Cart"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/cart
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Cart. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
zip -q -r9 $build_dist_dir/data-lake-cart-service.zip *
zip -d $build_dist_dir/data-lake-cart-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Logging"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/logging
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Login. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
zip -q -r9 $build_dist_dir/data-lake-logging-service.zip *
zip -d $build_dist_dir/data-lake-logging-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Manifest"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/manifest
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Manifest. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
zip -q -r9 $build_dist_dir/data-lake-manifest-service.zip *
zip -d $build_dist_dir/data-lake-manifest-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Package"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/package
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Package. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
zip -q -r9 $build_dist_dir/data-lake-package-service.zip *
zip -d $build_dist_dir/data-lake-package-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Profile"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/profile
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Profile. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
zip -q -r9 $build_dist_dir/data-lake-profile-service.zip *
zip -d $build_dist_dir/data-lake-profile-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Rebuild] API - Search"
echo "------------------------------------------------------------------------------"
cd $source_dir/api/services/search
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Search. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
zip -q -r9 $build_dist_dir/data-lake-search-service.zip *
zip -d $build_dist_dir/data-lake-search-service.zip '*.spec.js' '*_test.js'

echo "------------------------------------------------------------------------------"
echo "[Run] Manifest Generator"
echo "------------------------------------------------------------------------------"
cd $template_dir/manifest-generator
npm install --production
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Manifest Generator for website. Error Code: ${build_status}" 
    exit ${build_status} 
fi 
node app.js $build_dist_dir