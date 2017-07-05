# Data Lake Solution

Many Amazon Web Services (AWS) customers require a data storage and analytics solution that offers more agility and flexibility than traditional data management systems. A data lake is an increasingly popular way to store and analyze data because it allows businesses to store all of their data, structured and unstructured, in a centralized repository. The AWS Cloud provides many of the building blocks required to help businesses implement a secure, flexible, and cost-effective data lake.

The data lake solution is an automated reference implementation that deploys a highly available, cost-effective data lake architecture on the AWS Cloud.  The solution is intended to address common customer pain points around conceptualizing data lake architectures, and automatically configures the core AWS services necessary to easily tag, search, share, and govern specific subsets of data across a business or with other external businesses. This solution allows users to catalog new datasets, and to create data profiles for existing datasets in Amazon Simple Storage Service (Amazon S3) with minimal effort.

For the full solution overview visit [Data Lake on AWS](https://aws.amazon.com/answers/big-data/data-lake-solution).

For help when using the data lake solution, visit the [online help guide](http://docs.awssolutionsbuilder.com/data-lake/).

## Getting Started

#### Prerequisites
* [AWS Command Line Interface](https://aws.amazon.com/cli/)
* Node.js 6.x

The data lake solution is developed with Node.js for the microservices that run in AWS Lambda and Angular 1.x for the console user interface. The latest version of the data lake solution has been tested with Node.js v6.10.

#### Build the data lake solution
Clone the aws-data-lake-solution GitHub repository:
```
git clone https://github.com/awslabs/aws-data-lake-solution.git
```

Run the data lake solution unit tests:
```
cd aws-data-lake-solution/deployment
./run-unit-tests.sh
```

Build the data lake solution for deployment:
* Run build script
```
cd aws-data-lake-solution/deployment
export DEPLOY_BUCKET=<Amazon S3 bucket to store deployment assets>
./build-s3-dist.sh
```
* Upload deployment assets to your Amazon S3 bucket:
```
aws s3 cp ./dist s3://$DEPLOY_BUCKET/data-lake/latest --recursive --acl bucket-owner-full-control
```

Deploy the data lake solution:
* From your designated Amazon S3 bucket where you uploaded the deployment assets, copy the link location for the data-lake-deploy.template.
* Using AWS CloudFormation, launch the data lake solution stack using the copied Amazon S3 link for the data-lake-deploy.template.

> Currently, the data lake solution can be deployed in the following regions: [ us-east-1, us-east-2, us-west-2, eu-west-1, eu-west-2, eu-central-1, ap-northeast-1, ap-northeast-2, ap-southeast-2, ap-south-1 ]

## Cloudformation templates

- cform/data-lake-deploy.yaml
- cform/data-lake-storage.yaml
- cform/data-lake-services.yaml
- cform/data-lake-api.yaml

## Source

- source/api/authorizer: custom data lake authorizer for API Gateway
- source/api/services/admin: A microservice function for admin functionality of the data lake
- source/api/services/cart: A microservice function for interacting with the data lake cart
- source/api/services/logging: A microservice function for logging data lake activity
- source/api/services/manifest: A microservice function for importing and generating data lake manifest files
- source/api/services/package: A microservice function for interacting with the data lake packages
- source/api/services/profile: A microservice function for interacting with the data lake user profiles
- source/api/services/search: A microservice function for interacting with the data lake search engine
- source/cli: Data Lake Command Line Interface
- source/console: Data Lake user interface console
- source/resources/helper: Data Lake custom resource helper function to support AWS CloudFormation deployment

***

Copyright 2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

    http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions and limitations under the License.
