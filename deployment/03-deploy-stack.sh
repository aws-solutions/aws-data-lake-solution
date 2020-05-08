#!/bin/bash

aws --version >/dev/null 2>&1 || { echo >&2 "I require AWS CLI utility but it's not installed. ¯\_(ツ)_/¯ Aborting."; exit 1; }

clear

export STACK_NAME=data-lake-base

read -p 'AdministratorName? >' ADMIN_NAME

read -p 'AdministratorName? >' ADMIN_NAME
read -p 'AdministratorEmail? >' ADMIN_EMAIL
read -p 'CognitoDomain? >' COGNITO_DOMAIN

# Deploy workspace
aws cloudformation deploy \
    --template-file s3://${DEPLOY_BUCKET}/data-lake/$VERSION_CODE/global-s3-assets/data-lake-deploy.template \
    --stack-name ${STACK_NAME} \
    --region ${AWS_REGION} \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        AdministratorName=${ADMIN_NAME} \
        AdministratorEmail=${ADMIN_EMAIL} \
        CognitoDomain=${COGNITO_DOMAIN} \
    --tags \
      Owner=${ADMIN_NAME} \
      Email=${ADMIN_EMAIL} \
      Version=${VERSION_CODE}

if [ $? -ne 0 ]; then
    echo "Problem running deploy. Please check errors"
    exit $?
fi

aws cloudformation update-termination-protection \
    --enable-termination-protection \
    --stack-name ${STACK_NAME} \
    --region ${AWS_REGION}
