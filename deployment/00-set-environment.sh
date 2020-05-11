#!/bin/bash

clear

echo "┌─┐┬ ┬┌─┐  ┌┬┐┌─┐┌┬┐┌─┐   ┬  ┌─┐┬┌─┌─┐  ┌─┐┌─┐┬  ┬ ┬┌┬┐┬┌─┐┌┐┌";
echo "├─┤│││└─┐───││├─┤ │ ├─┤───│  ├─┤├┴┐├┤───└─┐│ ││  │ │ │ ││ ││││";
echo "┴ ┴└┴┘└─┘  ─┴┘┴ ┴ ┴ ┴ ┴   ┴─┘┴ ┴┴ ┴└─┘  └─┘└─┘┴─┘└─┘ ┴ ┴└─┘┘└┘";
echo "More info at https://github.com/awslabs/aws-data-lake-solution";

export AWS_REGION=eu-west-1                     # Choose between
export STACK_NAME=data-lake-base                # Optional
export DEPLOY_BUCKET=dl-deploy-<ACCOUNT_ID>     # Add some random token or account id
export VERSION_CODE=2.2.0                       # Last version according Changelog.md

