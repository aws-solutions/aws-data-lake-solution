#!/bin/bash

aws --version >/dev/null 2>&1 || { echo >&2 "I require AWS CLI utility but it's not installed. ¯\_(ツ)_/¯ Aborting."; exit 1; }

source 00-set-environment.sh

export AWS_ACCOUNT_ID=<YOUR_AWS_ACCOUNT_ID>

# Delete CloudWatch Log Group
aws logs delete-log-group --log-group-name /aws/lambda/data-lake-helper

# Delete log Buckets
aws s3 rb s3://data-lake-$AWS_ACCOUNT_ID-eu-west-1-s3-access-log --force
aws s3 rb s3://data-lake-$AWS_ACCOUNT_ID-eu-west-1-cf-access-log --force

# Delete Stack
aws cloudformation delete-stack --stack-name $STACK_NAME >> /dev/null
