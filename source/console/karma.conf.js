//jshint strict: false
module.exports = function(config) {
    config.set({

        basePath: './app',

        files: [
            'lib/cognito/aws-cognito-sdk.min.js',
            'lib/cognito/amazon-cognito-identity.min.js',
            'lib/bower_components/angular/angular.js',
            'lib/bower_components/angular-resource/angular-resource.js',
            'lib/bower_components/angular-ui-router/release/angular-ui-router.js',
            'lib/bower_components/angular-mocks/angular-mocks.js',
            'lib/bower_components/underscore/underscore-min.js',
            'lib/bower_components/moment/min/moment.min.js',
            'lib/app-variables.js',
            'common/components/**/*.js',
            'common/factories/*.js',
            'common/services/*.js',
            'main/*.js',
            'dashboard/*.js',
            'signin/*.js',
            'signup/*.js',
            'confirm/*.js',
            'forgot/*.js',
            'search/*.js',
            'profile/*.js',
            'cart/*.js',
            'admin/users/*.js'
        ],

        autoWatch: true,

        frameworks: ['jasmine'],

        browsers: ['Chrome'],

        plugins: [
            'karma-chrome-launcher',
            'karma-firefox-launcher',
            'karma-jasmine',
            'karma-junit-reporter'
        ],

        reporters: ['progress'],

        junitReporter: {
            outputFile: 'test_out/unit.xml',
            suite: 'unit'
        }

    });
};
