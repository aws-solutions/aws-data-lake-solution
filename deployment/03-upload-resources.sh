#!/bin/bash

aws --version >/dev/null 2>&1 || { echo >&2 "I require AWS CLI utility but it's not installed. ¯\_(ツ)_/¯ Aborting."; exit 1; }

source 00-set-environment.sh

aws cloudformation validate-template --template-url https://$DEPLOY_BUCKET.s3-$AWS_REGION.amazonaws.com/data-lake/$VERSION_CODE/global-s3-assets/data-lake-deploy.template
aws cloudformation validate-template --template-url https://$DEPLOY_BUCKET.s3-$AWS_REGION.amazonaws.com/data-lake/$VERSION_CODE/global-s3-assets/data-lake-storage.template
aws cloudformation validate-template --template-url https://$DEPLOY_BUCKET.s3-$AWS_REGION.amazonaws.com/data-lake/$VERSION_CODE/global-s3-assets/data-lake-services.template
aws cloudformation validate-template --template-url https://$DEPLOY_BUCKET.s3-$AWS_REGION.amazonaws.com/data-lake/$VERSION_CODE/global-s3-assets/data-lake-api.template

aws s3 mb s3://$DEPLOY_BUCKET --region $AWS_REGION
aws s3 cp ./dist s3://$DEPLOY_BUCKET/data-lake/$VERSION_CODE --recursive --acl bucket-owner-full-control
