# Change Log 
All notable changes to this project will be documented in this file. 
 
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), 
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). 
 
## [2.1.1] - 2019-08-28 
### Added 
- CHANGELOG templated file 

## [2.2.0] - 2019-12-18
### Updated
- Migrated lambda function runtimes to Nodejs 12.x
- Changes to shell script and manifest generator to fix build pipeline
- Fixed unit test failures for api/services/package
- Updated Software License to Apache 2.0 license and added 3rd party library licenses to License.txt
- Updated package.json for all modules to specify library version numbers
- Added 'Update' event type for custom lambda resource to allow CloudFormation Stack to be updated from version 2.1
- Fix for GitHub issues #38, #37, #34, #28, #26, #24