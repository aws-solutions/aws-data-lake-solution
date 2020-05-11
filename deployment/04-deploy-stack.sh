#!/bin/bash

aws --version >/dev/null 2>&1 || { echo >&2 "I require AWS CLI utility but it's not installed. ¯\_(ツ)_/¯ Aborting."; exit 1; }

source 00-set-environment.sh

# Interactive
#read -p 'AdministratorName? ' ADMIN_NAME
#read -p 'AdministratorEmail? ' ADMIN_EMAIL
#read -p 'CognitoDomain? ' COGNITO_DOMAIN    # Be careful choosing this name, the collision could be difficult to found.

# Hardcoded
export ADMIN_NAME="<YOUR_NAME>"
export ADMIN_EMAIL="<YOUR_EMAIL>"
export COGNITO_DOMAIN=random-<RANDOM_TOKEN>  # Be careful choosing this name, the collision could be difficult to found.

# Deploy possible changes in templates
aws s3 sync ./dist s3://$DEPLOY_BUCKET/data-lake/$VERSION_CODE

# Deploy workspace
aws cloudformation deploy \
    --template-file ./dist/global-s3-assets/data-lake-deploy.template \
    --stack-name ${STACK_NAME} \
    --region ${AWS_REGION} \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        AdministratorName="$ADMIN_NAME" \
        AdministratorEmail=$ADMIN_EMAIL \
        CognitoDomain=$COGNITO_DOMAIN \
    --tags \
      Owner="$ADMIN_NAME" \
      Email=$ADMIN_EMAIL \
      Version=$VERSION_CODE

if [ $? -ne 0 ]; then
    echo "Problem running deploy. Please check errors"
    exit $?
fi

aws cloudformation update-termination-protection \
    --enable-termination-protection \
    --stack-name ${STACK_NAME} \
    --region ${AWS_REGION}
