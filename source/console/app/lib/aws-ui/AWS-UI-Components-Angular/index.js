(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var component = require('directives/component');
var domRegion = require('directives/dom-region');
angular.module('AWS-UI-Components', [domRegion.name, component.name]);
function registerComponent(componentName) {
    var componentDef = AwsUi.__componentDefinitions[componentName];
    component.defineComponent(componentName, componentDef);
}
exports.registerComponent = registerComponent;
function registerAllComponents() {
    for (var componentName in AwsUi.__componentDefinitions) {
        registerComponent(componentName);
    }
}
exports.registerAllComponents = registerAllComponents;

},{"directives/component":2,"directives/dom-region":3}],2:[function(require,module,exports){
var utils = require('utils');
exports.name = 'components';
var module = angular.module(exports.name, []);
// Returns the property value as the expected type
function toPropValue(component, propertyName, value) {
    var propertyDefinition = component.__propertiesDefinition[propertyName];
    return convertValueToPropertyType(value, propertyDefinition.type);
}
function convertValueToPropertyType(value, targetType) {
    switch (targetType) {
        case 'string':
            return (typeof value === 'undefined' || value === null) ? value : '' + value;
        case 'boolean':
            return Boolean(value);
    }
    return value;
}
// Bind changes to attributes on the directive
// to the actual component
function handleProperties(component, properties, attributes, scope) {
    utils.objectKeys(properties).forEach(function (attr) {
        if (!(attr in attributes))
            return;
        // HACK: We don't have a proper API to reset a value
        // to its default. We use the '__setFromString' here
        function setDefault() {
            component.__setFromString(attr, null);
        }
        // For templates, we treat empty strings as default
        // values. You'll get emtpy strings if the template
        // evaluates to undefined etc. For example, in
        // <awsui-alert type=="{{undefined}}">
        // the type attribute evaluates to an empty string.
        function templateHandler(newVal) {
            if (newVal === '') {
                setDefault();
            }
            else {
                component[attr] = newVal;
            }
        }
        function handler(newVal) {
            var propValue = toPropValue(component, attr, newVal);
            if (angular.isDefined(propValue)) {
                component[attr] = propValue;
            }
            else {
                setDefault();
            }
        }
        // We treat strings differently from other property
        // types: with strings we use the interpolate
        // template syntax. For the other types we use
        // expression syntax: these will be watch expressions
        // on the current scope.
        // This seems to most closely mirror the way the different
        // types work in Angular. For example, ng-if uses the
        // expression syntax for booleans. ng-href uses the
        // template syntax.
        var type = properties[attr].type || 'string';
        if (type === 'string' || type === 'region') {
            attributes.$observe(attr, templateHandler);
        }
        else {
            scope.$watch(attributes[attr], handler, ['object', 'array'].indexOf(type) >= 0);
        }
    });
}
// Add event handlers
function handleEvents(component, events, attributes, scope, element) {
    utils.objectKeys(events).forEach(function (eventName) {
        if (eventName in attributes) {
            element.on("awsui:" + eventName, function (event) {
                scope.$apply(function () {
                    scope.$eval(attributes[eventName], { event: event });
                });
            });
        }
    });
}
function handleFunctions(component, functions, attributes, scope, $parse) {
    utils.objectKeys(functions).forEach(function (functionName) {
        var attribute = attributes[functionName + "Fn"];
        if (!attribute) {
            return;
        }
        var parsedFn = $parse(attributes[functionName + "Fn"]);
        // Set the function on the parent scope, so we get out of the component's
        // isolated scope
        if (parsedFn.assign) {
            var fn = function () { return component[functionName].apply(component, arguments); };
            parsedFn.assign(scope, fn);
        }
    });
}
// Handle regions defined declaratively
function handleRegionsAsElements(transcludeFn, scope, component) {
    // Add all regions through the dom-region directive.
    // We want to make sure the regions have been added to the
    // parent before activating the components, since we have no way
    // to make sure the components have been attached otherwise.
    // This makes the transclude function a bit messy. If we didn't
    // have the requirement for the child components to be attached
    // when calling transcludeFn(), we could simply let the domRegion
    // directives handle themselves, and check afterwards which child
    // nodes are still left.
    transcludeFn(scope, function (childNodes, childScope) {
        // Check if there are 'loose' nodes
        var looseNodes = [];
        var regionsDefined = false;
        for (var i = 0; i < childNodes.length; i++) {
            var node = childNodes[i];
            // Skip empty text nodes
            if (node.nodeType == Node.TEXT_NODE && node.textContent.match(/^[ \t\n]+/m)) {
                continue;
            }
            if (node.getAttribute && node.getAttribute('dom-region')) {
                regionsDefined = true;
                continue;
            }
            looseNodes.push(node);
        }
        // No loose nodes, nothing to deal with.
        if (looseNodes.length === 0) {
            return;
        }
        if (regionsDefined) {
            // Check if all regions are comments. Comments are special in Angular, since they
            // are sometimes used as anchors for directives that have their element replaced
            // by transcluded content, like ng-if and ng-repeat. Unfortunately
            // we have no way of detecting whether any of these comments are part of a directive
            // or not. There's various cases with comments we want to support:
            //
            // A) <awsui-alert>
            //      <!-- Comment inside the default content -->
            //      message
            //    </awsui-alert>
            //
            // B) <awsui-alert>
            //      <!-- Comment above an explicit region -->
            //      <span dom-region="content">message</span>
            //    </awsui-alert>
            //
            // C) <awsui-alert>
            //      <div ng-if="showMessage">Conditional message inside default region</div>
            //      Normal message
            //    </awsui-alert>
            //
            // This means we have a few options:
            // 1) Treat comments like any other nodes. This means that these directives will
            //    work inside a default region. They still won't work when defined dom-region
            //    nodes, and will throw an error when used together with explicit regions.
            //    For example, the following would throw an error:
            // 2) Remove all comments. This means ng-if etc. inside default regions won't
            //    work and will throw errors. The above example will work though.
            // 3) Copy comments over in default regions, but ignore them if we have explicit
            //    regions. This means the above example will work, and ng-if inside a default
            //    region will also work. However, using ng-if on a dom-region still won't work,
            //    and will throw weird errors.
            // This code uses the last approach.
            // Throw error when there's a non-comment node
            for (var _i = 0; _i < looseNodes.length; _i++) {
                var node_1 = looseNodes[_i];
                if (node_1.nodeType !== Node.COMMENT_NODE) {
                    throw new Error("Nodes outside a dom-region are not allowed when a dom-region has been explicitly defined");
                }
            }
            // Otherwise, return (ignore all comment nodes)
            return;
        }
        // Wrap all remaining elements in a container and set it as the default region
        var defaultRegion = angular.element('<span>');
        defaultRegion.append(looseNodes);
        component.setDefaultRegion(defaultRegion[0]);
    });
}
function addNgModelSupport(ngModelSupport, component, element, ngModelController, scope) {
    var propertyName = ngModelSupport.value;
    // Listen to event on the model, write back to the model on any change
    element.on('awsui:' + ngModelSupport.event, function (event) {
        if (event.target !== element[0]) {
            return;
        }
        scope.$apply(function () {
            return ngModelController.$setViewValue(component[propertyName], event);
        });
    });
    // When model changes, change property, which should trigger the
    // proper rerender.
    ngModelController.$render = function () {
        return component[ngModelSupport.value] = toPropValue(component, propertyName, ngModelController.$viewValue);
    };
    // Normal ng-model adds a listener to 'blur', which marks the directive as touched
    // (adds an ng-touched class). This doesn't work  for ours, since we don't actually
    // fire a blur event. We have to add support for it ourselves based on our event.
    element.on('awsui:blur', function () { return scope.$evalAsync(ngModelController.$setTouched); });
}
function defineComponent(componentName, def) {
    module.directive(utils.toCamelCase(componentName), ['$parse', function ($parse) {
            var ngModelSupport = def.wrapperSupport && def.wrapperSupport.ngModel;
            return {
                restrict: 'E',
                transclude: true,
                require: ngModelSupport ? '?ngModel' : undefined,
                link: function (scope, $element, iAttrs, ngModelController, transcludeFn) {
                    // Empty element
                    $element.html('');
                    AwsUi.activate($element[0]);
                    var component = $element[0].component;
                    var childScope = scope.$new();
                    childScope.component = component;
                    handleProperties(component, def.properties, iAttrs, scope);
                    handleRegionsAsElements(transcludeFn, childScope, component);
                    handleFunctions(component, def.functions, iAttrs, scope, $parse);
                    // Only add ngModel support if component supports it and ng-model
                    // is actually defined on this directive instance.
                    if (ngModelSupport && ngModelController) {
                        addNgModelSupport(ngModelSupport, component, $element, ngModelController, scope);
                    }
                    // Having a 'disabled' property on elements in IE has the effect
                    // that all children of the element will also get disabled (unable
                    // to receive events). We recommend that people use 'data-disabled'
                    // instead, but since this was already in our API we continue to support it.
                    //
                    // Since the disabled attribute has already been parsed and we have
                    // the proper watchers in place, we can simply remove the attribute now.
                    $element.removeAttr('disabled');
                    // Make sure to register event handlers after ngModel support,
                    // so that ngModel updates happen before events are being called.
                    handleEvents(component, def.events, iAttrs, scope, $element);
                    if (document.body.contains($element[0])) {
                        component.hasBeenAttached();
                    }
                    else {
                        // If we don't call hasBeenAttached() here, then where should we call it?
                        // Currently not known. Show an error, but don't fail. We'll have to come
                        // up with a better solution for this case.
                        console.error('Element was not in DOM when linked, cannot call hasBeenAttached() properly:', $element[0]);
                    }
                    // Destroy properly on detach
                    $element.on('$destroy', function () {
                        component.hasBeenDetached();
                    });
                }
            };
        }]);
}
exports.defineComponent = defineComponent;

},{"utils":4}],3:[function(require,module,exports){
exports.name = 'domRegion';
var module = angular.module(exports.name, []);
module.directive('domRegion', function () {
    return {
        restrict: 'A',
        link: {
            // Fired as pre-link function to make sure the contents are set
            // loaded as a region before any components inside get their
            // hasBeenAttached() called
            pre: function ($scope, $element, $attrs) {
                var component = $scope.component;
                component.setRegion($attrs.domRegion, $element[0]);
                $element.on('$destroy', function () {
                    component.removeRegion($attrs.domRegion);
                });
            }
        }
    };
});

},{}],4:[function(require,module,exports){
// Code borrowed from jqLite in Angular
// https://github.com/angular/angular.js/blob/master/src/jqLite.js
var SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g;
function toCamelCase(string) {
    return string.replace(SPECIAL_CHARS_REGEXP, function (_, separator, letter, offset) {
        return offset ? letter.toUpperCase() : letter;
    });
}
exports.toCamelCase = toCamelCase;
function objectKeys(object) {
    return Object.keys(object || {});
}
exports.objectKeys = objectKeys;

},{}],5:[function(require,module,exports){
var angularComponents = require('angular-components');
// Register all components by default
angularComponents.registerAllComponents();
AwsUi.__angular = angularComponents;

},{"angular-components":1}]},{},[5]);
