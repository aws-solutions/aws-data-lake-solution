/*********************************************************************************************************************
 *  Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance        *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://aws.amazon.com/asl/                                                                                    *
 *                                                                                                                    *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/**
 * @author Solution Builders
 */

'use strict';

let AWS = require('aws-sdk');
let AccessValidator = require('access-validator');
let _ = require('underscore');

let creds = new AWS.EnvironmentCredentials('AWS'); // Lambda provided credentials
const cognitoConfig = {
    credentials: creds,
    region: process.env.AWS_REGION
};

/**
 * Performs CRUD operations for data lake groups interfacing primiarly with the data lake
 * Amazon Cogntio user pool.
 *
 * @class group
 */
let group = (function() {

    let accessValidator = new AccessValidator();

    /**
     * @class group
     * @constructor
     */
    let group = function() {};

    /**
     * Retrieves data lake groups from Amazon Cognito group pool .
     * @param {listGroups~requestCallback} cb - The callback that handles the response.
     */
    group.prototype.listGroups = function(ticket, cb) {

        if(process.env.FEDERATED_LOGIN == 'true') {
            let params = {
                UserPoolId: process.env.USER_POOL_ID,
                Username: ticket.userid
            };

            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
            cognitoidentityserviceprovider.adminGetUser(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb(err.message, null);
                }

                let _groups = _.where(data.UserAttributes, {
                    Name: 'custom:groups'
                });
                if (_groups.length > 0) {
                    let _result = {"Groups": []};
                    _groups = _groups[0].Value.replace('[','').replace(']','').split(',');
                    for (var i = _groups.length - 1; i >= 0; i--) {
                        _result.Groups.push({
                            "GroupName": _groups[i],
                            "UserPoolId": process.env.USER_POOL_ID,
                            "Description": "Imported from AD",
                            "LastModifiedDate": "",
                            "CreationDate": ""
                        });
                    }

                    return cb(null, _result);
                }
            });

        } else {
          let params = {
              UserPoolId: process.env.USER_POOL_ID
          };
          let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider(cognitoConfig);
          cognitoidentityserviceprovider.listGroups(params, function(err, data) {
              if (err) {
                  console.log(err);
                  return cb({code: 502, message: "Failed to retrieves the group list."}, null);
              }

              return cb(null, data);
          });
        }
    };

    /**
     * Creates a new group in the data lake Amazon Cognito user pool.
     *
     * @param {string} groupName - The name of the group. Must be unique and satisfy regular expression pattern [\p{L}\p{M}\p{S}\p{N}\p{P}]+
     * @param {string} description - A string containing the description of the group.
     * @param {createGroup~requestCallback} cb - The callback that handles the response.
     */
    group.prototype.createGroup = function(groupName, description, ticket, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        accessValidator.validateAdminAccess(ticket, function(err, data) {
            if (err) {
                return cb(err, null);
            }

            var params = {
              UserPoolId: process.env.USER_POOL_ID,
              GroupName: groupName,
              Description: description
            };
            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider(cognitoConfig);
            cognitoidentityserviceprovider.createGroup(params, function(err, data) {
                if (err) {
                    console.log(err);
                    if (err.code == 'GroupExistsException') {
                        return cb({code: 400, message: `Group ${groupName} already exists. Try to edit the existing one.`}, null);
                    } else {
                        return cb({code: 502, message: `Failed to create the group. Ask datalake admin to check data-lake-admin-service logs for details.`}, null);
                    }
                }

                return cb(null, {code: 200, message: `Group ${groupName} created.`});
            });
        });

    };

    /**
     * Updates the specified group with the specified attributes.
     *
     * @param {string} groupName - The name of the group to be updated.
     * @param {string} description - A string containing the description of the group.
     * @param {updateGroup~requestCallback} cb - The callback that handles the response.
     */
    group.prototype.updateGroup = function(groupName, description, ticket, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        accessValidator.validateAdminAccess(ticket, function(err, data) {
            if (err) {
                return cb(err, null);
            }

            var params = {
              UserPoolId: process.env.USER_POOL_ID,
              GroupName: groupName,
              Description: description
            };
            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider(cognitoConfig);
            cognitoidentityserviceprovider.updateGroup(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: `Failed to update the specified group. Params: groupName:${groupName} - description:${description}`}, null);
                }

                return cb(null, {code: 200, message: `Group ${groupName} updated.`});
            });
        });

    };


    /**
     * Remove the specified user from the specified group.
     *
     * @param {string} userId - Username of account to be removed from the user pool group.
     * @param {string} groupName - The name of the group to be updated.
     * @param {updateGroup~requestCallback} cb - The callback that handles the response.
     */
    group.prototype.removeUserFromGroup = function(userId, groupName, ticket, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        accessValidator.validateAdminAccess(ticket, function(err, data) {
            if (err) {
                return cb(err, null);
            }

            var params = {
              GroupName: groupName,
              UserPoolId: process.env.USER_POOL_ID,
              Username: userId
            };
            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider(cognitoConfig);
            cognitoidentityserviceprovider.adminRemoveUserFromGroup(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: `Failed to remove User ${userId} from group ${groupName}.`}, null);
                }

                return cb(null, {code: 200, message: `User ${userId} removed from group ${groupName}.`});
            });
        });

    };

    /**
     * Retrieves a group from the data lake Amazon Cognito user pool.
     *
     * @param {string} groupName - The name of the group to retrive information.
     * @param {getGroup~requestCallback} cb - The callback that handles the response.
     */
    group.prototype.getGroup = function(groupName, ticket, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        accessValidator.validateAdminAccess(ticket, function(err, data) {
            if (err) {
                return cb(err, null);
            }

            let params = {
              UserPoolId: process.env.USER_POOL_ID,
              GroupName: groupName
            };
            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider(cognitoConfig);

            Promise.all([
                cognitoidentityserviceprovider.getGroup(params).promise(),
                cognitoidentityserviceprovider.listUsersInGroup(params).promise()

            ]).then(function(values) {
                let result = values[0].Group;
                result.UserList = [];


                let processUsers = values[1].Users.map(function(user) {
                    let newUser = {
                        user_id: user.Username,
                        enabled: user.Enabled,
                        status: user.UserStatus
                    };

                    let processAttributes = user.Attributes.map(function(att) {
                        if (att.Name == 'email') {
                            newUser.email = att.Value;
                        } else if (att.Name == 'custom:display_name') {
                            newUser.name = att.Value;
                        } else if (att.Name == 'custom:role') {
                            newUser.role = att.Value;
                        }
                    });

                    Promise.all(processAttributes).then(function(results) {
                        result.UserList.push(newUser);
                    })
                });

                Promise.all(processUsers).then(function(results) {
                    return cb(null, result);
                })

            }).catch(function(err) {
                console.log(err);
                return cb({code: 502, message: `Failed to retrieve the specified group. Params: groupName:${groupName}`}, null);
            });
        });

    };

    /**
     * Deletes the specified group from the data lake Amazon Cognito user pool.
     * Currently only groups with no members can be deleted.
     *
     * @param {string} groupName - The name of the group to be deleted.
     * @param {deleteGroup~requestCallback} cb - The callback that handles the response.
     */
    group.prototype.deleteGroup = function(groupName, ticket, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        accessValidator.validateAdminAccess(ticket, function(err, data) {
            if (err) {
                return cb(err, null);
            }

            let params = {
              UserPoolId: process.env.USER_POOL_ID,
              GroupName: groupName
            };
            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider(cognitoConfig);
            cognitoidentityserviceprovider.deleteGroup(params, function(err, data) {
                if (err) {
                    console.log(err);
                    return cb({code: 502, message: `Failed to delete the specified group. Params: groupName:${groupName}`}, null);
                }

                return cb(null, {code: 200, message: `Group ${groupName} deleted.`});
            });
        });

    };

    /**
     * Lists the groups that the user belongs to.
     *
     * @param {string} userId - Username of account to list groups.
     * @param {getUserGroups~requestCallback} cb - The callback that handles the response.
     */
    group.prototype.getUserGroups = function(userId, ticket, cb) {

        accessValidator.validateAdminAccess(ticket, function(err, data) {
            if (err) {
                return cb(err, null);
            }

            if(process.env.FEDERATED_LOGIN == 'true') {
                let params = {
                    UserPoolId: process.env.USER_POOL_ID,
                    Username: userId
                };

                let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
                cognitoidentityserviceprovider.adminGetUser(params, function(err, data) {
                    if (err) {
                        console.log(err);
                        return cb(err.message, null);
                    }

                    let _groups = _.where(data.UserAttributes, {
                        Name: 'custom:groups'
                    });
                    if (_groups.length > 0) {
                        let _result = {"Groups": []};
                        _groups = _groups[0].Value.replace('[','').replace(']','').split(',');
                        for (var i = _groups.length - 1; i >= 0; i--) {
                            _result.Groups.push({
                                "GroupName": _groups[i],
                                "UserPoolId": process.env.USER_POOL_ID,
                                "Description": "Imported from AD",
                                "LastModifiedDate": "",
                                "CreationDate": ""
                            });
                        }

                        return cb(null, _result);
                    }
                });

            } else {
                let params = {
                  UserPoolId: process.env.USER_POOL_ID,
                  Username: userId
                };
                let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider(cognitoConfig);
                cognitoidentityserviceprovider.adminListGroupsForUser(params, function(err, data) {
                    if (err) {
                        console.log(err);
                        return cb({code: 502, message: `Failed to list the groups that the user belongs to.`}, null);
                    }

                    return cb(null, data);
                });
            }
        });

    };

    /**
     * Updates the list of groups that the user belongs to.
     *
     * @param {string} userId - Username of account to be updated.
     * @param {object} groupSet - List of groups that the user currently belongs to.
     * @param {updateUserMembership~requestCallback} cb - The callback that handles the response.
     */
    group.prototype.updateUserMembership = function(userId, groupSet, ticket, cb) {
        if(process.env.FEDERATED_LOGIN == 'true') {
            return cb({code: 404, message: "Function not valid for federated login."}, null);
        }

        accessValidator.validateAdminAccess(ticket, function(err, data) {
            if (err) {
                return cb(err, null);
            }


            let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider(cognitoConfig);

            let currentGroupSet = [];
            let params = {
              UserPoolId: process.env.USER_POOL_ID,
              Username: userId
            };
            cognitoidentityserviceprovider.adminListGroupsForUser(params).promise()
            .then(function(data) {
                return Promise.all(
                    data.Groups.map(function(group) {
                        return group.GroupName;
                    })
                );
            })
            .then(function(currentGroupSet) {

                // Add Groups
                let groupsToAdd = groupSet.map(function(group) {
                    if (currentGroupSet.indexOf(group) == -1) {
                        var params = {
                            GroupName: group,
                            UserPoolId: process.env.USER_POOL_ID,
                            Username: userId
                        };
                        return cognitoidentityserviceprovider.adminAddUserToGroup(params).promise();
                    }
                });

                // Remove Groups
                let groupsToRemove = currentGroupSet.map(function(group) {
                    if (groupSet.indexOf(group) == -1) {
                        var params = {
                            GroupName: group,
                            UserPoolId: process.env.USER_POOL_ID,
                            Username: userId
                        };
                        return cognitoidentityserviceprovider.adminRemoveUserFromGroup(params).promise();
                    }
                });

                return Promise.all([Promise.all(groupsToAdd), Promise.all(groupsToRemove)]);
            })
            .then(function(results) {
                return cb(null, {code: 200, message: `${userId} membership list updated.`});
            })
            .catch(function(err) {
                console.log(err);
                return cb({code: 502, message: `Failed to update ${userId} membership list`}, null);
            });
        });

    };

    return group;

})();

module.exports = group;
