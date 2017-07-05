rm -r ./dist

mkdir ./dist

cp ./data-lake-deploy.yaml ./dist/data-lake-deploy.template
cp ./data-lake-storage.yaml ./dist
cp ./data-lake-services.yaml ./dist
cp ./data-lake-api.yaml ./dist

replace="s/%%BUCKET_NAME%%/$DEPLOY_BUCKET/g"
sed -i '' -e $replace dist/data-lake-deploy.template

cd ../source/console
npm install bower
node_modules/bower/bin/bower install --allow-root
cd ../../deployment

mkdir -p ./dist/site/admin
mkdir -p ./dist/site/cart
mkdir -p ./dist/site/common
mkdir -p ./dist/site/confirm
mkdir -p ./dist/site/dashboard
mkdir -p ./dist/site/forgot
mkdir -p ./dist/site/images
cp -R ../source/console/app/admin/* ./dist/site/admin
cp -R ../source/console/app/cart/* ./dist/site/cart
cp -R ../source/console/app/common/* ./dist/site/common
cp -R ../source/console/app/confirm/* ./dist/site/confirm
cp -R ../source/console/app/dashboard/* ./dist/site/dashboard
cp -R ../source/console/app/forgot/* ./dist/site/forgot
cp -R ../source/console/app/images/* ./dist/site/images
mkdir ./dist/site/lib
cp -R ../source/console/app/lib/aws-ui ./dist/site/lib/aws-ui
cp -R ../source/console/app/lib/cognito ./dist/site/lib/cognito
mkdir -p ./dist/site/lib/bower_components/bootstrap/dist/css
cp ../source/console/app/lib/bower_components/bootstrap/dist/css/bootstrap.min.css ./dist/site/lib/bower_components/bootstrap/dist/css/bootstrap.min.css
mkdir -p ./dist/site/lib/bower_components/angular-block-ui/dist
cp ../source/console/app/lib/bower_components/angular-block-ui/dist/angular-block-ui.min.css ./dist/site/lib/bower_components/angular-block-ui/dist/angular-block-ui.min.css
mkdir -p ./dist/site/lib/bower_components/aws-sdk/dist
cp ../source/console/app/lib/bower_components/aws-sdk/dist/aws-sdk.min.js ./dist/site/lib/bower_components/aws-sdk/dist/aws-sdk.min.js
mkdir -p ./dist/site/lib/bower_components/jsbn
cp ../source/console/app/lib/bower_components/jsbn/jsbn.js ./dist/site/lib/bower_components/jsbn/jsbn.js
cp ../source/console/app/lib/bower_components/jsbn/jsbn2.js ./dist/site/lib/bower_components/jsbn/jsbn2.js
mkdir -p ./dist/site/lib/bower_components/sjcl
cp ../source/console/app/lib/bower_components/sjcl/sjcl.js ./dist/site/lib/bower_components/sjcl/sjcl.js
mkdir -p ./dist/site/lib/bower_components/moment/min
cp ../source/console/app/lib/bower_components/moment/min/moment.min.js ./dist/site/lib/bower_components/moment/min/moment.min.js
mkdir -p ./dist/site/lib/bower_components/underscore
cp ../source/console/app/lib/bower_components/underscore/underscore-min.js ./dist/site/lib/bower_components/underscore/underscore-min.js
mkdir -p ./dist/site/lib/bower_components/angular
cp ../source/console/app/lib/bower_components/angular/angular.js ./dist/site/lib/bower_components/angular/angular.js
mkdir -p ./dist/site/lib/bower_components/angular-resource
cp ../source/console/app/lib/bower_components/angular-resource/angular-resource.min.js ./dist/site/lib/bower_components/angular-resource/angular-resource.min.js
mkdir -p ./dist/site/lib/bower_components/angular-ui-router/release
cp ../source/console/app/lib/bower_components/angular-ui-router/release/angular-ui-router.min.js ./dist/site/lib/bower_components/angular-ui-router/release/angular-ui-router.min.js
mkdir -p ./dist/site/lib/bower_components/angular-messages
cp ../source/console/app/lib/bower_components/angular-messages/angular-messages.min.js ./dist/site/lib/bower_components/angular-messages/angular-messages.min.js
mkdir -p ./dist/site/main
mkdir -p ./dist/site/package
mkdir -p ./dist/site/profile
mkdir -p ./dist/site/search
mkdir -p ./dist/site/signin
mkdir -p ./dist/site/styles
cp -R ../source/console/app/main/* ./dist/site/main
cp -R ../source/console/app/package/* ./dist/site/package
cp -R ../source/console/app/profile/* ./dist/site/profile
cp -R ../source/console/app/search/* ./dist/site/search
cp -R ../source/console/app/signin/* ./dist/site/signin
cp -R ../source/console/app/styles/* ./dist/site/styles
cp ../source/console/app/app.js ./dist/site
cp ../source/console/app/index.html ./dist/site
find ./dist/site -name "*_test.js" -type f -delete

cd ../source/cli
zip -rq ../../deployment/dist/datalake-cli-bundle.zip .

cd ../api/authorizer
npm install
npm test
npm run build
npm run zip
cp ./dist/data-lake-authorizer.zip ../../../deployment/dist/data-lake-authorizer.zip

cd ../services/admin
npm install
npm run build
npm run zip
cp ./dist/data-lake-admin-service.zip ../../../../deployment/dist/data-lake-admin-service.zip

cd ../cart
npm install
npm run build
npm run zip
cp ./dist/data-lake-cart-service.zip ../../../../deployment/dist/data-lake-cart-service.zip

cd ../logging
npm install
npm run build
npm run zip
cp ./dist/data-lake-logging-service.zip ../../../../deployment/dist/data-lake-logging-service.zip

cd ../manifest
npm install
npm run build
npm run zip
cp ./dist/data-lake-manifest-service.zip ../../../../deployment/dist/data-lake-manifest-service.zip

cd ../package
npm install
npm run build
npm run zip
cp ./dist/data-lake-package-service.zip ../../../../deployment/dist/data-lake-package-service.zip

cd ../profile
npm install
npm run build
npm run zip
cp ./dist/data-lake-profile-service.zip ../../../../deployment/dist/data-lake-profile-service.zip

cd ../search
npm install
npm run build
npm run zip
cp ./dist/data-lake-search-service.zip ../../../../deployment/dist/data-lake-search-service.zip

cd ../../../resources/helper
npm install
npm run build
npm run zip
cp ./dist/data-lake-helper.zip ../../../deployment/dist/data-lake-helper.zip

cd ../../../deployment/manifest-generator
npm install
node app.js
