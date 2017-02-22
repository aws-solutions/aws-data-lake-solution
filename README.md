# Data Lake Solution

Many Amazon Web Services (AWS) customers require a data storage and analytics solution that offers more agility and flexibility than traditional data management systems. A data lake is an increasingly popular way to store and analyze data because it allows businesses to store all of their data, structured and unstructured, in a centralized repository. The AWS Cloud provides many of the building blocks required to help businesses implement a secure, flexible, and cost-effective data lake.

The data lake solution is an automated reference implementation that deploys a highly available, cost-effective data lake architecture on the AWS Cloud.  The solution is intended to address common customer pain points around conceptualizing data lake architectures, and automatically configures the core AWS services necessary to easily tag, search, share, and govern specific subsets of data across a business or with other external businesses. This solution allows users to catalog new datasets, and to create data profiles for existing datasets in Amazon Simple Storage Service (Amazon S3) with minimal effort.

For the full solution overview visit [Data Lake on AWS](https://aws.amazon.com/answers/big-data/data-lake-solution).

For help when using the data lake solution, visit the [online help guide](http://docs.awssolutionsbuilder.com/data-lake/).

## Cloudformation templates

- cform/data-lake-deploy.yaml
- cform/data-lake-storage.yaml
- cform/data-lake-services.yaml
- cform/data-lake-api.yaml

## Cloudformation templates (Isolated IAM)

These templates are used when you need to deploy the IAM roles first as an administrator user, then use the others to deploy as a user that does not have privileges on IAM.

- cform-isolated-iam/data-lake-iam.yaml (run as administrator)
- cform-isolated-iam/data-lake-deploy.yaml
- cform-isolated-iam/data-lake-storage.yaml
- cform-isolated-iam/data-lake-services.yaml
- cform-isolated-iam/data-lake-api.yaml

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
