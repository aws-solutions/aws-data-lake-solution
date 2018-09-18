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

angular.module('dataLake.service.auth', ['dataLake.utils'])
    .service('authService', function($q, $_, $localstorage, $location, $resource) {

        if (FEDERATED_LOGIN) {
            this.authData = {
                ClientId : YOUR_USER_POOL_CLIENT_ID,
                AppWebDomain : LOGIN_URL.split('/')[2],
                TokenScopesArray : ['email', 'openid'],
                RedirectUriSignIn : LOGIN_URL.split('redirect_uri=')[1],
                RedirectUriSignOut : LOGOUT_URL.split('logout_uri=')[1],
                IdentityProvider : 'SAML',
                UserPoolId : YOUR_USER_POOL_ID,
                AdvancedSecurityDataCollectionFlag : true
            };
            if ($location.$$path.indexOf('id_token=') >= 0 && $location.$$path.indexOf('access_token=') >= 0) {
                var auth = new AmazonCognitoIdentity.CognitoAuth(this.authData);
                auth.userhandler = {
                    onSuccess: function(result) {
                        console.log('Updated authentication tokens');
                    },
                    onFailure: function(err) {
                        console.log('Failed to process authentication tokens');
                    }
                };
                auth.parseCognitoWebResponse($location.$$absUrl.replace('/#/', '/#'));
            }
        } else {
            this.poolData = {
                UserPoolId: YOUR_USER_POOL_ID,
                ClientId: YOUR_USER_POOL_CLIENT_ID,
                Paranoia: 8
            };
        }

        var forgotPasswordResource = function() {
            var _url = [APIG_ENDPOINT, 'admin/users/:userId/forgotPassword'].join('/');
            return $resource(_url, {
                userId: '@id'
            }, {
                forgotPassword: {
                    method: 'POST',
                    headers: {}
                }
            });
        };

        var userResource = function(token) {
            var _url = [APIG_ENDPOINT, 'admin/users/:userId'].join('/');
            return $resource(_url, {
                userId: '@id'
            }, {
                get: {
                    method: 'GET',
                    headers: {
                        Auth: token
                    }
                }
            });
        };

        this.signup = function(newuser) {
            var deferred = $q.defer();

            if (FEDERATED_LOGIN) {
                deferred.reject("Function not valid for federated login");
                return deferred.promise;
            }

            newuser.username = newuser.email.replace('@', '_').replace(/\./g, '_').toLowerCase();

            var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(this.poolData);
            var attributeList = [];

            var dataEmail = {
                Name: 'email',
                Value: newuser.email.toLowerCase()
            };

            var dataName = {
                Name: 'name',
                Value: newuser.name
            };

            var dataDisplayName = {
                Name: 'custom:display_name',
                Value: newuser.name
            };

            var attributeEmail = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserAttribute(dataEmail);
            var attributeName = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserAttribute(dataName);
            var attributeDisplayName = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserAttribute(
                dataDisplayName);

            attributeList.push(attributeEmail);
            attributeList.push(attributeName);
            attributeList.push(attributeDisplayName);

            userPool.signUp(newuser.username, newuser.password, attributeList, null, function(err, result) {
                if (err) {
                    console.log(err);
                    deferred.reject(err.message);
                } else {
                    deferred.resolve(result.user);
                }
            });

            return deferred.promise;

        };

        this.newPassword = function(newuser) {
            var deferred = $q.defer();

            if (FEDERATED_LOGIN) {
                deferred.reject("Function not valid for federated login");
                return deferred.promise;
            }

            newuser.username = newuser.email.replace('@', '_').replace(/\./g, '_').toLowerCase();

            var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(this.poolData);
            var userData = {
                Username: newuser.username,
                Pool: userPool
            };
            var cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);

            return deferred.promise;
        };

        this.forgot = function(user) {
            var deferred = $q.defer();

            if (FEDERATED_LOGIN) {
                deferred.reject("Function not valid for federated login");
                return deferred.promise;
            }

            var _username = user.email.replace('@', '_').replace(/\./g, '_').toLowerCase();
            forgotPasswordResource().forgotPassword({
                userId: _username
            }, {}, function(data) {
                deferred.resolve(data.code);

            }, function(err) {
                deferred.reject("Failed to process forgot request.");
            });

            return deferred.promise;
        };

        this.resetPassword = function(user) {
            var deferred = $q.defer();

            if (FEDERATED_LOGIN) {
                deferred.reject("Function not valid for federated login");
                return deferred.promise;
            }

            var _username = user.email.replace('@', '_').replace(/\./g, '_').toLowerCase();
            var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(this.poolData);
            var userData = {
                Username: _username,
                Pool: userPool
            };
            var cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);
            cognitoUser.confirmPassword(user.verificationCode, user.password, {
                onSuccess: function(result) {
                    deferred.resolve();
                },
                onFailure: function(err) {
                    console.log(err);
                    var _msg = err.message;
                    deferred.reject(_msg);
                }
            });

            return deferred.promise;
        };

        this.changePassword = function(oldpassword, newpassword) {
            var deferred = $q.defer();

            if (FEDERATED_LOGIN) {
                deferred.reject("Function not valid for federated login");
                return deferred.promise;
            }

            var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(this.poolData);
            var cognitoUser = userPool.getCurrentUser();
            cognitoUser.getSession(function(err, session) {
                if (err) {
                    console.log(err);
                    var _msg = err.message;
                    deferred.reject(_msg);
                } else {
                    cognitoUser.changePassword(oldpassword, newpassword, function(err, result) {
                        if (err) {
                            console.log(err);
                            var _msg = err.message;
                            deferred.reject(_msg);
                        } else {
                            deferred.resolve(result);
                        }

                    });
                }
            });

            return deferred.promise;
        };

        this.signin = function(user, authAction) {
            var deferred = $q.defer();

            try {
                if (FEDERATED_LOGIN) {
                    var auth = new AmazonCognitoIdentity.CognitoAuth(this.authData);
                    auth.userhandler = {
                        onSuccess: function(result) {
                            console.log('auth success');
                        },
                        onFailure: function(err) {
                            console.log('auth failure');
                        }
                    };
                    deferred.resolve(auth.isUserSignedIn() && session.isValid());
                    return deferred.promise;
                }

                var authenticationData = {
                    Username: user.email.toLowerCase(),
                    Password: user.password,
                };
                var authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(
                    authenticationData);
                var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(this.poolData);
                var userData = {
                    Username: user.email.toLowerCase(),
                    Pool: userPool
                };
                var cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);

                cognitoUser.authenticateUser(authenticationDetails, {
                    onSuccess: function(result) {
                        $localstorage.set('username', cognitoUser.getUsername());
                        deferred.resolve({
                            state: 'login_success',
                            result: result
                        });
                    },

                    onFailure: function(err) {
                        console.log(err);
                        deferred.reject(err);
                    },
                    newPasswordRequired: function(userAttributes, requiredAttributes) {
                        if (authAction === 'password_challenge') {
                            cognitoUser.completeNewPasswordChallenge(user.newPassword, [], {
                                onSuccess: function(result) {
                                    deferred.resolve();
                                },
                                onFailure: function(err) {
                                    console.log(err);
                                    var _msg = err.message;
                                    deferred.reject(_msg);
                                }
                            });
                        } else {
                            deferred.resolve({
                                state: 'new_password_required',
                                result: {
                                    userAttributes: userAttributes,
                                    requiredAttributes: requiredAttributes
                                }
                            });
                        }
                    }
                });
            } catch (e) {
                console.log(e);
                deferred.reject(e);
            }

            return deferred.promise;
        };

        this.signOut = function() {
            try {
                if (FEDERATED_LOGIN) {
                    var auth = new AmazonCognitoIdentity.CognitoAuth(this.authData);
                    auth.userhandler = {
                        onSuccess: function(result) {
                            console.log('Sign Out - onSuccess');
                        },
                        onFailure: function(err) {
                            console.log('Sign Out - onFailure');
                        }
                    };
                    auth.signOut();
                    return true;

                } else {
                    var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(this.poolData);
                    var cognitoUser = userPool.getCurrentUser();
                    if (cognitoUser != null) {
                        cognitoUser.signOut();
                        return true;
                    } else {
                        return false;
                    }
                }

            } catch (e) {
                console.log(e);
                return false;
            }
        };

        this.isAuthenticated = function() {
            var deferred = $q.defer();
            try {
                if (FEDERATED_LOGIN) {
                    var auth = new AmazonCognitoIdentity.CognitoAuth(this.authData);
                    auth.userhandler = {
                        onSuccess: function(result) {
                            console.log('Get session - onSuccess');
                        },
                        onFailure: function(err) {
                            console.log('Get session - onFailure');
                        }
                    };
                    var session = auth.getSignInUserSession();
                    deferred.resolve(auth.isUserSignedIn() && session.isValid());

                } else {
                    var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(this.poolData);
                    var cognitoUser = userPool.getCurrentUser();
                    if (cognitoUser != null) {
                        cognitoUser.getSession(function(err, session) {
                            if (err) {
                                deferred.resolve(false);
                            } else {
                                deferred.resolve(true);
                            }
                        });
                    } else {
                        deferred.resolve(false);
                    }
                }

            } catch (e) {
                console.log(e);
                deferred.resolve(false);
            }

            return deferred.promise;
        };

        this.isAdminAuthenticated = function() {
            var deferred = $q.defer();

            this.getUserInfo().then(function(result) {
                deferred.resolve(result.role.toLowerCase() == 'admin');
            }, function(msg) {
                deferred.reject("Failed to retrieve session data");
            });

            return deferred.promise;
        };

        this.logOut = function() {
            this.signOut();
        };

        this.getUserAccessToken = function() {
            var deferred = $q.defer();

            if (FEDERATED_LOGIN) {
                var auth = new AmazonCognitoIdentity.CognitoAuth(this.authData);
                auth.userhandler = {
                    onSuccess: function(result) {
                        console.log('Get session - onSuccess');
                    },
                    onFailure: function(err) {
                        console.log('Get session - onFailure');
                    }
                };
                var session = auth.getSignInUserSession();
                if (auth.isUserSignedIn() && session.isValid()) {
                    deferred.resolve({jwtToken: session.getAccessToken().jwtToken});
                } else {
                    deferred.reject("Failed to retrieve session data");
                }

            } else {
                var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(this.poolData);
                var cognitoUser = userPool.getCurrentUser();

                if (cognitoUser != null) {
                    cognitoUser.getSession(function(err, session) {
                        if (err) {
                            console.log(err);
                            deferred.reject(err);
                        }
                        deferred.resolve(session.accessToken);
                    });
                } else {
                    deferred.reject();
                }
            }

            return deferred.promise;
        };

        this.getUserAccessTokenWithUsername = function() {
            var deferred = $q.defer();

            var username = this.getUsername();
            this.getUserAccessToken().then(function(token) {
                deferred.resolve({
                    token: token,
                    username: username
                });
            }, function(msg) {
                deferred.reject("Failed to retrieve session data");
            });

            return deferred.promise;
        };

        this.getUsername = function() {
            let user_name = '';

            if (FEDERATED_LOGIN) {
                var auth = new AmazonCognitoIdentity.CognitoAuth(this.authData);
                auth.userhandler = {
                    onSuccess: function(result) {
                        console.log('Get session - onSuccess');
                    },
                    onFailure: function(err) {
                        console.log('Get session - onFailure');
                    }
                };
                var session = auth.getSignInUserSession();
                if (auth.isUserSignedIn() && session.isValid()) {
                    user_name = auth.getUsername();
                }

            } else {
                var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(this.poolData);
                var cognitoUser = userPool.getCurrentUser();
                if (cognitoUser != null) {
                    user_name = cognitoUser.getUsername();
                }
            }

            return user_name;
        };

        this.getUserInfo = function() {
            var deferred = $q.defer();
            var userinfo = {
                username: this.getUsername(),
                email: '',
                name: '',
                display_name: '',
                accesskey: '',
                role: 'Member'
            };

            this.getUserAccessToken().then(function(token) {
                var _token = ['tk:', token.jwtToken].join('');
                userResource(_token).get({
                    userId: userinfo.username
                }, function(data) {
                    var userinfo = {
                        email: data.email.toLowerCase(),
                        name: data.display_name.split(' ')[0],
                        username: data.user_id,
                        display_name: data.display_name,
                        accesskey: data.accesskey,
                        role: data.role
                    };
                    deferred.resolve(userinfo);

                }, function(err) {
                    deferred.reject("Failed to retrieve session data");
                });

            }, function(msg) {
                deferred.reject("Failed to retrieve session data");
            });

            return deferred.promise;
        };

    });
