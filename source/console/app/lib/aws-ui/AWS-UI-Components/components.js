(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! Portions adapted from tether v1.1.0 | MIT License | github.com/HubSpot/tether */
/*
 * Utility methods for manipulating DOM elements' CSS classes and styles.
 */
function addClass(element, className) {
    if (typeof element.classList !== 'undefined') {
        className.split(' ').forEach(function (cls) {
            if (cls.trim()) {
                element.classList.add(cls);
            }
        });
    }
    else {
        if (!hasClass(element, className)) {
            var cls = element.className + (' ' + className);
            setClass(element, cls);
        }
    }
}
exports.addClass = addClass;
function removeClass(element, className) {
    if (typeof element.classList !== 'undefined') {
        className.split(' ').forEach(function (cls) {
            if (cls.trim()) {
                element.classList.remove(cls);
            }
        });
    }
    else {
        var regex = new RegExp('(^| )' + className.split(' ').join('|') + '( |$)', 'gi');
        var cls = element.className.replace(regex, ' ');
        setClass(element, cls);
    }
}
exports.removeClass = removeClass;
function hasClass(element, className) {
    if (typeof element.classList !== 'undefined') {
        return element.classList.contains(className);
    }
    return new RegExp('(^| )' + className + '( |$)', 'gi').test(element.className);
}
exports.hasClass = hasClass;
function setClass(element, className) {
    element.setAttribute('class', className);
}

},{}],2:[function(require,module,exports){
var utils = require("./utils");
var BasePrototype = require('./BasePrototype');
var Metrics = require('./Metrics');
var DomUtils = require("./AwsUi.DomUtils");
var components = {};
exports.__componentDefinitions = {};
/**
 * Creates a component from a given definition and registers
 * the component.
 *
 * See ComponentCreation for the allowed definition.
 * Will also register the Custom Element with the document.
 * @abstract
 * @params {string} componentName - Expects a unique component name
 * @params {Object} definition - Component definition
 */
function __addComponent(componentName, definition) {
    if (!componentName || componentName.trim() === '' || !definition) {
        throw new Error('Expect a component name and custom element definition');
    }
    if (components[componentName]) {
        throw new Error('A component with the name ' + componentName +
            ' is already registered (AWS-init)');
    }
    // 1. Create prototype
    var componentPrototype = BasePrototype.createComponentPrototype(componentName, definition);
    // 2. Remember prototype
    components[componentName] = componentPrototype;
    // 3. Publish component definition
    exports.__componentDefinitions[componentName] = definition;
}
exports.__addComponent = __addComponent;
/**
 * Activates the UI components in the NodeList by calling the appropriate lifecycle.
 *
 * This works by firing an event that the patched polyfill
 * picks up and uses to switch out the prototype of the element
 * and calls the right callbacks afterwards.
 *
 * @abstract
 * @params {(Node|NodeList|Node[])} arrayOfNodes - Node or list of nodes
 */
function activate(arrayOfNodes) {
    if (!utils.isNodeOrCollection(arrayOfNodes)) {
        throw new Error('Expect an array of Nodes or a single Node');
    }
    if (arrayOfNodes instanceof Node)
        arrayOfNodes = [arrayOfNodes];
    for (var _i = 0; _i < arrayOfNodes.length; _i++) {
        var node = arrayOfNodes[_i];
        var prototype = components[node.nodeName.toLowerCase()];
        node.component = Object.create(prototype);
        node.component.node = node;
        node.component.hasBeenCreated();
    }
}
exports.activate = activate;
/**
* Creates a Custom Element node with the given hash of properties.
* It will lookup whether a component with the given name exists
* and instantiate it.
* After calling the created callback for the Custom Element, it will set the
* given properties.
* @abstract
* @params {string} componentName - The name of the component
* @returns {HTMLElement} Instantiated node of the component prototype
*/
function createComponent(componentName) {
    if (componentName === undefined || componentName.trim() === '') {
        throw new Error('No name given');
    }
    if (!components[componentName]) {
        throw new Error('There is no component with the name ' + componentName);
    }
    /**
     * We want to prevent components created through this call to be initialized
     * as web components. Because WebComponents hijack the createElement call, we
     * specify a global that indicates no WebComponent functionality is desired.
     *
     * Inside the WebComponent code, this global is checked on creation. Though
     * the web component is still created, it is then rendered inert, meaning
     * we have to do custom lifecycle management with this component.
     */
    this.__internalCreate = true;
    var node = document.createElement(componentName);
    this.__internalCreate = false;
    activate(node);
    return node;
}
exports.createComponent = createComponent;
exports.__Metrics = Metrics.public;
exports.__DomUtils = DomUtils;

},{"./AwsUi.DomUtils":1,"./BasePrototype":3,"./Metrics":13,"./utils":15}],3:[function(require,module,exports){
var utils = require("./utils");
var PropertyHandling = require('BasePrototype/PropertyHandling');
var EventHandling = require('BasePrototype/EventHandling');
var FunctionHandling = require('BasePrototype/FunctionHandling');
var LifecycleHandling = require('BasePrototype/LifecycleHandling');
var RegionHandling = require('BasePrototype/RegionHandling');
var RenderHandling = require('BasePrototype/RenderHandling');
var modules = [
    FunctionHandling,
    LifecycleHandling,
    EventHandling,
    RegionHandling,
    PropertyHandling,
    RenderHandling
];
/**
 * Extends the base HTMLElement prototype with the callbacks
 * required for each module. Also patches the prototype with
 * custom element support if needed.
 * @abstract
 * @return {HTMLElement}
 */
function createBasePrototype() {
    var basePrototype = {};
    for (var _i = 0; _i < modules.length; _i++) {
        var module = modules[_i];
        if (module.prototypeAdditions) {
            utils.mixin(basePrototype, module.prototypeAdditions);
        }
    }
    return basePrototype;
}
var basePrototype = createBasePrototype();
/**
 * Creates a component from a given definition.
 * Expects a JSON defintion, which covers:
 * Its additions to the base-callbacks, its properties, its regions,
 * its render method, and its functions.
 * @abstract
 * @params {Object} definition - Component definition
 * @returns {HTMLElement} CustomPrototype for given component-definition
 */
function createComponentPrototype(componentName, definition) {
    // Extend boilerplate prototype > create component prototype
    var customPrototype = Object.create(basePrototype);
    customPrototype.__componentName = componentName;
    for (var _i = 0; _i < modules.length; _i++) {
        var module = modules[_i];
        if (module.extendComponent) {
            module.extendComponent(customPrototype, definition);
        }
    }
    return customPrototype;
}
exports.createComponentPrototype = createComponentPrototype;

},{"./utils":15,"BasePrototype/EventHandling":4,"BasePrototype/FunctionHandling":5,"BasePrototype/LifecycleHandling":6,"BasePrototype/PropertyHandling":7,"BasePrototype/RegionHandling":9,"BasePrototype/RenderHandling":10}],4:[function(require,module,exports){
var utils = require("utils");
var prototypeAdditions;
(function (prototypeAdditions) {
    var changeEventName = function (propertyName) { return ("__" + propertyName.toLowerCase() + "change"); };
    /**
     * Fires an event of a type that has been registered during
     * component definition. Extra data can be added as second
     * argument, which will be available as 'detail' property
     * of the custom event fired.
     */
    function __fireEvent(eventType, data) {
        if (data === void 0) { data = {}; }
        var eventDefinition = this.__events[eventType];
        if (!eventDefinition) {
            throw new Error("No such event defined: " + eventType);
        }
        return fireEvent(this, eventType, data, eventDefinition.bubbles, eventDefinition.cancelable);
    }
    prototypeAdditions.__fireEvent = __fireEvent;
    ;
    function __firePropertyChangeEvent(propertyName) {
        var eventType = changeEventName(propertyName);
        var data = {
            newValue: this[propertyName]
        };
        fireEvent(this, eventType, data, true, false);
    }
    prototypeAdditions.__firePropertyChangeEvent = __firePropertyChangeEvent;
    /**
     * Fires the callback whenever a component inside this component
     * announces a value change of a property, which happens either
     * when the value changes or the component is being attached to
     * the DOM.
     */
    function __listenToPropertyChanges(propertyName, callback) {
        var eventType = changeEventName(propertyName);
        this.node.addEventListener('awsui:' + eventType, function (event) { return callback(event.detail.newValue, event.target); });
    }
    prototypeAdditions.__listenToPropertyChanges = __listenToPropertyChanges;
    function fireEvent(component, eventType, data, bubbles, cancelable) {
        var EVENT_PREFIX = 'awsui:';
        var event = utils.createCustomEvent(EVENT_PREFIX + eventType, data, bubbles, cancelable);
        component.node.dispatchEvent(event);
        return event;
    }
})(prototypeAdditions = exports.prototypeAdditions || (exports.prototypeAdditions = {}));
/**
 * Adds events that the component is allowed to fire.
 * Currently assumes an empty object as value.
 */
function extendComponent(customPrototype, definition) {
    customPrototype.__events = definition.events || {};
}
exports.extendComponent = extendComponent;

},{"utils":15}],5:[function(require,module,exports){
var utils = require("utils");
/**
* Adds functions to given component.
* These functions are supposed to be used for component specific logic,
* e.g. defining an inner-state or helping sorting its children.
* @abstract
*/
function extendComponent(customPrototype, definition) {
    var functions = definition.functions || {};
    utils.mixin(customPrototype, functions);
}
exports.extendComponent = extendComponent;

},{"utils":15}],6:[function(require,module,exports){
var Metrics = require('Metrics');
var broadcastAllValues = function (component) {
    var definition = component.__propertiesDefinition;
    // If true, announceValue will make the runtime trigger an event when the
    // component gets attached with the current value of the property, and also
    // broadcast an event every time the value changes.
    for (var propertyName in definition) {
        if (definition[propertyName].announceValue) {
            component.__firePropertyChangeEvent(propertyName);
        }
    }
};
/**
 * Adds support for lifecycle management on a component itself,
 * to notify our runtime when a component has been detached or
 * attached to the DOM.
 */
var prototypeAdditions;
(function (prototypeAdditions) {
    function hasBeenCreated() {
        this.__created = false;
        this.__defineRegions();
        this.__defineProperties();
        this.__created = true;
        if (this.__callbacks.initialized) {
            this.__callbacks.initialized.apply(this);
        }
        this.__update();
    }
    prototypeAdditions.hasBeenCreated = hasBeenCreated;
    ;
    function hasBeenDetached() {
        if (this.__componentState === "detached") {
            throw new Error("Detach called while component is already detached");
        }
        this.__componentState = "detached";
        if (this.__callbacks.detached) {
            this.__callbacks.detached.apply(this);
        }
    }
    prototypeAdditions.hasBeenDetached = hasBeenDetached;
    ;
    function hasBeenAttached() {
        if (this.__componentState === "attached") {
            throw new Error("Attach called while component is already attached");
        }
        if (!document.body.contains(this.node)) {
            throw new Error("Node should be part of DOM when calling attached!");
        }
        broadcastAllValues(this);
        this.__componentState = "attached";
        this.node.setAttribute('initialized', true);
        if (this.__callbacks.attached) {
            this.__callbacks.attached.apply(this);
        }
        Metrics.__logComponentUsed(this.node.tagName);
    }
    prototypeAdditions.hasBeenAttached = hasBeenAttached;
    ;
})(prototypeAdditions = exports.prototypeAdditions || (exports.prototypeAdditions = {}));
function extendComponent(customPrototype, definition) {
    var allowedCallbacks = ['initialized',
        'attached',
        'detached'];
    var callbacks = definition.callbacks || {};
    for (var callbackName in callbacks) {
        if (allowedCallbacks.indexOf(callbackName) === -1) {
            throw new Error('Undefined callback ' + callbackName + ' for component');
        }
    }
    customPrototype.__callbacks = callbacks;
}
exports.extendComponent = extendComponent;

},{"Metrics":13}],7:[function(require,module,exports){
var types = require('./PropertyTypes');
var prototypeAdditions;
(function (prototypeAdditions) {
    /**
     * Defines the internal properties hash.
     * Called on creation of the component.
     * @abstract
     * @return undefined
     */
    function __defineProperties() {
        this.__properties = {};
        for (var propertyName in this.__propertiesDefinition) {
            var property = this.__propertiesDefinition[propertyName];
            var type = types[property.type];
            var defaultValue = type.getDefaultValue(property);
            if (property.__writable) {
                this[propertyName] = defaultValue;
            }
        }
    }
    prototypeAdditions.__defineProperties = __defineProperties;
    ;
    function __setFromString(propertyName, newValue) {
        var definition = this.__propertiesDefinition[propertyName];
        var type = types[definition.type];
        // Only continue if we have an attribute -> property mapper
        // for this type.
        if (!type.fromAttribute) {
            return;
        }
        var propertyValue;
        // newValue is null when attribute has been removed
        if (newValue === null) {
            propertyValue = type.getDefaultValue(definition);
        }
        else {
            propertyValue = type.fromAttribute(newValue, propertyName);
        }
        // Syncing with properties if necessary.
        if (this[propertyName] !== propertyValue) {
            this[propertyName] = propertyValue;
        }
    }
    prototypeAdditions.__setFromString = __setFromString;
})(prototypeAdditions = exports.prototypeAdditions || (exports.prototypeAdditions = {}));
/**
* Adds properties to the given component.
* Defines setter and getter methods for the provided list of properties.
* The base setter is also calling the attribute setters, if defined.
* @abstract
*/
function extendComponent(customPrototype, definition) {
    var properties = definition.properties || {};
    customPrototype.__propertiesDefinition = properties;
    // add property definition for each declared region
    var regionNames = definition.regions ? Object.keys(definition.regions) : [];
    regionNames.forEach(function (regionName) {
        properties[regionName] = {
            type: 'region',
            onChange: function (oldValue, newValue) {
                this.__setRegion(regionName, newValue);
            }
        };
    });
    var getAccessor = function (propertyName, getter) {
        var definition = customPrototype.__propertiesDefinition[propertyName];
        return function () {
            var _this = this;
            if (!definition.__readable) {
                throw new Error('Tried to access write-only property "' + propertyName + '"');
            }
            return getter.call(this, function () { return _this.__properties[propertyName]; });
        };
    };
    var getMutator = function (propertyName, setter) {
        var definition = customPrototype.__propertiesDefinition[propertyName];
        return function (newValue) {
            var _this = this;
            if (!definition.__writable) {
                throw new Error('Tried to modify read-only property "' + propertyName + '"');
            }
            var type = types[definition.type];
            type.validate(newValue, propertyName, definition);
            var oldValue;
            if (definition.__readable) {
                oldValue = this[propertyName];
                if (!type.complexType && oldValue === newValue) {
                    return;
                }
            }
            setter.call(this, newValue, function (value) { _this.__properties[propertyName] = value; });
            if (this.__created) {
                if (typeof definition.onChange === 'function') {
                    definition.onChange.call(this, oldValue, newValue);
                }
                this.__update();
                if (definition.announceValue === true) {
                    this.__firePropertyChangeEvent(propertyName);
                }
            }
        };
    };
    var baseGet = function (propertyName) {
        return function () {
            return this.__properties[propertyName];
        };
    };
    var baseSet = function (propertyName) {
        return function (value) {
            this.__properties[propertyName] = value;
        };
    };
    for (var propertyName in customPrototype.__propertiesDefinition) {
        var propertyDefinition = customPrototype.__propertiesDefinition[propertyName];
        var accessors = {};
        propertyDefinition.type = propertyDefinition.type || 'string';
        var type = types[propertyDefinition.type];
        if (!type) {
            throw new Error('No such type "' + propertyDefinition.type + '" for property ' + propertyName);
        }
        var setter = propertyDefinition.setter;
        var getter = propertyDefinition.getter;
        if (!setter && !getter) {
            setter = baseSet(propertyName);
            getter = baseGet(propertyName);
        }
        propertyDefinition.__writable = Boolean(setter);
        propertyDefinition.__readable = Boolean(getter);
        accessors.get = getAccessor(propertyName, getter);
        accessors.set = getMutator(propertyName, setter);
        Object.defineProperty(customPrototype, propertyName, accessors);
    }
}
exports.extendComponent = extendComponent;

},{"./PropertyTypes":8}],8:[function(require,module,exports){
var StringPropertyType;
(function (StringPropertyType) {
    function fromAttribute(val) {
        return val;
    }
    StringPropertyType.fromAttribute = fromAttribute;
    function validate(val, propName, definition) {
        if (val === undefined || val === null) {
            if (definition.nullable !== false) {
                return;
            }
            else {
                throw new Error("Property " + propName + " cannot be null or undefined");
            }
        }
        if ((typeof val) !== 'string') {
            throw new Error('Property "' + propName + '" must be a string, got "' + val + '" (' + typeof (val) + ') instead');
        }
        if (definition.valid && definition.valid.indexOf(val) === -1) {
            throw new TypeError(propName + ' can only have the following values: ' +
                definition.valid.join(', ') +
                ' (was "' + val + '")');
        }
    }
    StringPropertyType.validate = validate;
    function getDefaultValue(definition) {
        return definition.defaultValue;
    }
    StringPropertyType.getDefaultValue = getDefaultValue;
})(StringPropertyType || (StringPropertyType = {}));
var BooleanPropertyType;
(function (BooleanPropertyType) {
    function fromAttribute(val, attrName) {
        if (val === 'true') {
            return true;
        }
        else if (val === 'false') {
            return false;
        }
        else {
            throw new Error('Attribute "' + attrName + '" must be "true" or "false", got "' + val + '" (' + typeof (val) + ') instead');
        }
    }
    BooleanPropertyType.fromAttribute = fromAttribute;
    function validate(val, propName) {
        if (typeof (val) !== 'boolean') {
            throw new Error('Property "' + propName + '" must be true or false, got "' + val + '" (' + typeof (val) + ') instead');
        }
    }
    BooleanPropertyType.validate = validate;
    function getDefaultValue(definition) {
        return Boolean(definition.defaultValue);
    }
    BooleanPropertyType.getDefaultValue = getDefaultValue;
})(BooleanPropertyType || (BooleanPropertyType = {}));
var NumberPropertyType;
(function (NumberPropertyType) {
    function stringIsNumber(val) {
        // If NaN, then not a number
        if (isNaN(val))
            return false;
        // Make sure it looks like a normal number (no 1e10, Infinity etc)
        var match = val.match(/^[0-9\.-]+$/);
        return !!match;
    }
    function fromAttribute(val, attrName) {
        if (val === null)
            return null;
        if (!stringIsNumber(val)) {
            throw new Error('Attribute "' + attrName + '" does not specify a valid number, was "' + val + '"');
        }
        return parseFloat(val);
    }
    NumberPropertyType.fromAttribute = fromAttribute;
    function validate(val, propName) {
        if (val === null || val === undefined)
            return null;
        if ((typeof val) !== 'number') {
            throw new Error('Property "' + propName + '" must be a number, was "' + val + '" (' + typeof (val) + ')');
        }
        if (!isFinite(val)) {
            throw new Error('Property "' + propName + '" only allows for finite numbers, got "' + val + '" instead');
        }
    }
    NumberPropertyType.validate = validate;
    function getDefaultValue(definition) {
        return definition.defaultValue;
    }
    NumberPropertyType.getDefaultValue = getDefaultValue;
})(NumberPropertyType || (NumberPropertyType = {}));
var RegionPropertyType;
(function (RegionPropertyType) {
    function fromAttribute(val) {
        return val;
    }
    RegionPropertyType.fromAttribute = fromAttribute;
    function validate(val) {
        // FIXME - check for DOM element or string
    }
    RegionPropertyType.validate = validate;
    function getDefaultValue(definition) {
        return definition.defaultValue;
    }
    RegionPropertyType.getDefaultValue = getDefaultValue;
})(RegionPropertyType || (RegionPropertyType = {}));
var ObjectPropertyType;
(function (ObjectPropertyType) {
    ObjectPropertyType.complexType = true;
    function fromAttribute(val, attrName) {
        // Not supported for now. We could do some kind of JSON translation,
        // but do we really want that?
        throw new Error("Attribute \"" + attrName + "\" can't be set as string.");
    }
    ObjectPropertyType.fromAttribute = fromAttribute;
    function validate(val) {
        // FIXME Here we should validate the type passed on in the definition
        // exists and that the object passed on matches the description
    }
    ObjectPropertyType.validate = validate;
    function getDefaultValue(definition) {
        // Not supported for now -- we would have to clone
        // objects here if we want to support default values.
        return;
    }
    ObjectPropertyType.getDefaultValue = getDefaultValue;
})(ObjectPropertyType || (ObjectPropertyType = {}));
var ArrayPropertyType;
(function (ArrayPropertyType) {
    ArrayPropertyType.complexType = true;
    function fromAttribute(val, attrName) {
        // Not supported for now. We could do some kind of JSON translation,
        // but do we really want that?
        throw new Error("Attribute \"" + attrName + "\" can't be set as string.");
    }
    ArrayPropertyType.fromAttribute = fromAttribute;
    function validate(val, propName) {
        if (!(val instanceof Array)) {
            throw new Error(("Property \"" + propName + "\" must be an array") +
                (", was " + val + " (" + typeof (val) + ")"));
        }
    }
    ArrayPropertyType.validate = validate;
    function getDefaultValue(definition) {
        // in case we need to indicate that there is no value at all, we should
        // add a support for a definition.defaultValue here in the future
        return [];
    }
    ArrayPropertyType.getDefaultValue = getDefaultValue;
})(ArrayPropertyType || (ArrayPropertyType = {}));
exports.string = StringPropertyType;
exports.boolean = BooleanPropertyType;
exports.region = RegionPropertyType;
exports.object = ObjectPropertyType;
exports.array = ArrayPropertyType;
// Integers and floats use the same number type, since
// typescript only has one number type.
exports.integer = NumberPropertyType;
exports.float = NumberPropertyType;

},{}],9:[function(require,module,exports){
var prototypeAdditions;
(function (prototypeAdditions) {
    function __defineRegions() {
        this.__regions = {};
        for (var regionName in this.__regionDefinition) {
            var regionDefinition = this.__regionDefinition[regionName];
            if (regionDefinition.isDefault) {
                this.__defaultRegionName = regionName;
            }
            this.__regions[regionName] = {
                isDefault: regionDefinition.isDefault
            };
        }
        return this.__regions;
    }
    prototypeAdditions.__defineRegions = __defineRegions;
    ;
    /**
     * The setRegion method allows to specify region content by providing
     * a name and a node to be appended.
     * Every call will immediately update the rendered component.
     * @abstract
     */
    function __setRegion(regionName, node) {
        checkRegionName(this, regionName);
        if (typeof node === 'string') {
            node = document.createTextNode(node);
        }
        if (!node) {
            this.__removeRegion(regionName);
        }
        else {
            this.__regions[regionName].innerContent = node;
            this.__update();
        }
        return this.__regions[regionName].innerContent;
    }
    prototypeAdditions.__setRegion = __setRegion;
    ;
    function setRegion(regionName, node) {
        if (Object.keys(this.__regions).length === 0) {
            throw new Error(("Trying to set a region \"" + regionName + "\" on the component ") +
                ("\"" + this.__componentName + "\" but it does not have regions"));
        }
        checkRegionName(this, regionName);
        this[regionName] = node; // onChange takes it from here
    }
    prototypeAdditions.setRegion = setRegion;
    /**
     * Sets the default region for a component.
     * This will only work if a component has a default region. Can
     * be used if a component is created in declarative style by
     * a wrapper without specifying an explicit region.
     */
    function setDefaultRegion(nodeOrString) {
        if (!this.__defaultRegionName) {
            throw new Error('Trying to set a default region on the component ' +
                ("\"" + this.__componentName + "\" but it does not have a default region"));
        }
        this.setRegion(this.__defaultRegionName, nodeOrString);
    }
    prototypeAdditions.setDefaultRegion = setDefaultRegion;
    ;
    /**
     * The removeRegion method allows to remove the contents of the
     * region by providing a regionName. The region will be hidden after the
     * content has been removed.
     * @abstract
     */
    function __removeRegion(regionName) {
        if (!this.__regions[regionName]) {
            return;
        }
        this.__regions[regionName].innerContent = undefined;
        this.__update();
    }
    prototypeAdditions.__removeRegion = __removeRegion;
    ;
    function removeRegion(regionName) {
        var component = this;
        component[regionName] = undefined; // onChange takes it from here
    }
    prototypeAdditions.removeRegion = removeRegion;
    function checkRegionName(component, regionName) {
        if (!component.__regions[regionName]) {
            throw new TypeError('The component has no region called: ' + regionName);
        }
    }
    /**
     * The getRegion method is a getter for the content of the region.  It verifies that the
     * property name is really a region, but otherwise returns the same as the property
     * accessor (string or DOM node);
     */
    function getRegion(regionName, node) {
        checkRegionName(this, regionName);
        return this[regionName];
    }
    prototypeAdditions.getRegion = getRegion;
    ;
})(prototypeAdditions = exports.prototypeAdditions || (exports.prototypeAdditions = {}));
function extendComponent(customPrototype, definition) {
    var regions = definition.regions || {};
    customPrototype.__regionDefinition = regions;
}
exports.extendComponent = extendComponent;

},{}],10:[function(require,module,exports){
var m = require("mithril");
var MithrilHelpers = require("MithrilHelpers");
var prototypeAdditions;
(function (prototypeAdditions) {
    function __update() {
        var helpers = new MithrilHelpers(this);
        m.render(this.node, this.__render(m, helpers));
    }
    prototypeAdditions.__update = __update;
    ;
})(prototypeAdditions = exports.prototypeAdditions || (exports.prototypeAdditions = {}));
/**
 * Sets the render method for the component. Should
 * be a method that returns a mithril vdom. Arguments
 * are a mithril instance and a MithrilHelpers instance
 * @abstract
 */
function extendComponent(customPrototype, definition) {
    customPrototype.__render = definition.render;
}
exports.extendComponent = extendComponent;

},{"MithrilHelpers":14,"mithril":16}],11:[function(require,module,exports){
/*
 * Module for browser capabilities detection.
 */
exports.isIE;
exports.inputEvent;
// This function is public for testing purposes. It allows us to overwrite the
// user agent and run the detection logic again. In production, however, this
// code will be called only once and cached.
function detect() {
    // IE11 does not send the MSIE keyword any more, and not all versions of IE
    // report the rendering engine ("Trident").
    exports.isIE = Boolean(navigator.userAgent.match(/MSIE|Trident/));
    exports.inputEvent = !exports.isIE;
}
exports.detect = detect;
;
detect();

},{}],12:[function(require,module,exports){
/*
 * Utility for assembling className strings in components.
 */
var ClassBuilder = (function () {
    function ClassBuilder(component) {
        this.classNameSet = {};
        this.component = component;
    }
    ClassBuilder.prototype.addClass = function (className, condition) {
        var conditionMet;
        /*
         * I want 'undefined' to work as a falsy condition, but I'd like to avoid defining separate
         * methods for adding classes conditionally.
         */
        if (arguments.length < 2) {
            conditionMet = true;
        }
        else {
            conditionMet = !!condition;
        }
        if (className && conditionMet) {
            this.classNameSet[className] = true;
        }
        return this;
    };
    ClassBuilder.prototype.addPropertyValueClass = function (propertyName, condition) {
        var component = this.component;
        var propertyValue = component[propertyName];
        if (propertyValue) {
            var className = component.__componentName + "-" + propertyName + "-" + propertyValue;
            if (arguments.length < 2) {
                this.addClass(className);
            }
            else {
                this.addClass(className, condition);
            }
        }
        return this;
    };
    ClassBuilder.prototype.toClassName = function () {
        var classNames = [];
        for (var className in this.classNameSet) {
            classNames.push(className);
        }
        classNames.sort(); // ensure consistent ordering across browsers, mainly for unit tests
        return classNames.join(' ');
    };
    return ClassBuilder;
})();
exports.ClassBuilder = ClassBuilder;

},{}],13:[function(require,module,exports){
/**
 * Calls Console Platform's client logging JS API with provided metric name, value, and detail.
 * Does nothing if Console Platform client logging JS is not present in page.
 *
 * If AwsUi.debug is enabled, throws an exception if metricName does not match the pattern required
 * by Client Log Service to log metric to PMET.
 */
function sendMetric(metricName, value, detail) {
    if (typeof window.AWSC === 'object' &&
        typeof window.AWSC.Clog === 'object' &&
        typeof window.AWSC.Clog.log === 'function') {
        if (window.AwsUi.debug && !(/^[a-zA-Z0-9_-]{1,32}$/).test(metricName)) {
            throw new Error("Invalid metric name: " + metricName);
        }
        window.AWSC.Clog.log(metricName, value, detail);
    }
}
exports.sendMetric = sendMetric;
var onetimeMetricNames = {};
/*
 * Calls Console Platform's client logging only the first time the provided metricName is used.
 * Subsequent calls with the same metricName are ignored.
 */
function sendMetricOnce(metricName, value, detail) {
    if (!onetimeMetricNames[metricName]) {
        sendMetric(metricName, value, detail);
        onetimeMetricNames[metricName] = true;
    }
}
exports.sendMetricOnce = sendMetricOnce;
/*
 * Reports a metric value 1 to Console Platform's client logging service to indicate that the
 * component was used in the page.  A component will only be reported as used to client logging
 * service once per page view.
 */
function __logComponentUsed(componentTypeName) {
    // uses public.sendMetricOnce instead of just sendMetricOnce to support unit testing
    exports.public.sendMetricOnce(componentTypeName.toLowerCase() + "-used", 1);
}
exports.__logComponentUsed = __logComponentUsed;
/*
 * Returns object containing "public" API meant for use outside of Runtime.
 */
exports.public = {
    sendMetric: sendMetric,
    sendMetricOnce: sendMetricOnce
};

},{}],14:[function(require,module,exports){
var m = require("mithril");
var ClassBuilderModule = require('./ClassBuilder');
var Capabilities = require('./BrowserCapabilities');
var MithrilHelpers = (function () {
    function MithrilHelpers(component) {
        this.browserCapabilities = Capabilities;
        this.ClassBuilder = ClassBuilderModule.ClassBuilder;
        this.component = component;
    }
    MithrilHelpers.prototype.region = function (name, tagName, attributes) {
        if (tagName === void 0) { tagName = "div"; }
        if (attributes === void 0) { attributes = {}; }
        var region = this.component.getRegion(name);
        // If there are no contents for the region, do not generate any DOM.
        if (!region)
            return;
        attributes["region-container"] = name;
        // For string-based regions, we can be done at this point.
        if (typeof region === 'string') {
            return m(tagName, attributes, region);
        }
        // For node-based regions, we have to append the DOM node at the end.
        // Add config callback that will attach the right region node
        // when instantiated
        attributes.config = function (el, isInitialized, context) {
            // Check if the right region is already there
            if (el.childNodes[0] === region)
                return;
            // Not the right region, reset and add region
            el.innerHTML = '';
            el.appendChild(region);
        };
        return m(tagName, attributes);
    };
    /*
     * Returns an object containing the named properties from the supplied object.
     * Omits properties with a value of undefined.  If no named properties are
     * supplied, Object.keys(object) is used.
     */
    MithrilHelpers.prototype.copyDefined = function (object, propertyNames) {
        if (propertyNames === undefined) {
            propertyNames = Object.keys(object);
        }
        function copyDefinedPropertyValue(objectCopy, propertyName) {
            var propertyValue = object[propertyName];
            if (typeof propertyValue !== 'undefined') {
                objectCopy[propertyName] = propertyValue;
            }
            return objectCopy;
        }
        return propertyNames.reduce(copyDefinedPropertyValue, {});
    };
    MithrilHelpers.prototype.newEventHandler = function (eventName, cb) {
        var _this = this;
        return function (ev) {
            if (!cb || cb.call(_this.component, ev) !== false) {
                var customEvent = _this.component.__fireEvent(eventName);
                if (customEvent.defaultPrevented) {
                    ev.preventDefault();
                }
            }
        };
    };
    MithrilHelpers.prototype.newDeferredEventHandler = function (eventName, cb) {
        var eventHandler = this.newEventHandler(eventName, cb);
        return function (ev) {
            setTimeout(function () { return eventHandler(ev); }, 0);
        };
    };
    return MithrilHelpers;
})();
module.exports = MithrilHelpers;

},{"./BrowserCapabilities":11,"./ClassBuilder":12,"mithril":16}],15:[function(require,module,exports){
function mixin(base, extension) {
    for (var property in extension) {
        base[property] = extension[property];
    }
}
exports.mixin = mixin;
function createCustomEvent(eventType, data, bubbles, cancelable) {
    if (bubbles === void 0) { bubbles = true; }
    if (cancelable === void 0) { cancelable = true; }
    // IE doesn't have a CustomEvent constructor but
    // MDN says the initCustomEvent alternative should not
    // be used, so we use one or the other depending on what's
    // available. PhantomJS behaves the same way.
    if ((typeof CustomEvent) === 'function') {
        // CustomEvent typing in TS 1.4 is broken, so
        // cast to any
        return new CustomEvent(eventType, {
            detail: data,
            bubbles: bubbles,
            cancelable: cancelable
        });
    }
    else {
        var event_1 = document.createEvent('CustomEvent');
        event_1.initCustomEvent(eventType, bubbles, cancelable, data);
        // IE also doesn't set `defaultPrevented` for custom events
        // when you call `preventDefault`. So, we need to define setter by ourselves.
        // http://stackoverflow.com/questions/23349191/event-preventdefault-is-not-working-in-ie-11-for-custom-events
        var nativePreventDefault = event_1.preventDefault;
        event_1.preventDefault = function () {
            if (!event_1.cancelable) {
                return;
            }
            nativePreventDefault.call(event_1);
            // we need try ... catch here because PhantomJS goes in this branch as well
            // and does not allow to override native properties and we need it for IE
            try {
                Object.defineProperty(event_1, 'defaultPrevented', {
                    get: function () { return true; }
                });
            }
            catch (e) {
            }
        };
        return event_1;
    }
}
exports.createCustomEvent = createCustomEvent;
function isNodeOrCollection(someObject) {
    return (someObject instanceof Node ||
        someObject instanceof NodeList ||
        someObject instanceof Array ||
        someObject instanceof HTMLCollection);
}
exports.isNodeOrCollection = isNodeOrCollection;

},{}],16:[function(require,module,exports){
/*! mithril.js v0.1.34 | MIT License | github.com/lhorie/mithril.js */
var m = (function app(window, undefined) {
	var OBJECT = "[object Object]", ARRAY = "[object Array]", STRING = "[object String]", FUNCTION = "function";
	var type = {}.toString;
	var parser = /(?:(^|#|\.)([^#\.\[\]]+))|(\[.+?\])/g, attrParser = /\[(.+?)(?:=("|'|)(.*?)\2)?\]/;
	var voidElements = /^(AREA|BASE|BR|COL|COMMAND|EMBED|HR|IMG|INPUT|KEYGEN|LINK|META|PARAM|SOURCE|TRACK|WBR)$/;

	// caching commonly used variables
	var $document, $location, $requestAnimationFrame, $cancelAnimationFrame;

	// self invoking function needed because of the way mocks work
	function initialize(window){
		$document = window.document;
		$location = window.location;
		$cancelAnimationFrame = window.cancelAnimationFrame || window.clearTimeout;
		$requestAnimationFrame = window.requestAnimationFrame || window.setTimeout;
	}

	initialize(window);


	/**
	 * @typedef {String} Tag
	 * A string that looks like -> div.classname#id[param=one][param2=two]
	 * Which describes a DOM node
	 */

	/**
	 *
	 * @param {Tag} The DOM node tag
	 * @param {Object=[]} optional key-value pairs to be mapped to DOM attrs
	 * @param {...mNode=[]} Zero or more Mithril child nodes. Can be an array, or splat (optional)
	 *
	 */
	function m() {
		var args = [].slice.call(arguments);
		var hasAttrs = args[1] != null && type.call(args[1]) === OBJECT && !("tag" in args[1]) && !("subtree" in args[1]);
		var attrs = hasAttrs ? args[1] : {};
		var classAttrName = "class" in attrs ? "class" : "className";
		var cell = {tag: "div", attrs: {}};
		var match, classes = [];
		if (type.call(args[0]) != STRING) throw new Error("selector in m(selector, attrs, children) should be a string")
		while (match = parser.exec(args[0])) {
			if (match[1] === "" && match[2]) cell.tag = match[2];
			else if (match[1] === "#") cell.attrs.id = match[2];
			else if (match[1] === ".") classes.push(match[2]);
			else if (match[3][0] === "[") {
				var pair = attrParser.exec(match[3]);
				cell.attrs[pair[1]] = pair[3] || (pair[2] ? "" :true)
			}
		}
		if (classes.length > 0) cell.attrs[classAttrName] = classes.join(" ");


		var children = hasAttrs ? args.slice(2) : args.slice(1);
		if (children.length === 1 && type.call(children[0]) === ARRAY) {
			cell.children = children[0]
		}
		else {
			cell.children = children
		}

		for (var attrName in attrs) {
			if (attrName === classAttrName) {
				var className = cell.attrs[attrName]
				cell.attrs[attrName] = (className && attrs[attrName] ? className + " " : className || "") + attrs[attrName];
			}
			else cell.attrs[attrName] = attrs[attrName]
		}
		return cell
	}
	function build(parentElement, parentTag, parentCache, parentIndex, data, cached, shouldReattach, index, editable, namespace, configs) {
		//`build` is a recursive function that manages creation/diffing/removal of DOM elements based on comparison between `data` and `cached`
		//the diff algorithm can be summarized as this:
		//1 - compare `data` and `cached`
		//2 - if they are different, copy `data` to `cached` and update the DOM based on what the difference is
		//3 - recursively apply this algorithm for every array and for the children of every virtual element

		//the `cached` data structure is essentially the same as the previous redraw's `data` data structure, with a few additions:
		//- `cached` always has a property called `nodes`, which is a list of DOM elements that correspond to the data represented by the respective virtual element
		//- in order to support attaching `nodes` as a property of `cached`, `cached` is *always* a non-primitive object, i.e. if the data was a string, then cached is a String instance. If data was `null` or `undefined`, cached is `new String("")`
		//- `cached also has a `configContext` property, which is the state storage object exposed by config(element, isInitialized, context)
		//- when `cached` is an Object, it represents a virtual element; when it's an Array, it represents a list of elements; when it's a String, Number or Boolean, it represents a text node

		//`parentElement` is a DOM element used for W3C DOM API calls
		//`parentTag` is only used for handling a corner case for textarea values
		//`parentCache` is used to remove nodes in some multi-node cases
		//`parentIndex` and `index` are used to figure out the offset of nodes. They're artifacts from before arrays started being flattened and are likely refactorable
		//`data` and `cached` are, respectively, the new and old nodes being diffed
		//`shouldReattach` is a flag indicating whether a parent node was recreated (if so, and if this node is reused, then this node must reattach itself to the new parent)
		//`editable` is a flag that indicates whether an ancestor is contenteditable
		//`namespace` indicates the closest HTML namespace as it cascades down from an ancestor
		//`configs` is a list of config functions to run after the topmost `build` call finishes running

		//there's logic that relies on the assumption that null and undefined data are equivalent to empty strings
		//- this prevents lifecycle surprises from procedural helpers that mix implicit and explicit return statements (e.g. function foo() {if (cond) return m("div")}
		//- it simplifies diffing code
		//data.toString() is null if data is the return value of Console.log in Firefox
		try {if (data == null || data.toString() == null) data = "";} catch (e) {data = ""}
		if (data.subtree === "retain") return cached;
		var cachedType = type.call(cached), dataType = type.call(data);
		if (cached == null || cachedType !== dataType) {
			if (cached != null) {
				if (parentCache && parentCache.nodes) {
					var offset = index - parentIndex;
					var end = offset + (dataType === ARRAY ? data : cached.nodes).length;
					clear(parentCache.nodes.slice(offset, end), parentCache.slice(offset, end))
				}
				else if (cached.nodes) clear(cached.nodes, cached)
			}
			cached = new data.constructor;
			if (cached.tag) cached = {}; //if constructor creates a virtual dom element, use a blank object as the base cached node instead of copying the virtual el (#277)
			cached.nodes = []
		}

		if (dataType === ARRAY) {
			//recursively flatten array
			for (var i = 0, len = data.length; i < len; i++) {
				if (type.call(data[i]) === ARRAY) {
					data = data.concat.apply([], data);
					i-- //check current index again and flatten until there are no more nested arrays at that index
					len = data.length
				}
			}

			var nodes = [], intact = cached.length === data.length, subArrayCount = 0;

			//keys algorithm: sort elements without recreating them if keys are present
			//1) create a map of all existing keys, and mark all for deletion
			//2) add new keys to map and mark them for addition
			//3) if key exists in new list, change action from deletion to a move
			//4) for each key, handle its corresponding action as marked in previous steps
			var DELETION = 1, INSERTION = 2 , MOVE = 3;
			var existing = {}, unkeyed = [], shouldMaintainIdentities = false;
			for (var i = 0; i < cached.length; i++) {
				if (cached[i] && cached[i].attrs && cached[i].attrs.key != null) {
					shouldMaintainIdentities = true;
					existing[cached[i].attrs.key] = {action: DELETION, index: i}
				}
			}

			var guid = 0
			for (var i = 0, len = data.length; i < len; i++) {
				if (data[i] && data[i].attrs && data[i].attrs.key != null) {
					for (var j = 0, len = data.length; j < len; j++) {
						if (data[j] && data[j].attrs && data[j].attrs.key == null) data[j].attrs.key = "__mithril__" + guid++
					}
					break
				}
			}

			if (shouldMaintainIdentities) {
				var keysDiffer = false
				if (data.length != cached.length) keysDiffer = true
				else for (var i = 0, cachedCell, dataCell; cachedCell = cached[i], dataCell = data[i]; i++) {
					if (cachedCell.attrs && dataCell.attrs && cachedCell.attrs.key != dataCell.attrs.key) {
						keysDiffer = true
						break
					}
				}

				if (keysDiffer) {
					for (var i = 0, len = data.length; i < len; i++) {
						if (data[i] && data[i].attrs) {
							if (data[i].attrs.key != null) {
								var key = data[i].attrs.key;
								if (!existing[key]) existing[key] = {action: INSERTION, index: i};
								else existing[key] = {
									action: MOVE,
									index: i,
									from: existing[key].index,
									element: cached.nodes[existing[key].index] || $document.createElement("div")
								}
							}
						}
					}
					var actions = []
					for (var prop in existing) actions.push(existing[prop])
					var changes = actions.sort(sortChanges);
					var newCached = new Array(cached.length)
					newCached.nodes = cached.nodes.slice()

					for (var i = 0, change; change = changes[i]; i++) {
						if (change.action === DELETION) {
							clear(cached[change.index].nodes, cached[change.index]);
							newCached.splice(change.index, 1)
						}
						if (change.action === INSERTION) {
							var dummy = $document.createElement("div");
							dummy.key = data[change.index].attrs.key;
							parentElement.insertBefore(dummy, parentElement.childNodes[change.index] || null);
							newCached.splice(change.index, 0, {attrs: {key: data[change.index].attrs.key}, nodes: [dummy]})
							newCached.nodes[change.index] = dummy
						}

						if (change.action === MOVE) {
							if (parentElement.childNodes[change.index] !== change.element && change.element !== null) {
								parentElement.insertBefore(change.element, parentElement.childNodes[change.index] || null)
							}
							newCached[change.index] = cached[change.from]
							newCached.nodes[change.index] = change.element
						}
					}
					cached = newCached;
				}
			}
			//end key algorithm

			for (var i = 0, cacheCount = 0, len = data.length; i < len; i++) {
				//diff each item in the array
				var item = build(parentElement, parentTag, cached, index, data[i], cached[cacheCount], shouldReattach, index + subArrayCount || subArrayCount, editable, namespace, configs);
				if (item === undefined) continue;
				if (!item.nodes.intact) intact = false;
				if (item.$trusted) {
					//fix offset of next element if item was a trusted string w/ more than one html element
					//the first clause in the regexp matches elements
					//the second clause (after the pipe) matches text nodes
					subArrayCount += (item.match(/<[^\/]|\>\s*[^<]/g) || [0]).length
				}
				else subArrayCount += type.call(item) === ARRAY ? item.length : 1;
				cached[cacheCount++] = item
			}
			if (!intact) {
				//diff the array itself

				//update the list of DOM nodes by collecting the nodes from each item
				for (var i = 0, len = data.length; i < len; i++) {
					if (cached[i] != null) nodes.push.apply(nodes, cached[i].nodes)
				}
				//remove items from the end of the array if the new array is shorter than the old one
				//if errors ever happen here, the issue is most likely a bug in the construction of the `cached` data structure somewhere earlier in the program
				for (var i = 0, node; node = cached.nodes[i]; i++) {
					if (node.parentNode != null && nodes.indexOf(node) < 0) clear([node], [cached[i]])
				}
				if (data.length < cached.length) cached.length = data.length;
				cached.nodes = nodes
			}
		}
		else if (data != null && dataType === OBJECT) {
			if (!data.attrs) data.attrs = {};
			if (!cached.attrs) cached.attrs = {};

			var dataAttrKeys = Object.keys(data.attrs)
			var hasKeys = dataAttrKeys.length > ("key" in data.attrs ? 1 : 0)
			//if an element is different enough from the one in cache, recreate it
			if (data.tag != cached.tag || dataAttrKeys.join() != Object.keys(cached.attrs).join() || data.attrs.id != cached.attrs.id || (m.redraw.strategy() == "all" && cached.configContext && cached.configContext.retain !== true) || (m.redraw.strategy() == "diff" && cached.configContext && cached.configContext.retain === false)) {
				if (cached.nodes.length) clear(cached.nodes);
				if (cached.configContext && typeof cached.configContext.onunload === FUNCTION) cached.configContext.onunload()
			}
			if (type.call(data.tag) != STRING) return;

			var node, isNew = cached.nodes.length === 0;
			if (data.attrs.xmlns) namespace = data.attrs.xmlns;
			else if (data.tag === "svg") namespace = "http://www.w3.org/2000/svg";
			else if (data.tag === "math") namespace = "http://www.w3.org/1998/Math/MathML";
			if (isNew) {
				if (data.attrs.is) node = namespace === undefined ? $document.createElement(data.tag, data.attrs.is) : $document.createElementNS(namespace, data.tag, data.attrs.is);
				else node = namespace === undefined ? $document.createElement(data.tag) : $document.createElementNS(namespace, data.tag);
				cached = {
					tag: data.tag,
					//set attributes first, then create children
					attrs: hasKeys ? setAttributes(node, data.tag, data.attrs, {}, namespace) : data.attrs,
					children: data.children != null && data.children.length > 0 ?
						build(node, data.tag, undefined, undefined, data.children, cached.children, true, 0, data.attrs.contenteditable ? node : editable, namespace, configs) :
						data.children,
					nodes: [node]
				};
				if (cached.children && !cached.children.nodes) cached.children.nodes = [];
				//edge case: setting value on <select> doesn't work before children exist, so set it again after children have been created
				if (data.tag === "select" && data.attrs.value) setAttributes(node, data.tag, {value: data.attrs.value}, {}, namespace);
				parentElement.insertBefore(node, parentElement.childNodes[index] || null)
			}
			else {
				node = cached.nodes[0];
				if (hasKeys) setAttributes(node, data.tag, data.attrs, cached.attrs, namespace);
				cached.children = build(node, data.tag, undefined, undefined, data.children, cached.children, false, 0, data.attrs.contenteditable ? node : editable, namespace, configs);
				cached.nodes.intact = true;
				if (shouldReattach === true && node != null) parentElement.insertBefore(node, parentElement.childNodes[index] || null)
			}
			//schedule configs to be called. They are called after `build` finishes running
			if (typeof data.attrs["config"] === FUNCTION) {
				var context = cached.configContext = cached.configContext || {retain: (m.redraw.strategy() == "diff") || undefined};

				// bind
				var callback = function(data, args) {
					return function() {
						return data.attrs["config"].apply(data, args)
					}
				};
				configs.push(callback(data, [node, !isNew, context, cached]))
			}
		}
		else if (typeof data != FUNCTION) {
			//handle text nodes
			var nodes;
			if (cached.nodes.length === 0) {
				if (data.$trusted) {
					nodes = injectHTML(parentElement, index, data)
				}
				else {
					nodes = [$document.createTextNode(data)];
					if (!parentElement.nodeName.match(voidElements)) parentElement.insertBefore(nodes[0], parentElement.childNodes[index] || null)
				}
				cached = "string number boolean".indexOf(typeof data) > -1 ? new data.constructor(data) : data;
				cached.nodes = nodes
			}
			else if (cached.valueOf() !== data.valueOf() || shouldReattach === true) {
				nodes = cached.nodes;
				if (!editable || editable !== $document.activeElement) {
					if (data.$trusted) {
						clear(nodes, cached);
						nodes = injectHTML(parentElement, index, data)
					}
					else {
						//corner case: replacing the nodeValue of a text node that is a child of a textarea/contenteditable doesn't work
						//we need to update the value property of the parent textarea or the innerHTML of the contenteditable element instead
						if (parentTag === "textarea") parentElement.value = data;
						else if (editable) editable.innerHTML = data;
						else {
							if (nodes[0].nodeType === 1 || nodes.length > 1) { //was a trusted string
								clear(cached.nodes, cached);
								nodes = [$document.createTextNode(data)]
							}
							parentElement.insertBefore(nodes[0], parentElement.childNodes[index] || null);
							nodes[0].nodeValue = data
						}
					}
				}
				cached = new data.constructor(data);
				cached.nodes = nodes
			}
			else cached.nodes.intact = true
		}

		return cached
	}
	function sortChanges(a, b) {return a.action - b.action || a.index - b.index}
	function setAttributes(node, tag, dataAttrs, cachedAttrs, namespace) {
		for (var attrName in dataAttrs) {
			var dataAttr = dataAttrs[attrName];
			var cachedAttr = cachedAttrs[attrName];
			if (!(attrName in cachedAttrs) || (cachedAttr !== dataAttr)) {
				cachedAttrs[attrName] = dataAttr;
				try {
					//`config` isn't a real attributes, so ignore it
					if (attrName === "config" || attrName == "key") continue;
					//hook event handlers to the auto-redrawing system
					else if (typeof dataAttr === FUNCTION && attrName.indexOf("on") === 0) {
						node[attrName] = autoredraw(dataAttr, node)
					}
					//handle `style: {...}`
					else if (attrName === "style" && dataAttr != null && type.call(dataAttr) === OBJECT) {
						for (var rule in dataAttr) {
							if (cachedAttr == null || cachedAttr[rule] !== dataAttr[rule]) node.style[rule] = dataAttr[rule]
						}
						for (var rule in cachedAttr) {
							if (!(rule in dataAttr)) node.style[rule] = ""
						}
					}
					//handle SVG
					else if (namespace != null) {
						if (attrName === "href") node.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataAttr);
						else if (attrName === "className") node.setAttribute("class", dataAttr);
						else node.setAttribute(attrName, dataAttr)
					}
					//handle cases that are properties (but ignore cases where we should use setAttribute instead)
					//- list and form are typically used as strings, but are DOM element references in js
					//- when using CSS selectors (e.g. `m("[style='']")`), style is used as a string, but it's an object in js
					else if (attrName in node && !(attrName === "list" || attrName === "style" || attrName === "form" || attrName === "type" || attrName === "width" || attrName === "height")) {
						//#348 don't set the value if not needed otherwise cursor placement breaks in Chrome
						if (tag !== "input" || node[attrName] !== dataAttr) node[attrName] = dataAttr
					}
					else node.setAttribute(attrName, dataAttr)
				}
				catch (e) {
					//swallow IE's invalid argument errors to mimic HTML's fallback-to-doing-nothing-on-invalid-attributes behavior
					if (e.message.indexOf("Invalid argument") < 0) throw e
				}
			}
			//#348 dataAttr may not be a string, so use loose comparison (double equal) instead of strict (triple equal)
			else if (attrName === "value" && tag === "input" && node.value != dataAttr) {
				node.value = dataAttr
			}
		}
		return cachedAttrs
	}
	function clear(nodes, cached) {
		for (var i = nodes.length - 1; i > -1; i--) {
			if (nodes[i] && nodes[i].parentNode) {
				try {nodes[i].parentNode.removeChild(nodes[i])}
				catch (e) {} //ignore if this fails due to order of events (see http://stackoverflow.com/questions/21926083/failed-to-execute-removechild-on-node)
				cached = [].concat(cached);
				if (cached[i]) unload(cached[i])
			}
		}
		if (nodes.length != 0) nodes.length = 0
	}
	function unload(cached) {
		if (cached.configContext && typeof cached.configContext.onunload === FUNCTION) {
			cached.configContext.onunload();
			cached.configContext.onunload = null
		}
		if (cached.children) {
			if (type.call(cached.children) === ARRAY) {
				for (var i = 0, child; child = cached.children[i]; i++) unload(child)
			}
			else if (cached.children.tag) unload(cached.children)
		}
	}
	function injectHTML(parentElement, index, data) {
		var nextSibling = parentElement.childNodes[index];
		if (nextSibling) {
			var isElement = nextSibling.nodeType != 1;
			var placeholder = $document.createElement("span");
			if (isElement) {
				parentElement.insertBefore(placeholder, nextSibling || null);
				placeholder.insertAdjacentHTML("beforebegin", data);
				parentElement.removeChild(placeholder)
			}
			else nextSibling.insertAdjacentHTML("beforebegin", data)
		}
		else parentElement.insertAdjacentHTML("beforeend", data);
		var nodes = [];
		while (parentElement.childNodes[index] !== nextSibling) {
			nodes.push(parentElement.childNodes[index]);
			index++
		}
		return nodes
	}
	function autoredraw(callback, object) {
		return function(e) {
			e = e || event;
			m.redraw.strategy("diff");
			m.startComputation();
			try {return callback.call(object, e)}
			finally {
				endFirstComputation()
			}
		}
	}

	var html;
	var documentNode = {
		appendChild: function(node) {
			if (html === undefined) html = $document.createElement("html");
			if ($document.documentElement && $document.documentElement !== node) {
				$document.replaceChild(node, $document.documentElement)
			}
			else $document.appendChild(node);
			this.childNodes = $document.childNodes
		},
		insertBefore: function(node) {
			this.appendChild(node)
		},
		childNodes: []
	};
	var nodeCache = [], cellCache = {};
	m.render = function(root, cell, forceRecreation) {
		var configs = [];
		if (!root) throw new Error("Please ensure the DOM element exists before rendering a template into it.");
		var id = getCellCacheKey(root);
		var isDocumentRoot = root === $document;
		var node = isDocumentRoot || root === $document.documentElement ? documentNode : root;
		if (isDocumentRoot && cell.tag != "html") cell = {tag: "html", attrs: {}, children: cell};
		if (cellCache[id] === undefined) clear(node.childNodes);
		if (forceRecreation === true) reset(root);
		cellCache[id] = build(node, null, undefined, undefined, cell, cellCache[id], false, 0, null, undefined, configs);
		for (var i = 0, len = configs.length; i < len; i++) configs[i]()
	};
	function getCellCacheKey(element) {
		var index = nodeCache.indexOf(element);
		return index < 0 ? nodeCache.push(element) - 1 : index
	}

	m.trust = function(value) {
		value = new String(value);
		value.$trusted = true;
		return value
	};

	function gettersetter(store) {
		var prop = function() {
			if (arguments.length) store = arguments[0];
			return store
		};

		prop.toJSON = function() {
			return store
		};

		return prop
	}

	m.prop = function (store) {
		//note: using non-strict equality check here because we're checking if store is null OR undefined
		if (((store != null && type.call(store) === OBJECT) || typeof store === FUNCTION) && typeof store.then === FUNCTION) {
			return propify(store)
		}

		return gettersetter(store)
	};

	var roots = [], modules = [], controllers = [], lastRedrawId = null, lastRedrawCallTime = 0, computePostRedrawHook = null, prevented = false, topModule;
	var FRAME_BUDGET = 16; //60 frames per second = 1 call per 16 ms
	m.module = function(root, module) {
		if (!root) throw new Error("Please ensure the DOM element exists before rendering a template into it.");
		var index = roots.indexOf(root);
		if (index < 0) index = roots.length;
		var isPrevented = false;
		if (controllers[index] && typeof controllers[index].onunload === FUNCTION) {
			var event = {
				preventDefault: function() {isPrevented = true}
			};
			controllers[index].onunload(event)
		}
		if (!isPrevented) {
			m.redraw.strategy("all");
			m.startComputation();
			roots[index] = root;
			var currentModule = topModule = module = module || {};
			var controller = new (module.controller || function() {});
			//controllers may call m.module recursively (via m.route redirects, for example)
			//this conditional ensures only the last recursive m.module call is applied
			if (currentModule === topModule) {
				controllers[index] = controller;
				modules[index] = module
			}
			endFirstComputation();
			return controllers[index]
		}
	};
	m.redraw = function(force) {
		//lastRedrawId is a positive number if a second redraw is requested before the next animation frame
		//lastRedrawID is null if it's the first redraw and not an event handler
		if (lastRedrawId && force !== true) {
			//when setTimeout: only reschedule redraw if time between now and previous redraw is bigger than a frame, otherwise keep currently scheduled timeout
			//when rAF: always reschedule redraw
			if (new Date - lastRedrawCallTime > FRAME_BUDGET || $requestAnimationFrame === window.requestAnimationFrame) {
				if (lastRedrawId > 0) $cancelAnimationFrame(lastRedrawId);
				lastRedrawId = $requestAnimationFrame(redraw, FRAME_BUDGET)
			}
		}
		else {
			redraw();
			lastRedrawId = $requestAnimationFrame(function() {lastRedrawId = null}, FRAME_BUDGET)
		}
	};
	m.redraw.strategy = m.prop();
	var blank = function() {return ""}
	function redraw() {
		for (var i = 0, root; root = roots[i]; i++) {
			if (controllers[i]) {
				m.render(root, modules[i].view ? modules[i].view(controllers[i]) : blank())
			}
		}
		//after rendering within a routed context, we need to scroll back to the top, and fetch the document title for history.pushState
		if (computePostRedrawHook) {
			computePostRedrawHook();
			computePostRedrawHook = null
		}
		lastRedrawId = null;
		lastRedrawCallTime = new Date;
		m.redraw.strategy("diff")
	}

	var pendingRequests = 0;
	m.startComputation = function() {pendingRequests++};
	m.endComputation = function() {
		pendingRequests = Math.max(pendingRequests - 1, 0);
		if (pendingRequests === 0) m.redraw()
	};
	var endFirstComputation = function() {
		if (m.redraw.strategy() == "none") {
			pendingRequests--
			m.redraw.strategy("diff")
		}
		else m.endComputation();
	}

	m.withAttr = function(prop, withAttrCallback) {
		return function(e) {
			e = e || event;
			var currentTarget = e.currentTarget || this;
			withAttrCallback(prop in currentTarget ? currentTarget[prop] : currentTarget.getAttribute(prop))
		}
	};

	//routing
	var modes = {pathname: "", hash: "#", search: "?"};
	var redirect = function() {}, routeParams, currentRoute;
	m.route = function() {
		//m.route()
		if (arguments.length === 0) return currentRoute;
		//m.route(el, defaultRoute, routes)
		else if (arguments.length === 3 && type.call(arguments[1]) === STRING) {
			var root = arguments[0], defaultRoute = arguments[1], router = arguments[2];
			redirect = function(source) {
				var path = currentRoute = normalizeRoute(source);
				if (!routeByValue(root, router, path)) {
					m.route(defaultRoute, true)
				}
			};
			var listener = m.route.mode === "hash" ? "onhashchange" : "onpopstate";
			window[listener] = function() {
				var path = $location[m.route.mode]
				if (m.route.mode === "pathname") path += $location.search
				if (currentRoute != normalizeRoute(path)) {
					redirect(path)
				}
			};
			computePostRedrawHook = setScroll;
			window[listener]()
		}
		//config: m.route
		else if (arguments[0].addEventListener || arguments[0].attachEvent) {
			var element = arguments[0];
			var isInitialized = arguments[1];
			var context = arguments[2];
			element.href = (m.route.mode !== 'pathname' ? $location.pathname : '') + modes[m.route.mode] + this.attrs.href;
			if (element.addEventListener) {
				element.removeEventListener("click", routeUnobtrusive);
				element.addEventListener("click", routeUnobtrusive)
			}
			else {
				element.detachEvent("onclick", routeUnobtrusive);
				element.attachEvent("onclick", routeUnobtrusive)
			}
		}
		//m.route(route, params)
		else if (type.call(arguments[0]) === STRING) {
			var oldRoute = currentRoute;
			currentRoute = arguments[0];
			var args = arguments[1] || {}
			var queryIndex = currentRoute.indexOf("?")
			var params = queryIndex > -1 ? parseQueryString(currentRoute.slice(queryIndex + 1)) : {}
			for (var i in args) params[i] = args[i]
			var querystring = buildQueryString(params)
			var currentPath = queryIndex > -1 ? currentRoute.slice(0, queryIndex) : currentRoute
			if (querystring) currentRoute = currentPath + (currentPath.indexOf("?") === -1 ? "?" : "&") + querystring;

			var shouldReplaceHistoryEntry = (arguments.length === 3 ? arguments[2] : arguments[1]) === true || oldRoute === arguments[0];

			if (window.history.pushState) {
				computePostRedrawHook = function() {
					window.history[shouldReplaceHistoryEntry ? "replaceState" : "pushState"](null, $document.title, modes[m.route.mode] + currentRoute);
					setScroll()
				};
				redirect(modes[m.route.mode] + currentRoute)
			}
			else {
				$location[m.route.mode] = currentRoute
				redirect(modes[m.route.mode] + currentRoute)
			}
		}
	};
	m.route.param = function(key) {
		if (!routeParams) throw new Error("You must call m.route(element, defaultRoute, routes) before calling m.route.param()")
		return routeParams[key]
	};
	m.route.mode = "search";
	function normalizeRoute(route) {
		return route.slice(modes[m.route.mode].length)
	}
	function routeByValue(root, router, path) {
		routeParams = {};

		var queryStart = path.indexOf("?");
		if (queryStart !== -1) {
			routeParams = parseQueryString(path.substr(queryStart + 1, path.length));
			path = path.substr(0, queryStart)
		}

		// Get all routes and check if there's
		// an exact match for the current path
		var keys = Object.keys(router);
		var index = keys.indexOf(path);
		if(index !== -1){
			m.module(root, router[keys [index]]);
			return true;
		}

		for (var route in router) {
			if (route === path) {
				m.module(root, router[route]);
				return true
			}

			var matcher = new RegExp("^" + route.replace(/:[^\/]+?\.{3}/g, "(.*?)").replace(/:[^\/]+/g, "([^\\/]+)") + "\/?$");

			if (matcher.test(path)) {
				path.replace(matcher, function() {
					var keys = route.match(/:[^\/]+/g) || [];
					var values = [].slice.call(arguments, 1, -2);
					for (var i = 0, len = keys.length; i < len; i++) routeParams[keys[i].replace(/:|\./g, "")] = decodeURIComponent(values[i])
					m.module(root, router[route])
				});
				return true
			}
		}
	}
	function routeUnobtrusive(e) {
		e = e || event;
		if (e.ctrlKey || e.metaKey || e.which === 2) return;
		if (e.preventDefault) e.preventDefault();
		else e.returnValue = false;
		var currentTarget = e.currentTarget || e.srcElement;
		var args = m.route.mode === "pathname" && currentTarget.search ? parseQueryString(currentTarget.search.slice(1)) : {};
		while (currentTarget && currentTarget.nodeName.toUpperCase() != "A") currentTarget = currentTarget.parentNode
		m.route(currentTarget[m.route.mode].slice(modes[m.route.mode].length), args)
	}
	function setScroll() {
		if (m.route.mode != "hash" && $location.hash) $location.hash = $location.hash;
		else window.scrollTo(0, 0)
	}
	function buildQueryString(object, prefix) {
		var duplicates = {}
		var str = []
		for (var prop in object) {
			var key = prefix ? prefix + "[" + prop + "]" : prop
			var value = object[prop]
			var valueType = type.call(value)
			var pair = (value === null) ? encodeURIComponent(key) :
				valueType === OBJECT ? buildQueryString(value, key) :
				valueType === ARRAY ? value.reduce(function(memo, item) {
					if (!duplicates[key]) duplicates[key] = {}
					if (!duplicates[key][item]) {
						duplicates[key][item] = true
						return memo.concat(encodeURIComponent(key) + "=" + encodeURIComponent(item))
					}
					return memo
				}, []).join("&") :
				encodeURIComponent(key) + "=" + encodeURIComponent(value)
			if (value !== undefined) str.push(pair)
		}
		return str.join("&")
	}
	function parseQueryString(str) {
		var pairs = str.split("&"), params = {};
		for (var i = 0, len = pairs.length; i < len; i++) {
			var pair = pairs[i].split("=");
			var key = decodeURIComponent(pair[0])
			var value = pair.length == 2 ? decodeURIComponent(pair[1]) : null
			if (params[key] != null) {
				if (type.call(params[key]) !== ARRAY) params[key] = [params[key]]
				params[key].push(value)
			}
			else params[key] = value
		}
		return params
	}
	m.route.buildQueryString = buildQueryString
	m.route.parseQueryString = parseQueryString

	function reset(root) {
		var cacheKey = getCellCacheKey(root);
		clear(root.childNodes, cellCache[cacheKey]);
		cellCache[cacheKey] = undefined
	}

	m.deferred = function () {
		var deferred = new Deferred();
		deferred.promise = propify(deferred.promise);
		return deferred
	};
	function propify(promise, initialValue) {
		var prop = m.prop(initialValue);
		promise.then(prop);
		prop.then = function(resolve, reject) {
			return propify(promise.then(resolve, reject), initialValue)
		};
		return prop
	}
	//Promiz.mithril.js | Zolmeister | MIT
	//a modified version of Promiz.js, which does not conform to Promises/A+ for two reasons:
	//1) `then` callbacks are called synchronously (because setTimeout is too slow, and the setImmediate polyfill is too big
	//2) throwing subclasses of Error cause the error to be bubbled up instead of triggering rejection (because the spec does not account for the important use case of default browser error handling, i.e. message w/ line number)
	function Deferred(successCallback, failureCallback) {
		var RESOLVING = 1, REJECTING = 2, RESOLVED = 3, REJECTED = 4;
		var self = this, state = 0, promiseValue = 0, next = [];

		self["promise"] = {};

		self["resolve"] = function(value) {
			if (!state) {
				promiseValue = value;
				state = RESOLVING;

				fire()
			}
			return this
		};

		self["reject"] = function(value) {
			if (!state) {
				promiseValue = value;
				state = REJECTING;

				fire()
			}
			return this
		};

		self.promise["then"] = function(successCallback, failureCallback) {
			var deferred = new Deferred(successCallback, failureCallback);
			if (state === RESOLVED) {
				deferred.resolve(promiseValue)
			}
			else if (state === REJECTED) {
				deferred.reject(promiseValue)
			}
			else {
				next.push(deferred)
			}
			return deferred.promise
		};

		function finish(type) {
			state = type || REJECTED;
			next.map(function(deferred) {
				state === RESOLVED && deferred.resolve(promiseValue) || deferred.reject(promiseValue)
			})
		}

		function thennable(then, successCallback, failureCallback, notThennableCallback) {
			if (((promiseValue != null && type.call(promiseValue) === OBJECT) || typeof promiseValue === FUNCTION) && typeof then === FUNCTION) {
				try {
					// count protects against abuse calls from spec checker
					var count = 0;
					then.call(promiseValue, function(value) {
						if (count++) return;
						promiseValue = value;
						successCallback()
					}, function (value) {
						if (count++) return;
						promiseValue = value;
						failureCallback()
					})
				}
				catch (e) {
					m.deferred.onerror(e);
					promiseValue = e;
					failureCallback()
				}
			} else {
				notThennableCallback()
			}
		}

		function fire() {
			// check if it's a thenable
			var then;
			try {
				then = promiseValue && promiseValue.then
			}
			catch (e) {
				m.deferred.onerror(e);
				promiseValue = e;
				state = REJECTING;
				return fire()
			}
			thennable(then, function() {
				state = RESOLVING;
				fire()
			}, function() {
				state = REJECTING;
				fire()
			}, function() {
				try {
					if (state === RESOLVING && typeof successCallback === FUNCTION) {
						promiseValue = successCallback(promiseValue)
					}
					else if (state === REJECTING && typeof failureCallback === "function") {
						promiseValue = failureCallback(promiseValue);
						state = RESOLVING
					}
				}
				catch (e) {
					m.deferred.onerror(e);
					promiseValue = e;
					return finish()
				}

				if (promiseValue === self) {
					promiseValue = TypeError();
					finish()
				}
				else {
					thennable(then, function () {
						finish(RESOLVED)
					}, finish, function () {
						finish(state === RESOLVING && RESOLVED)
					})
				}
			})
		}
	}
	m.deferred.onerror = function(e) {
		if (type.call(e) === "[object Error]" && !e.constructor.toString().match(/ Error/)) throw e
	};

	m.sync = function(args) {
		var method = "resolve";
		function synchronizer(pos, resolved) {
			return function(value) {
				results[pos] = value;
				if (!resolved) method = "reject";
				if (--outstanding === 0) {
					deferred.promise(results);
					deferred[method](results)
				}
				return value
			}
		}

		var deferred = m.deferred();
		var outstanding = args.length;
		var results = new Array(outstanding);
		if (args.length > 0) {
			for (var i = 0; i < args.length; i++) {
				args[i].then(synchronizer(i, true), synchronizer(i, false))
			}
		}
		else deferred.resolve([]);

		return deferred.promise
	};
	function identity(value) {return value}

	function ajax(options) {
		if (options.dataType && options.dataType.toLowerCase() === "jsonp") {
			var callbackKey = "mithril_callback_" + new Date().getTime() + "_" + (Math.round(Math.random() * 1e16)).toString(36);
			var script = $document.createElement("script");

			window[callbackKey] = function(resp) {
				script.parentNode.removeChild(script);
				options.onload({
					type: "load",
					target: {
						responseText: resp
					}
				});
				window[callbackKey] = undefined
			};

			script.onerror = function(e) {
				script.parentNode.removeChild(script);

				options.onerror({
					type: "error",
					target: {
						status: 500,
						responseText: JSON.stringify({error: "Error making jsonp request"})
					}
				});
				window[callbackKey] = undefined;

				return false
			};

			script.onload = function(e) {
				return false
			};

			script.src = options.url
				+ (options.url.indexOf("?") > 0 ? "&" : "?")
				+ (options.callbackKey ? options.callbackKey : "callback")
				+ "=" + callbackKey
				+ "&" + buildQueryString(options.data || {});
			$document.body.appendChild(script)
		}
		else {
			var xhr = new window.XMLHttpRequest;
			xhr.open(options.method, options.url, true, options.user, options.password);
			xhr.onreadystatechange = function() {
				if (xhr.readyState === 4) {
					if (xhr.status >= 200 && xhr.status < 300) options.onload({type: "load", target: xhr});
					else options.onerror({type: "error", target: xhr})
				}
			};
			if (options.serialize === JSON.stringify && options.data && options.method !== "GET") {
				xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8")
			}
			if (options.deserialize === JSON.parse) {
				xhr.setRequestHeader("Accept", "application/json, text/*");
			}
			if (typeof options.config === FUNCTION) {
				var maybeXhr = options.config(xhr, options);
				if (maybeXhr != null) xhr = maybeXhr
			}

			var data = options.method === "GET" || !options.data ? "" : options.data
			if (data && (type.call(data) != STRING && data.constructor != window.FormData)) {
				throw "Request data should be either be a string or FormData. Check the `serialize` option in `m.request`";
			}
			xhr.send(data);
			return xhr
		}
	}
	function bindData(xhrOptions, data, serialize) {
		if (xhrOptions.method === "GET" && xhrOptions.dataType != "jsonp") {
			var prefix = xhrOptions.url.indexOf("?") < 0 ? "?" : "&";
			var querystring = buildQueryString(data);
			xhrOptions.url = xhrOptions.url + (querystring ? prefix + querystring : "")
		}
		else xhrOptions.data = serialize(data);
		return xhrOptions
	}
	function parameterizeUrl(url, data) {
		var tokens = url.match(/:[a-z]\w+/gi);
		if (tokens && data) {
			for (var i = 0; i < tokens.length; i++) {
				var key = tokens[i].slice(1);
				url = url.replace(tokens[i], data[key]);
				delete data[key]
			}
		}
		return url
	}

	m.request = function(xhrOptions) {
		if (xhrOptions.background !== true) m.startComputation();
		var deferred = new Deferred();
		var isJSONP = xhrOptions.dataType && xhrOptions.dataType.toLowerCase() === "jsonp";
		var serialize = xhrOptions.serialize = isJSONP ? identity : xhrOptions.serialize || JSON.stringify;
		var deserialize = xhrOptions.deserialize = isJSONP ? identity : xhrOptions.deserialize || JSON.parse;
		var extract = xhrOptions.extract || function(xhr) {
			return xhr.responseText.length === 0 && deserialize === JSON.parse ? null : xhr.responseText
		};
		xhrOptions.url = parameterizeUrl(xhrOptions.url, xhrOptions.data);
		xhrOptions = bindData(xhrOptions, xhrOptions.data, serialize);
		xhrOptions.onload = xhrOptions.onerror = function(e) {
			try {
				e = e || event;
				var unwrap = (e.type === "load" ? xhrOptions.unwrapSuccess : xhrOptions.unwrapError) || identity;
				var response = unwrap(deserialize(extract(e.target, xhrOptions)), e.target);
				if (e.type === "load") {
					if (type.call(response) === ARRAY && xhrOptions.type) {
						for (var i = 0; i < response.length; i++) response[i] = new xhrOptions.type(response[i])
					}
					else if (xhrOptions.type) response = new xhrOptions.type(response)
				}
				deferred[e.type === "load" ? "resolve" : "reject"](response)
			}
			catch (e) {
				m.deferred.onerror(e);
				deferred.reject(e)
			}
			if (xhrOptions.background !== true) m.endComputation()
		};
		ajax(xhrOptions);
		deferred.promise = propify(deferred.promise, xhrOptions.initialValue);
		return deferred.promise
	};

	//testing API
	m.deps = function(mock) {
		initialize(window = mock || window);
		return window;
	};
	//for internal testing only, do not use `m.deps.factory`
	m.deps.factory = app;

	return m
})(typeof window != "undefined" ? window : {});

if (typeof module != "undefined" && module !== null && module.exports) module.exports = m;
else if (typeof define === "function" && define.amd) define(function() {return m});

},{}],17:[function(require,module,exports){
///<reference path="overrides.d.ts"/>
var AwsUi = require('./AwsUi');
window.AwsUi = AwsUi;
AwsUi.__Metrics.sendMetricOnce('awsui-runtime-loaded', 1);

},{"./AwsUi":2}]},{},[17]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var ANIMATION_DURATION = 350; // ms
var AccordionAnimator = (function () {
    function AccordionAnimator(component) {
        this.component = component;
    }
    AccordionAnimator.prototype.updateState = function (key, value) {
        this.component.__animationState[key] = value;
        // Alert component that state changed
        this.component.__animationState = this.component.__animationState;
    };
    AccordionAnimator.prototype.animate = function (show) {
        var _this = this;
        // We can't animate height from or to 'auto', so we need to
        // calculate the content height explicitly.
        var content = this.component.node.querySelector('.awsui-accordion-section-content-container');
        // We animate to 1px since we are in border-box mode. You can't animate
        // borders away with 'height' animation
        var collapsedHeight = "1px";
        // If no content, then maybe not rendered yet? Anyway, we
        // can't animate.
        if (!content) {
            return;
        }
        // Initial animation state
        this.component.__animationState = { isAnimating: false };
        var animateHeight = content.scrollHeight + "px";
        // Animation is done in three steps:
        // 1: Set height to the initial height
        this.updateState('height', show ? collapsedHeight : animateHeight);
        // 2: Add animation class so next step will animate
        setTimeout(function () {
            _this.updateState('isAnimating', true);
            // 3: Set height to desired height (either expanded or collapsed)
            setTimeout(function () { return _this.updateState('height', show ? animateHeight : collapsedHeight); });
        });
        // Clean up afterwards
        setTimeout(function () { return _this.component.__animationState = undefined; }, ANIMATION_DURATION);
    };
    return AccordionAnimator;
})();
exports.default = AccordionAnimator;

},{}],2:[function(require,module,exports){
'use strict';
var AccordionAnimator_1 = require('./AccordionAnimator');
// An accordion section is a graphical control element that allows the user to expand
// only one of a predefined set of sections.
//
// Currently, the <code>awsui-accordion-section</code> component has to
// be used inside the [awsui-accordion-group](awsui-accordion-group) component.
AwsUi.__addComponent('awsui-accordion-section', {
    releaseStatus: 'preview',
    events: {
        // Fires when user clicks on header to expand
        'expand': {
            bubbles: true,
            cancelable: false
        },
        // Fires when user opens another section
        'collapse': {
            bubbles: true,
            cancelable: false
        },
        // Fires when this section needs to be expanded.
        // Differs from the public event in that this
        // also triggers when called through the API.
        '__expand': {
            bubbles: true,
            cancelable: true,
        },
    },
    properties: {
        // Header text of the accordion section
        'header': {
            type: 'string',
        },
        // Id of this specific section. Can be used to toggle
        // the expanded section of an accordion group.
        'sectionId': {
            type: 'string',
            announceValue: true
        },
        '__expanded': {
            type: 'boolean'
        },
        '__animationState': {
            type: 'object'
        }
    },
    functions: {
        // Expands this specific section
        expand: function () {
            if (!this.__expanded) {
                this.__fireEvent('__expand');
            }
        },
        __toggle: function (show, animate) {
            if (show === this.__expanded) {
                return;
            }
            this.__expanded = show;
            if (!animate) {
                return;
            }
            if (!this.__animator) {
                this.__animator = new AccordionAnimator_1.default(this);
            }
            this.__animator.animate(show);
        }
    },
    regions: {
        // Content inside the section
        'content': {
            'isDefault': true,
        },
    },
    render: function (m, h) {
        var _this = this;
        var header = function () {
            var cb = new h.ClassBuilder(_this);
            cb.addClass('awsui-accordion-section-header');
            cb.addClass('awsui-accordion-section-header-expandable', !_this.__expanded);
            cb.addClass('awsui-icon');
            cb.addClass('caret-down', _this.__expanded);
            cb.addClass('caret-up', !_this.__expanded);
            return m('h3', {
                className: cb.toClassName(),
                onclick: function () {
                    if (!_this.__expanded) {
                        _this.__fireEvent('__expand', { fromUser: true });
                        _this.__fireEvent('expand');
                    }
                }
            }, _this.header);
        };
        var content = function () {
            var cb = new h.ClassBuilder(_this);
            cb.addClass('awsui-accordion-section-content-container');
            cb.addClass('awsui-accordion-section-animating', _this.__animationState && _this.__animationState.isAnimating);
            cb.addClass('awsui-accordion-section-expanded', _this.__expanded || _this.__animationState);
            var styles = {};
            if (_this.__animationState && _this.__animationState.height) {
                styles['height'] = _this.__animationState.height;
            }
            var attributes = {
                className: cb.toClassName(),
                style: styles
            };
            return m('div', attributes, h.region('content', 'div', { className: 'awsui-accordion-section-content' }));
        };
        return [header(), content()];
    },
});
function isAccordionSection(element) {
    return element.component && element.component.__componentName === 'awsui-accordion-section';
}
function findSectionById(component, sections, id) {
    for (var _i = 0; _i < sections.length; _i++) {
        var section = sections[_i];
        if (section.component.sectionId === id) {
            return section;
        }
    }
}
function updateExpandedSection(component) {
    // Don't update if the right section has already been expanded.
    if (component.__expandedSection &&
        component.__expandedSection.sectionId === component.expandedSectionId) {
        return;
    }
    var sections = component.node.querySelectorAll('awsui-accordion-section');
    // Expand the section with the given ID, or otherwise the first section
    var section;
    if (component.expandedSectionId) {
        section = findSectionById(component, sections, component.expandedSectionId);
    }
    else {
        section = sections[0];
    }
    if (section) {
        expandSection(component, section.component);
    }
}
function expandSection(groupComponent, sectionComponent, animate) {
    if (animate === void 0) { animate = false; }
    groupComponent.__expandedSection = sectionComponent;
    // Update expanded state of all sections inside group
    var sections = groupComponent.node.querySelectorAll('awsui-accordion-section');
    for (var _i = 0; _i < sections.length; _i++) {
        var section = sections[_i];
        // Component may not have been initialized. In that case, skip it, we'll
        // get to it when it announces its initial value.
        if (!section.component) {
            continue;
        }
        section.component.__toggle(section.component === groupComponent.__expandedSection, animate);
    }
}
// The accordion group is used to group multiple [awsui-accordion-section](awsui-accordion-section)
// components. Only one accordion section within one group can be expanded at the same time.
AwsUi.__addComponent('awsui-accordion-group', {
    releaseStatus: 'preview',
    callbacks: {
        initialized: function () {
            var _this = this;
            this.__listenToPropertyChanges('sectionId', function (newValue, element) {
                if (!isAccordionSection(element)) {
                    return;
                }
                // Open the first section we encounter if no default set
                if (!_this.expandedSectionId && !_this.__expandedSection) {
                    expandSection(_this, element.component);
                }
                else if (_this.expandedSectionId) {
                    // Expand this section or not based on active section id
                    element.component.__expanded = (element.component.sectionId === _this.expandedSectionId);
                }
            });
            // Whenever a section indicates it needs to expand, we need to update
            // our own value (and signal a change)
            this.node.addEventListener('awsui:__expand', function (ev) {
                if (!isAccordionSection(ev.target)) {
                    return;
                }
                // Fire collapse on the currently expanded section
                // if this call was triggered by user.
                if (_this.__expandedSection && ev.detail.fromUser) {
                    _this.__expandedSection.__fireEvent('collapse');
                }
                // call expandSection so correct section is expanded
                // even if the section has no sectionId
                expandSection(_this, ev.target.component, ev.detail.fromUser);
                _this.expandedSectionId = ev.target.component.sectionId;
                _this.__fireEvent('change');
            });
        },
    },
    properties: {
        // The `sectionId` property's value of the currently expanded [section](/component/awsui-accordion-section).
        'expandedSectionId': {
            type: 'string',
            onChange: function () { updateExpandedSection(this); }
        }
    },
    events: {
        // Fires when the user opens a different section.
        'change': {
            bubbles: true,
            cancelable: false,
        },
    },
    regions: {
        // A list of accordion sections
        'content': {
            isDefault: true,
        },
    },
    render: function (m, h) {
        return h.region('content', 'div', { className: 'awsui-accordion-group-container' });
    },
    wrapperSupport: {
        'ngModel': {
            value: 'expandedSectionId',
            event: 'change',
        },
    },
});

},{"./AccordionAnimator":1}]},{},[2]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Alerts help customers know when they need to pay special attention to a relatively small piece of information
// or when they need to take a special action. Use alerts sparingly so users don't learn to ignore them.
AwsUi.__addComponent('awsui-alert', {
    releaseStatus: 'stable',
    events: {
        // Fires in response to a request to dismiss the alert. This occurs when user clicks
        // the UI controls exposed when 'dismissible' property is enabled, or when dismiss() is called.
        dismiss: {
            cancelable: true
        },
        // Fires when the alert is shown (i.e. when 'visible' property changes from false to
        // true).
        show: {
            cancelable: false
        },
        // Fires when the alert is hidden ('visible' property changes from true to false).  It is
        // typically fired in addition to 'awsui:dismiss'.
        hide: {
            cancelable: false
        }
    },
    properties: {
        // Indicates the nature of the message to be displayed.
        type: {
            nullable: false,
            valid: ['success', 'error', 'warning', 'info'],
            required: true,
            defaultValue: 'info'
        },
        // Determines whether the alert is displayed to the user or not.  This property is readable and writeable.
        visible: {
            type: 'boolean',
            defaultValue: true,
            onChange: function (oldVal, newVal) {
                var hiddenAttribute = 'awsui-alert-hidden';
                if (!newVal) {
                    this.node.setAttribute(hiddenAttribute, hiddenAttribute);
                    this.__fireEvent('hide');
                }
                else {
                    this.node.removeAttribute(hiddenAttribute);
                    this.__fireEvent('show');
                }
            }
        },
        // If true, the component will include a close button in the UI.
        // Clicking this button will fire the 'awsui:dismiss' event and set the 'visible' property to false.
        dismissible: {
            type: 'boolean'
        }
    },
    regions: {
        // The heading text displayed above the content text.
        header: {},
        // The primary text displayed in the alert element.
        content: {
            required: true,
            isDefault: true
        }
    },
    functions: {
        // Equivalent to a user clicking on the UI controls presented
        // when the 'dismissible' property is set true, including firing the 'awsui:dismiss' event.
        dismiss: function () {
            var event = this.__fireEvent('dismiss');
            if (!event.defaultPrevented) {
                this.visible = false;
            }
        }
    },
    render: function (m, h) {
        var component = this;
        function innerClass() {
            var cb = new h.ClassBuilder(component);
            cb.addClass('awsui-alert-inside')
                .addClass("awsui-alert-type-" + component.type)
                .addClass('awsui-alert-has-dismiss', component.dismissible)
                .addClass('awsui-alert-has-header', component.getRegion("header"));
            return cb.toClassName();
        }
        function dismiss() {
            if (!component.dismissible)
                return;
            var cb = new h.ClassBuilder(component);
            cb.addClass('awsui-button-as-link')
                .addClass('awsui-icon')
                .addClass("awsui-alert-times-" + component.type)
                .addClass('awsui-alert-dismiss-control');
            return m("button", {
                'className': cb.toClassName(),
                'aria-label': 'close',
                'type': 'button',
                onclick: function () { return component.dismiss(); }
            });
        }
        function header() {
            if (!component.getRegion('header'))
                return;
            var iconClassByType = {
                success: 'alert-check-circle',
                warning: 'alert-exclamation-triangle',
                info: 'alert-info-circle',
                error: 'alert-exclamation-circle'
            };
            var cb = new h.ClassBuilder(component);
            cb.addClass('awsui-alert-icon')
                .addClass('awsui-icon')
                .addClass('awsui-icon-big')
                .addClass(iconClassByType[component.type]);
            var icon = m("span", {
                'className': cb.toClassName()
            });
            return [
                icon,
                h.region('header', 'div', { 'className': 'awsui-alert-header awsui-text-big' })
            ];
        }
        return m("div", {
            'className': innerClass(),
            'aria-hidden': !this.visible,
            'role': 'alert'
        }, [
            header(),
            h.region("content"),
            dismiss()
        ]);
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Breadcrumbs are used for navigation and allow users to keep track of their locations within consoles.
AwsUi.__addComponent('awsui-breadcrumb-item', {
    releaseStatus: 'preview',
    properties: {
        // The text displayed in the breadcrumb item.
        text: {
            type: 'string'
        },
        // The URL for link within the breadcrumb item. You should specify the link
        // even if you have the click handler for a breadcrumb item.
        href: {
            type: 'string'
        }
    },
    events: {
        // Fires when the breadcrumb item is clicked by the user.
        // Please use "follow" event for more particular cases like SPA-routing.
        click: {
            bubbles: true,
            cancelable: true
        },
        // Fires when the breadcrumb item is clicked by left mouse button and
        // without modifier keys pressed (CTRL, ALT, SHIFT, META).
        // If you call `preventDefault()` for this event it will also prevent
        // the default action for a native click event.
        follow: {
            bubbles: true,
            cancelable: true
        }
    },
    render: function (m, h) {
        var component = this;
        var breadcrumbAttributes = h.copyDefined({
            'class': 'awsui-breadcrumb-link',
            'href': component.href || '#',
            'onclick': h.newEventHandler('click', function (event) {
                // only if primary mouse button is clicked without any modifier keys
                if (event.button !== 0 ||
                    event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
                    return;
                }
                var followEvent = this.__fireEvent('follow');
                if (followEvent.defaultPrevented) {
                    event.preventDefault();
                }
            }),
        });
        var breadcrumb = m('a', breadcrumbAttributes, component.text);
        return breadcrumb;
    }
});
// The breadcrumb group component displays a series of [awsui-breadcrumb-item](awsui-breadcrumb-item)
// components in a hierarchical navigation list.
AwsUi.__addComponent('awsui-breadcrumb-group', {
    releaseStatus: 'preview',
    regions: {
        // Region containing all the breadcrumb items in the group.
        // Use *ONLY* awsui-breadcrumb-item components inside this region.
        content: {
            isDefault: true
        }
    },
    render: function (m, h) {
        return h.region('content', 'nav', {
            'class': 'awsui-breadcrumb-list',
            'role': 'list'
        });
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
///<reference path="definitions.d.ts"/>
// Buttons allow users to identify actions within consoles.
//
// See also: [Button Group](awsui-button-group), [Button Dropdown](awsui-button-dropdown)
AwsUi.__addComponent('awsui-button', {
    releaseStatus: 'stable',
    properties: {
        // Renders the button as disabled and prevents clicks
        disabled: {
            type: 'boolean'
        },
        // Renders the button as being in a loading state. Takes precendence over
        // 'disabled' if both are specified. Prevents clicks.
        loading: {
            type: 'boolean'
        },
        // Causes an icon to be rendered with the content text. This should be an icon name from the
        // [Base Styles](https://chocolate.amazon.com/styles/base), excluding the "awsui-" prefix.
        icon: {
            type: 'string',
            // FIXME: Get list of icons from AWS-UI-Styles package
            valid: [
                'angle-double-left',
                'angle-double-right',
                'angle-down',
                'angle-left',
                'angle-right',
                'angle-up',
                'bell-o',
                'bolt',
                'calendar',
                'caret-down',
                'caret-left',
                'caret-right',
                'caret-up',
                'check-circle',
                'check',
                'circle',
                'clock-o',
                'cog',
                'download',
                'envelope',
                'exchange',
                'exclamation-circle',
                'exclamation-triangle',
                'external-link',
                'files-o',
                'filter',
                'folder-open',
                'info-circle',
                'list',
                'pause-circle-o',
                'pencil',
                'play-circle-o',
                'plus-circle',
                'plus',
                'question-circle',
                'refresh',
                'search',
                'star-o',
                'star',
                'tag',
                'th-large',
                'times-circle',
                'times',
                'upload'
            ]
        },
        iconAlign: {
            type: 'string',
            nullable: false,
            defaultValue: 'left',
            valid: [
                'left',
                'right'
            ]
        },
        // The text displayed within the button.
        text: {
            type: 'string',
            defaultValue: ''
        },
        // The form action that is performed by a button click.
        formAction: {
            type: 'string',
            nullable: false,
            defaultValue: 'submit',
            valid: [
                'submit',
                'none'
            ]
        },
        // This property will be used as aria-label. Should be used in buttons
        // that don't have text. For more info refer to
        // [the ARIA standard](http://www.w3.org/TR/wai-aria/states_and_properties#aria-label).
        label: {
            type: 'string'
        },
        // Renders a link with button styling. Use this property if you need a link
        // styled as a button, for example when you have a 'help' button that links
        // to the documentation.
        href: {
            type: 'string'
        },
        // When using the href attribute to render a button as link, you can add
        // a target attribute to specify the target of the link (e.g. _blank)
        target: {
            type: 'string'
        },
        // Styles the button with the selected size.
        size: {
            nullable: false,
            type: 'string',
            valid: ['normal', 'small'],
            defaultValue: 'normal'
        },
        // Determines the general styling of the button based on its prominence or importance.
        variant: {
            nullable: false,
            type: 'string',
            valid: ['normal', 'primary', 'danger', 'link', 'standalone-icon'],
            defaultValue: 'normal'
        }
    },
    functions: {
        // Invokes the button as though a user clicked it in the UI.
        click: function () {
            if (!this.__isDisabled()) {
                this.__fireEvent('click');
            }
        },
        __isDisabled: function () {
            return this.loading || this.disabled;
        }
    },
    events: {
        // Fires when button is clicked by user (and button is not disabled).
        click: {}
    },
    render: function (m, h) {
        var component = this;
        var isLink = Boolean(component.href);
        var element = isLink ? 'a' : 'button';
        var standalone = component.variant === 'standalone-icon';
        var icon = component.icon;
        var iconAlign = standalone ? 'left' : component.iconAlign;
        var lightImage = component.variant === 'primary' || component.variant === 'danger';
        function spinnerClass() {
            var cb = new h.ClassBuilder(component);
            cb.addClass('awsui-spinner')
                .addClass('awsui-spinner-disabled', !lightImage)
                .addClass('awsui-spinner-light', lightImage)
                .addClass('awsui-button-icon')
                .addClass('awsui-button-icon-left');
            return cb.toClassName();
        }
        function iconClass() {
            var disabled = !lightImage && component.__isDisabled();
            var hasHover = standalone && !disabled;
            var isLinkVariant = component.variant === 'link' && !disabled;
            var cb = new h.ClassBuilder(component);
            cb.addClass(icon)
                .addClass('awsui-icon')
                .addClass('awsui-icon-disabled', disabled)
                .addClass('awsui-icon-has-hover', hasHover)
                .addClass('awsui-icon-light', lightImage)
                .addClass('awsui-icon-link', isLinkVariant)
                .addClass('awsui-button-icon')
                .addClass("awsui-button-icon-" + iconAlign);
            return cb.toClassName();
        }
        function buttonClass() {
            var cb = new h.ClassBuilder(component);
            cb.addClass('awsui-button')
                .addPropertyValueClass('size')
                .addPropertyValueClass('variant')
                .addClass('awsui-hover-child-icons')
                .addClass('awsui-button-no-text', !component.text)
                .addClass('awsui-button-disabled', component.__isDisabled())
                .addClass('awsui-button-as-link', standalone);
            return cb.toClassName();
        }
        function clickHandler(event) {
            if (isLink && component.__isDisabled()) {
                event.preventDefault();
            }
            else {
                component.click();
            }
        }
        ;
        function leftIcon() {
            if (component.loading) {
                return m('span', { className: spinnerClass() });
            }
            else if (icon && iconAlign === 'left') {
                return m('span', { className: iconClass() });
            }
        }
        function rightIcon() {
            if (icon && iconAlign === 'right') {
                return m('span', { className: iconClass() });
            }
        }
        var buttonContent = [
            leftIcon(),
            component.text,
            rightIcon()
        ];
        var buttonType = component.formAction === 'none' ? 'button' : 'submit';
        var buttonElement = m(element, h.copyDefined({
            'className': buttonClass(),
            'aria-label': component.label,
            'onclick': clickHandler,
            'href': component.href,
            'role': isLink ? 'button' : undefined,
            'type': !isLink ? buttonType : undefined,
            'target': component.href && component.target ? component.target : undefined,
            'disabled': (component.__isDisabled() && !isLink) ? true : undefined,
            'aria-disabled': (component.__isDisabled() && isLink) ? true : undefined
        }), buttonContent);
        return buttonElement;
    }
});
// Button groups are used to visually group buttons.
//
// See also: [Button](awsui-button), [Button Dropdown](awsui-button-dropdown)
AwsUi.__addComponent('awsui-button-group', {
    releaseStatus: 'stable',
    regions: {
        // Region containing all the buttons in the button group.
        // Use *ONLY* awsui-button components inside this region.
        content: {
            isDefault: true
        }
    },
    render: function (m, h) {
        return h.region('content', 'div', { className: 'awsui-button-group-content' });
    }
});
// also used as a class prefix
var DROPDOWN_NAME = 'awsui-button-dropdown';
var KEYS_ESCAPE = 27;
var KEYS_DOWN = 40;
var KEYS_UP = 38;
// Button dropdown is used to offer a set of actions for a user using one button.
//
// See also: [Button](awsui-button), [Button Group](awsui-button-group)
AwsUi.__addComponent('awsui-button-dropdown', {
    releaseStatus: 'experimental',
    callbacks: {
        initialized: function () {
            var _this = this;
            this.__keydownHandler = function (event) {
                if (!_this.__expanded) {
                    return;
                }
                switch (event.keyCode) {
                    case KEYS_ESCAPE:
                        event.preventDefault();
                        // the dropdown is shown, otherwise the key event would not be handled
                        // therefore we can just toggle the dropdown.
                        _this.__toggleDropdown();
                        break;
                    case KEYS_DOWN:
                        event.preventDefault();
                        _this.__switchItem(1);
                        break;
                    case KEYS_UP:
                        event.preventDefault();
                        _this.__switchItem(-1);
                        break;
                }
            };
            this.__globalCloseClickHandler = function (event) {
                if (!_this.__expanded || _this.node.contains(event.target)) {
                    return;
                }
                _this.__expanded = false;
            };
        },
        attached: function () {
            document.addEventListener('mouseup', this.__globalCloseClickHandler);
            document.addEventListener('keydown', this.__keydownHandler);
        },
        detached: function () {
            document.removeEventListener('mouseup', this.__globalCloseClickHandler);
            document.removeEventListener('keydown', this.__keydownHandler);
        }
    },
    properties: {
        // Array of objects, each having the following properties:
        //
        // * 'id' [string]: ID for the dropdown item to identify the item handling the click event.
        // * 'text' [string]: description shown in the menu for this item.
        // * 'disabled' [boolean]: whether the item is disabled. If disabled it won't fire to click events.
        // * 'separator' [enum('none','bottom')]: whether the item has a separator on the list (if not defined 'none' is assumed).
        // * 'items' [object[]]: an array of item objects. items will be rendered as nested menu items but only for the first nesting level, multi-nesting is not supported.
        items: {
            type: 'array',
            itemType: 'Item'
        },
        // Renders the button as disabled and prevents clicks
        disabled: {
            type: 'boolean'
        },
        // Renders the button as being disabled and in a loading state. Takes
        // precendence over 'disabled' if both are specified.
        loading: {
            type: 'boolean'
        },
        // If true, the component will display the content area.  If false, the component will hide
        // the content area.
        __expanded: {
            type: 'boolean'
        },
        // Contains a focused item
        __focusedItem: {
            type: 'object',
            itemType: 'Item'
        },
        // The text displayed within the button.
        text: {
            type: 'string',
            defaultValue: ''
        },
    },
    functions: {
        __toggleDropdown: function () {
            this.__expanded = !this.__expanded;
        },
        __isDisabled: function () {
            return this.loading || this.disabled;
        },
        __focusItem: function (item) {
            if (item == this.__focusedItem) {
                return;
            }
            // it will re-render component setting a necessary class
            this.__focusedItem = item;
            // now we have to focus the element to have a proper interaction (ENTER/TAB)
            var focusedElement = this.node.querySelector("." + DROPDOWN_NAME + "-item-focus");
            if (focusedElement) {
                focusedElement.focus();
            }
        },
        __findAllEnabledItems: function () {
            var result = [];
            if (!this.items) {
                return result;
            }
            this.items.forEach(function (item) {
                if (item.disabled) {
                    return;
                }
                if (item.items) {
                    result = result.concat(item.items.filter(function (item) { return !item.disabled; }));
                    return;
                }
                result.push(item);
            });
            return result;
        },
        __switchItem: function (step) {
            var items = this.__findAllEnabledItems();
            var focusedIndex = items.indexOf(this.__focusedItem);
            var newFocusIndex = focusedIndex === -1 ? 0 : focusedIndex + step;
            if (newFocusIndex > items.length - 1) {
                newFocusIndex = 0;
            }
            if (newFocusIndex < 0) {
                newFocusIndex = items.length - 1;
            }
            this.__focusItem(items[newFocusIndex]);
        }
    },
    events: {
        // Fires when a menu item is clicked by the user.
        // The event object contains the `id` of the clicked item under
        // the `detail.id` property
        itemClick: {
            bubbles: true,
            cancelable: false,
            detailTypeName: 'ItemClick'
        }
    },
    render: function (m, h) {
        var component = this;
        var isDisabled = component.__isDisabled();
        function button() {
            function buttonClass() {
                var cb = new h.ClassBuilder(component);
                cb.addClass('awsui-button')
                    .addClass('awsui-button-size-normal')
                    .addClass('awsui-button-variant-normal')
                    .addClass('awsui-button-disabled', isDisabled);
                return cb.toClassName();
            }
            function clickHandler(event) {
                if (!component.__isDisabled()) {
                    component.__toggleDropdown();
                }
                event.preventDefault();
            }
            function icon() {
                var cb = new h.ClassBuilder(component);
                cb.addClass('awsui-icon')
                    .addClass('awsui-button-icon')
                    .addClass('awsui-button-icon-right')
                    .addClass(component.loading ? 'awsui-spinner' : 'angle-down')
                    .addClass(component.loading ? 'awsui-spinner-disabled' : 'awsui-icon-disabled', isDisabled);
                return m('span', { className: cb.toClassName() });
            }
            return m('button', h.copyDefined({
                'className': buttonClass(),
                'onclick': clickHandler,
                'type': 'button',
                'role': 'button',
                'disabled': isDisabled || undefined,
                'aria-disabled': isDisabled || undefined
            }), [component.text, icon()]);
        }
        function menuContent() {
            // Don't render the dropdown if the button is disabled, or if the menu
            // is collapsed.
            if (!component.items || component.items.length === 0 ||
                component.__isDisabled() || !component.__expanded) {
                return;
            }
            function itemList() {
                function menuItem(item, forceDisabled) {
                    if (forceDisabled === void 0) { forceDisabled = false; }
                    var isDisabled = forceDisabled || item.disabled;
                    var cb = new h.ClassBuilder(component);
                    cb.addClass(DROPDOWN_NAME + "-item")
                        .addClass(DROPDOWN_NAME + "-item-separator-bottom", item.separator === 'bottom')
                        .addClass(DROPDOWN_NAME + "-item-disabled", isDisabled);
                    var className = cb.toClassName();
                    return m('li', { className: className }, menuItemContent(item, isDisabled));
                }
                function menuItemContent(item, isDisabled) {
                    var cb = new h.ClassBuilder(component);
                    cb.addClass(DROPDOWN_NAME + "-item-content");
                    if (isDisabled) {
                        var attributes_1 = {
                            'className': cb.toClassName(),
                            'aria-disabled': true
                        };
                        return m('span', attributes_1, item.text);
                    }
                    cb.addClass(DROPDOWN_NAME + "-item-focus", item === component.__focusedItem);
                    var attributes = {
                        href: '#',
                        className: cb.toClassName(),
                        onmouseover: function (e) { component.__focusItem(item); },
                        onfocus: function (e) { component.__focusItem(item); },
                        onclick: function (e) {
                            e.preventDefault();
                            component.__fireEvent('itemClick', { id: item.id });
                            component.__toggleDropdown();
                        }
                    };
                    return m('a', attributes, item.text);
                }
                function category(item) {
                    var categoryItems = item.items.map(function (nested) { return menuItem(nested, item.disabled); });
                    var categoryElements = m('ul', {
                        className: DROPDOWN_NAME + "-content"
                    }, categoryItems);
                    var cb = new h.ClassBuilder(component);
                    cb.addClass(DROPDOWN_NAME + "-category-heading")
                        .addClass(DROPDOWN_NAME + "-item-disabled", item.disabled);
                    return m('li', { className: DROPDOWN_NAME + "-category" }, [
                        m('p', { className: cb.toClassName() }, item.text),
                        categoryElements
                    ]);
                }
                function dropdownElement(item) {
                    return !item.items ? menuItem(item) : category(item);
                }
                var dropdownElements = component.items.map(dropdownElement);
                return m('ul', { className: DROPDOWN_NAME + "-content" }, dropdownElements);
            }
            return m('div', { className: DROPDOWN_NAME }, itemList());
        }
        ;
        return m('div', [button(), menuContent()]);
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
var getNativeElement = function (component) { return component.node.querySelector('input'); };
var lastGeneratedId = 0;
function nextGeneratedId() {
    return 'awsui-checkbox-' + lastGeneratedId++;
}
AwsUi.__addComponent('awsui-checkbox', {
    releaseStatus: 'stable',
    callbacks: {
        initialized: function () {
            if (!this.controlId) {
                this.controlId = nextGeneratedId();
            }
        }
    },
    properties: {
        // Specifies whether the checkbox is checked.
        checked: {
            type: 'boolean'
        },
        // Specifies that the input should be disabled, preventing the user from
        // modifying the value and excluding the value from being included with a
        // form submit.
        disabled: {
            type: 'boolean'
        },
        // The id of the internal input. Useful for relating a label element's
        // "for" attribute to this control.
        controlId: {
            type: 'string'
        }
    },
    events: {
        // Fires when input focus is set onto the UI control.
        focus: {
            bubbles: true,
            cancelable: false
        },
        // Fires when input focus is removed from the UI control.
        blur: {
            bubbles: true,
            cancelable: false
        },
        // Fires when the user checks the checkbox.
        check: {
            bubbles: true,
            cancelable: true
        },
        // Fires when the user unchecks the checkbox.
        uncheck: {
            bubbles: true,
            cancelable: true
        },
        // Fires when the user changes the checkbox state.
        change: {
            bubbles: true,
            cancelable: true
        }
    },
    render: function (m, h) {
        var _this = this;
        var component = this;
        var props = ['checked', 'disabled'];
        var inputProperties = h.copyDefined(this, props);
        var spanClasses = new h.ClassBuilder(this);
        spanClasses.addClass('awsui-checkbox-styled-box')
            .addClass('awsui-checkbox-styled-box-disabled', this.disabled)
            .addClass('awsui-checkbox-styled-box-checked', this.checked);
        inputProperties.id = this.controlId;
        inputProperties.className = 'awsui-native-internal-checkbox';
        inputProperties.type = 'checkbox';
        inputProperties.onchange = m.withAttr('checked', function (value) {
            _this.checked = value;
            _this.__fireEvent('change');
            _this.__fireEvent(_this.checked ? 'check' : 'uncheck');
        });
        inputProperties.onfocus = h.newEventHandler('focus');
        inputProperties.onblur = h.newEventHandler('blur');
        var labelProperties = {
            className: 'awsui-checkbox-wrapper-label'
        };
        var check = m('div', {
            className: spanClasses.toClassName()
        });
        function label() {
            if (!component.label) {
                return;
            }
            var labelRegion = h.region('label', 'label', {
                for: component.controlId
            });
            return m('span', { className: 'awsui-checkbox-label' }, labelRegion);
        }
        return [
            m('label', labelProperties, m('input', inputProperties), check),
            label()
        ];
    },
    functions: {
        // Sets input focus onto the UI control.
        focus: function () {
            getNativeElement(this).focus();
        },
        // Removes input focus from the UI control.
        blur: function () {
            getNativeElement(this).blur();
        },
    },
    regions: {
        // The label for the checkbox.
        label: {
            isDefault: true
        },
    },
    wrapperSupport: {
        ngModel: {
            value: 'checked',
            event: 'change'
        }
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
// The awsui-control-group component is a combination of various UXDG patterns,
// making it easy to create properly styled controls in a form.
AwsUi.__addComponent('awsui-control-group', {
    releaseStatus: 'stable',
    callbacks: {
        initialized: function () {
            var _this = this;
            this.__listenToPropertyChanges('controlId', function (newValue) {
                return _this.__discoveredControlId = newValue;
            });
        }
    },
    functions: {
        __isValid: function () {
            return !this.validationMessage;
        }
    },
    render: function (m, h) {
        var component = this;
        function innerClass() {
            var className = "awsui-control-group-inside" + ((component.__isValid()) ? "" : " awsui-control-group-invalid");
            return className;
        }
        function label() {
            var labelFor = component.controlId || component.__discoveredControlId;
            var labelAttributes = {
                className: "awsui-control-group-label"
            };
            if (labelFor) {
                labelAttributes['for'] = labelFor;
            }
            return m("label", labelAttributes, component.label);
        }
        function controlWithTooltip() {
            return m("div", {
                className: "awsui-control-group-controls",
            }, [control(), tooltip(), instructional(), validation()]);
        }
        function control() {
            return h.region("control", "div", { className: 'awsui-control-group-control' });
        }
        function tooltip() {
            if (!component.detail)
                return;
            return m("div", {
                className: "awsui-control-group-tooltip"
            }, [tooltipIcon(), tooltipText()]);
        }
        function tooltipIcon() {
            return m("span", {
                className: "awsui-control-group-tooltip-icon awsui-icon info-circle awsui-icon-has-hover"
            });
        }
        function tooltipText() {
            return h.region('detail', 'span', { className: 'awsui-control-group-tooltip-text' });
        }
        function instructional() {
            if (!component.instructional) {
                return;
            }
            return m('div', {
                className: 'awsui-control-group-instructional-message'
            }, component.instructional);
        }
        function validation() {
            if (component.__isValid())
                return;
            return h.region('validationMessage', "div", { className: 'awsui-control-group-validation-message' });
        }
        return m("div", { className: innerClass() }, [label(), controlWithTooltip()]);
    },
    properties: {
        // The label for the control group.
        label: {},
        // Use instructional text when the customer needs to be able to read
        // this information while inputing information (such as constraints on the input).
        instructional: {},
        // The id of the primary form control.  Used for setting the label's "for" attribute
        // for accessibility.
        //
        // If unset, then the control group will automatically set the label to the id of
        // an inner form input component, like awsui-textfield. This only works well if
        // there is a single input component being used.
        controlId: {
            type: 'string'
        },
        __discoveredControlId: {
            type: 'string'
        }
    },
    regions: {
        // Control used for the control group. This region can be used to display an
        // input element, textarea etc.
        control: {
            isDefault: true
        },
        // Description of the control.  Currently used tooltip content.
        detail: {},
        // Text to show as validation for the control. Will render the control group in an
        // 'invalid' state, so only set when you know the contents are invalid.
        //
        // Read the UXDG to understand when validation messages should be set.
        validationMessage: {},
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
var lastGeneratedId = 0;
function nextGeneratedId() {
    return 'awsui-expandable-section-' + lastGeneratedId++;
}
// Expandable sections are used to present information that is broken into several sections, and
// users might want to see one or more sections at a time.
//
// A single expanding section can also be used to provide additional information or options
// related to a UI element, while reclaiming the screen space when the user is not actively
// referring to that content.
AwsUi.__addComponent('awsui-expandable-section', {
    releaseStatus: 'stable',
    callbacks: {
        initialized: function () {
            this.controlId = nextGeneratedId();
        }
    },
    properties: {
        // The heading text displayed above the content text.
        header: {
            type: 'string'
        },
        // If true, the component will display the content area.  If false, the component will hide
        // the content area.
        expanded: {
            type: 'boolean'
        }
    },
    regions: {
        // The primary text displayed in the expandable section element.
        content: {
            isDefault: true
        }
    },
    events: {
        // Fires when the user expands the content.
        expand: { bubbles: true, cancelable: false },
        // Fires when the user collapses the content.
        collapse: { bubbles: true, cancelable: false }
    },
    render: function (m, h) {
        var component = this;
        function header() {
            var cb = new h.ClassBuilder(component);
            cb.addClass('awsui-expandable-section-header')
                .addClass('awsui-icon')
                .addClass(component.expanded ? 'caret-down' : 'caret-right');
            var attributes = {
                'class': cb.toClassName(),
                'aria-controls': component.controlId,
                'onclick': function () {
                    component.expanded = !component.expanded;
                    component.__fireEvent(component.expanded ? 'expand' : 'collapse');
                }
            };
            return m('h3', attributes, component.header);
        }
        function content() {
            var cb = new h.ClassBuilder(component);
            cb.addClass('awsui-expandable-section-content')
                .addClass('awsui-expandable-section-expanded', component.expanded);
            var attributes = {
                'class': cb.toClassName(),
                'role': 'region',
                'id': component.controlId,
                'aria-expanded': component.expanded
            };
            return h.region("content", 'div', attributes);
        }
        return [header(), content()];
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// A label is a small rounded rectangle containing a single, capitalized word.
AwsUi.__addComponent('awsui-label', {
    releaseStatus: 'stable',
    properties: {
        // Indicates the nature of the information.
        type: {
            type: 'string',
            nullable: false,
            valid: ['success', 'error', 'warning', 'info', 'disabled'],
            required: true,
            defaultValue: 'info'
        },
        // Descriptive label
        label: {
            type: 'string'
        }
    },
    render: function (m, h) {
        var classes = new h.ClassBuilder(this);
        classes.addPropertyValueClass('type');
        classes.addClass('awsui-label-content');
        return m('span', { className: classes.toClassName() }, this.label);
    }
});
// A badge is a small oval that displays a number.
AwsUi.__addComponent('awsui-badge', {
    releaseStatus: 'stable',
    properties: {
        // Indicates the nature of the information.
        type: {
            type: 'string',
            nullable: false,
            valid: ['success', 'error', 'warning', 'info', 'disabled'],
            required: true,
            defaultValue: 'info'
        },
        // Count displayed inside the badge
        value: {
            type: 'integer',
            nullable: false,
            defaultValue: 0
        }
    },
    render: function (m, h) {
        var classes = new h.ClassBuilder(this);
        classes.addPropertyValueClass('type');
        classes.addClass('awsui-badge-content');
        return m('span', { className: classes.toClassName() }, this.value);
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*
 * Control page content scrolling
 */
var domutils = AwsUi.__DomUtils;
var modalOpenClass = 'awsui-modal-open';
var initialBodyPaddingRightStyle = null;
function disableBodyScrolling() {
    setBodyScrollbarPadding();
    domutils.addClass(document.body, modalOpenClass);
}
exports.disableBodyScrolling = disableBodyScrolling;
function enableBodyScrolling() {
    domutils.removeClass(document.body, modalOpenClass);
    restoreBodyScrollbarPadding();
}
exports.enableBodyScrolling = enableBodyScrolling;
function setBodyScrollbarPadding() {
    if (bodyHasScrollbar()) {
        initialBodyPaddingRightStyle = document.body.style.paddingRight;
        var initialBodyPaddingRight = computedBodyPaddingRightPixels();
        var scrollbarWidth = browserScrollbarWidth();
        var newBodyPaddingRight = initialBodyPaddingRight + scrollbarWidth;
        document.body.style.paddingRight = newBodyPaddingRight + 'px';
    }
}
function computedBodyPaddingRightPixels() {
    return parseInt(window.getComputedStyle(document.body).paddingRight, 10);
}
function restoreBodyScrollbarPadding() {
    if (initialBodyPaddingRightStyle) {
        document.body.style.paddingRight = initialBodyPaddingRightStyle;
    }
    else {
        document.body.style.removeProperty('padding-right');
    }
    initialBodyPaddingRightStyle = null;
}
// Technique borrowed from Bootstrap: Create an offscreen div styled to ensure a scrollbar exists,
// then measure its dimensions to get scrollbar width.
// https://github.com/twbs/bootstrap/blob/master/js/modal.js#L277
function browserScrollbarWidth() {
    var scrollDiv = document.createElement('div');
    scrollDiv.className = 'awsui-modal-scrollbar-measure';
    document.body.appendChild(scrollDiv);
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
    document.body.removeChild(scrollDiv);
    return scrollbarWidth;
}
function bodyHasScrollbar() {
    // Unfortunately this difference doesn't appear to match the scrollbar width during testing,
    // otherwise we could remove browserScrollbarWidth().  Bootstrap also doesn't use this difference
    // directly.
    return document.body.clientWidth < window.innerWidth;
}

},{}],2:[function(require,module,exports){
'use strict';
var BodyScroll = require("./BodyScroll");
// XXX: Make sure to update the `animation-duration` property in the
// styles if the animation duration changes.
var ANIMATION_MS = 450;
var ESC = 27;
// A modal dialog is a graphical element which creates a mode where the main
// window can't be used.
AwsUi.__addComponent('awsui-modal', {
    releaseStatus: 'stable',
    callbacks: {
        attached: function () {
            // Force transition to visible (without toggling this.visible)
            if (this.visible) {
                this.__state = 'hidden';
                updateVisible(this, true);
            }
        },
        detached: function () {
            // Ignoring multiple modal instance case for now
            BodyScroll.enableBodyScrolling();
            this.__initiallyFocusedElement = undefined;
        }
    },
    properties: {
        // Sets the title of the modal. Even if this can be empty, it's suggested
        // that your modals always have a title.
        header: {
            type: 'string',
        },
        // Sets the width of the modal.  'max' is variable width, set to the largest size allowed by
        // the UXDG.  Other sizes (small/medium/large) are fixed widths.  Default is 'medium'.
        size: {
            type: 'string',
            valid: ['small', 'medium', 'large', 'max'],
            defaultValue: 'medium'
        },
        // Will display the dialog on the screen. Modals are hidden by default,
        // so make sure to toggle this variable to trigger the modal.
        visible: {
            type: 'boolean',
            onChange: function (_, visible) {
                updateVisible(this, visible);
            },
        },
        '__state': {
            type: 'string',
            defaultValue: 'hidden',
            valid: ['hidden', 'fadeIn', 'showing', 'fadeOut'],
            onChange: onStateChange,
        },
    },
    events: {
        // Fires in response to a user request to remove the modal dialog from
        // view. This occurs when user clicks the UI control, but not when
        // dismiss() is called.
        dismiss: {
            bubbles: true,
            cancelable: true,
        },
    },
    functions: {
        // Dismisses the dialog. Won't trigger the `awsui:dismiss` event.
        dismiss: function () {
            this.visible = false;
        },
        __UIDismiss: function () {
            var dismissEvent = this.__fireEvent('dismiss');
            if (!dismissEvent.defaultPrevented) {
                this.dismiss();
            }
        },
    },
    regions: {
        // Will be rendered as the body of the modal.
        content: {
            isDefault: true,
        },
        // The footer of the dialog. Optional. Will not render at all if empty.
        footer: {},
    },
    render: function (m, h) {
        var component = this;
        function escKeyHandler(ev) {
            if (ev.keyCode === ESC) {
                component.__UIDismiss();
            }
        }
        function dismissHandler(ev) {
            if (ev.target === this) {
                component.__UIDismiss();
            }
        }
        function getHeader() {
            var dismissButton = m('button', {
                className: 'awsui-modal-dismiss-control awsui-button-as-link awsui-icon times',
                onclick: dismissHandler,
            });
            return m('div', { className: 'awsui-modal-header' }, dismissButton, component.header);
        }
        function getBody() {
            var content = h.region('content');
            return m('div', { className: 'awsui-modal-body' }, content);
        }
        function getFooter() {
            var content = h.region('footer');
            if (content) {
                return m('div', { className: 'awsui-modal-footer' }, content);
            }
        }
        function dialogContents() {
            var attributes = {
                className: 'awsui-modal-content'
            };
            var contents = [
                getHeader(),
                getBody(),
                getFooter(),
            ];
            return m('div', attributes, contents);
        }
        function dialog() {
            var dialogCb = new h.ClassBuilder(component)
                .addClass('awsui-modal-dialog')
                .addPropertyValueClass('size');
            var attributes = {
                className: dialogCb.toClassName(),
                onkeydown: escKeyHandler,
                tabindex: '-1'
            };
            return m('div', attributes, dialogContents());
        }
        var cb = new h.ClassBuilder(this);
        cb.addClass('awsui-modal-container');
        cb.addPropertyValueClass('__state');
        var container = m('div', {
            className: cb.toClassName(),
            onclick: dismissHandler,
        }, dialog());
        function getOverlay() {
            var cb = new h.ClassBuilder(component);
            cb.addClass('awsui-modal-overlay');
            cb.addPropertyValueClass('__state');
            return m('div', {
                className: cb.toClassName(),
            });
        }
        // hidden element in tab order to keep focus from escaping modal contents
        // need one at end and beginning of modal for regular tab and shift-tab
        function newTabtrap() {
            return m('div', {
                className: 'awsui-modal-tabtrap',
                tabindex: component.visible ? 0 : -1,
                onfocus: function () { return setDialogFocus(component); }
            });
        }
        ;
        return [newTabtrap(), container, getOverlay(), newTabtrap()];
    },
});
function updateVisible(component, visible) {
    component.__state = visible ? 'fadeIn' : 'fadeOut';
    if (visible) {
        // Set focus on dialog to allow ESC key to dismiss
        setDialogFocus(component);
    }
    else {
        // Restore focus to element that had it before dialog appeared
        restoreInitialFocus(component);
    }
}
function onStateChange(oldState, newState) {
    var component = this;
    function changeStateAsync(currentState, targetState) {
        if (component.__timeoutID) {
            clearTimeout(component.__timeoutID);
        }
        component.__timeoutID = setTimeout(function () {
            if (component.__state === currentState) {
                component.__state = targetState;
            }
            component.__timeoutID = undefined;
        }, ANIMATION_MS);
    }
    if (newState === 'fadeOut') {
        changeStateAsync('fadeOut', 'hidden');
    }
    else if (newState === 'fadeIn') {
        changeStateAsync('fadeIn', 'showing');
    }
    updateBodyScrollingState(this);
}
function updateBodyScrollingState(component) {
    var attached = component.__componentState === 'attached';
    var showing = attached && component.__state !== 'hidden';
    if (showing) {
        BodyScroll.disableBodyScrolling();
    }
    else {
        BodyScroll.enableBodyScrolling();
    }
}
function setDialogFocus(component) {
    var dialog = component.node.querySelector('.awsui-modal-dialog');
    if (dialog && dialog.focus) {
        component.__initiallyFocusedElement = document.activeElement;
        dialog.focus();
    }
    else {
        component.__initiallyFocusedElement = undefined;
    }
}
function restoreInitialFocus(component) {
    if (component.__initiallyFocusedElement && component.__initiallyFocusedElement.focus) {
        component.__initiallyFocusedElement.focus();
    }
    component.__initiallyFocusedElement = undefined;
}

},{"./BodyScroll":1}]},{},[2]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
var lastGeneratedId = 0;
var generateButtonId = function () { return ("awsui-radio-button-" + lastGeneratedId++); };
var generateGroupName = function () { return ("awsui-radio-group-" + lastGeneratedId++); };
var getNativeElement = function (component) { return component.node.querySelector('input'); };
// A radio button is a graphical control element that allows the user to choose
// only one of a predefined set of options, an exclusive or.
//
// Currently, the <code>awsui-radio-button</code> component has to
// be used inside the [awsui-radio-group](awsui-radio-group) component.
AwsUi.__addComponent('awsui-radio-button', {
    releaseStatus: 'stable',
    callbacks: {
        attached: function () {
            this.controlId = this.controlId || generateButtonId();
        },
    },
    events: {
        // Fires when the component is selected
        '__selected': {
            bubbles: true,
            cancelable: true,
        },
        // Fires when input focus is set onto the UI control.
        'focus': {
            bubbles: true,
            cancelable: true,
        },
        // Fires when input focus is removed from the UI control.
        'blur': {
            bubbles: true,
            cancelable: true,
        },
    },
    properties: {
        // Will hold the radio button's value. This is the value the radio
        // group will get when the radio button is selected.
        'value': {
            type: 'string',
            announceValue: true,
        },
        // Specifies that the element should be disabled, preventing the user from
        // modifying its state.
        'disabled': {
            type: 'boolean',
        },
        // The id of the internal input. Useful for relating a label element's
        // "for" attribute to this control.
        'controlId': {
            type: 'string',
        },
        // Whether the component is currently checked. Will be updated by the
        // radio group.
        '__checked': {
            type: 'boolean'
        },
        // The `name` attribute for the underlying `<input>` element. Will be set
        // by the radio group automatically.
        '__name': {
            type: 'string',
        },
    },
    functions: {
        // Sets input focus onto the UI control.
        'focus': function () {
            getNativeElement(this).focus();
        },
        // Removes input focus from the UI control.
        'blur': function () {
            getNativeElement(this).blur();
        },
        // Performs a "click" on the UI control.
        'click': function () {
            getNativeElement(this).click();
        }
    },
    regions: {
        // The label for the input.
        'label': {
            'isDefault': true,
        },
    },
    render: function (m, h) {
        var component = this;
        function label() {
            var classes = new h.ClassBuilder(component);
            classes.addClass('awsui-radio-button-label');
            classes.addClass('awsui-radio-button-checked', component.__checked);
            return m('label', {
                'for': component.controlId || null,
                className: classes.toClassName()
            }, h.region('label'));
        }
        var labelClasses = new h.ClassBuilder(this);
        labelClasses.addClass('awsui-radio-button-wrapper-label');
        labelClasses.addClass('awsui-radio-button-disabled', component.disabled);
        var attrs = ['disabled', 'value'];
        var inputOptions = h.copyDefined(this, attrs);
        if (this.controlId) {
            inputOptions.id = this.controlId;
        }
        if (this.__name) {
            inputOptions.name = this.__name;
        }
        inputOptions.checked = this.__checked;
        inputOptions.type = 'radio';
        inputOptions.className = 'awsui-radio-button-input';
        // Events
        inputOptions.onblur = h.newEventHandler('blur');
        inputOptions.onfocus = h.newEventHandler('focus');
        inputOptions.onchange = function () {
            component.__checked = true;
            component.__fireEvent('__selected');
        };
        var radioButton = m('input', inputOptions);
        var styledRadio = m('div', { className: 'awsui-radio-button-styled-button' });
        var customRadio = m('label', { className: labelClasses.toClassName() }, radioButton, styledRadio);
        return [
            customRadio,
            label(),
        ];
    },
});
// The radio group is used to group multiple [awsui-radio-button](awsui-radio-button)
// components. All the radio buttons in the same group share the same option -- that is,
// when one button is selected, the others are deselected.
//
// The radio group is also the only supported way to get the current value out of
// a set of radio buttons.
AwsUi.__addComponent('awsui-radio-group', {
    releaseStatus: 'stable',
    callbacks: {
        initialized: function () {
            var _this = this;
            this.name = generateGroupName();
            function isRadioButton(element) {
                return element.component && element.component.__componentName === 'awsui-radio-button';
            }
            this.__listenToPropertyChanges('value', function (newValue, element) {
                if (!isRadioButton(element)) {
                    return;
                }
                // Set the name of the component to our name, in case
                // this is a newly added awsui-button
                element.component.__name = _this.name;
                // Check or uncheck the radio depending on our current value
                element.component.__checked = element.component.value === _this.value;
            });
            // Whenever a radio button fires, we need to update
            // our own value (and signal a change)
            this.node.addEventListener('awsui:__selected', function (ev) {
                if (!isRadioButton(ev.target)) {
                    return;
                }
                _this.value = ev.target.component.value;
                _this.__fireEvent('change');
            });
        },
    },
    functions: {
        __updateSelectedButton: function () {
            var buttons = this.node.querySelectorAll('awsui-radio-button');
            for (var _i = 0; _i < buttons.length; _i++) {
                var button = buttons[_i];
                button.component.__checked = button.component.value === this.value;
            }
        }
    },
    properties: {
        // The value of the checked button.
        'value': {
            type: 'string',
            onChange: function () { this.__updateSelectedButton(); }
        }
    },
    events: {
        // Fires when the user selects a different radio button. The new button value
        // can be read from the 'value' property.
        'change': {
            bubbles: true,
            cancelable: true,
        },
    },
    regions: {
        // A list of radio buttons to be rendered inside the group.
        'content': {
            isDefault: true,
        },
    },
    render: function (m, h) {
        return h.region('content');
    },
    wrapperSupport: {
        'ngModel': {
            value: 'value',
            event: 'change',
        },
    },
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*! select v1.1.0 | MIT License | github.com/HubSpot/select */
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
///<reference path="tether.d.ts"/>
var Tether = require('tether');
var _a = Tether.Utils, extend = _a.extend, addClass = _a.addClass, removeClass = _a.removeClass, hasClass = _a.hasClass, getBounds = _a.getBounds;
var ENTER = 13;
var ESCAPE = 27;
var SPACE = 32;
var UP = 38;
var DOWN = 40;
var TAB = 9;
function isRepeatedChar(str) {
    return Array.prototype.reduce.call(str, function (a, b) {
        return a === b ? b : false;
    });
}
var focusClass = 'awsui-select-target-focused';
var Select = (function (_super) {
    __extends(Select, _super);
    function Select(options, items) {
        _super.call(this, options);
        this.options = extend({}, Select.defaults, options);
        this.items = items || [];
        this.setupTarget();
        this.renderTarget();
        this.setupDrop();
        this.renderDrop();
        this.bindClick();
        this.bindKeys();
        this.value = undefined;
        this.searchText = '';
    }
    Select.prototype.setupTarget = function () {
        var _this = this;
        this.target = document.createElement('span');
        this.addClass(this.target, 'target');
        this.valueContainer = document.createElement('span');
        this.addClass(this.valueContainer, 'value');
        this.target.appendChild(this.valueContainer);
        var tabIndex = 0;
        this.target.setAttribute('tabindex', tabIndex);
        this.target.setAttribute('role', 'combobox');
        this.target.setAttribute('aria-autocomplete', 'list');
        if (this.options.className) {
            addClass(this.target, this.options.className);
        }
        this.target.selectInstance = this;
        this.target.addEventListener('mousedown', function () {
            if (!_this.isOpen()) {
                _this.target.focus();
            }
            else {
                _this.target.blur();
            }
        });
        this.target.addEventListener('focus', function () {
            addClass(_this.target, focusClass);
        });
        this.target.addEventListener('blur', function (_a) {
            var relatedTarget = _a.relatedTarget;
            removeClass(_this.target, focusClass);
        });
    };
    Select.prototype.prefixedClassname = function (className) {
        return this.options.classPrefix + "-" + className;
    };
    Select.prototype.find = function (element, className) {
        return element.querySelector("." + this.prefixedClassname(className));
    };
    Select.prototype.findAll = function (element, className) {
        return element.querySelectorAll("." + this.prefixedClassname(className));
    };
    Select.prototype.addClass = function (element, className) {
        addClass(element, this.prefixedClassname(className));
    };
    Select.prototype.removeClass = function (element, className) {
        removeClass(element, this.prefixedClassname(className));
    };
    Select.prototype.hasClass = function (element, className) {
        return hasClass(element, this.prefixedClassname(className));
    };
    Select.prototype.setupDrop = function () {
        var _this = this;
        this.drop = document.createElement('div');
        this.addClass(this.drop, 'dropdown');
        addClass(this.drop, 'awsui');
        if (this.options.className) {
            addClass(this.drop, this.options.className);
        }
        this.drop.addEventListener('click', function (e) {
            if (_this.hasClass(e.target, 'option')) {
                _this.pickOption(e.target);
            }
            // Built-in selects don't propagate click events in their drop directly
            // to the body, so we don't want to either.
            e.stopPropagation();
        });
        this.drop.addEventListener('mousemove', function (e) {
            if (_this.hasClass(e.target, 'option')) {
                _this.highlightOption(e.target);
            }
        });
        this.content = document.createElement('div');
        this.addClass(this.content, 'content');
        this.drop.appendChild(this.content);
    };
    Select.prototype.open = function () {
        var _this = this;
        if (this.options.disabled) {
            return;
        }
        this.addClass(this.target, 'open');
        this.addClass(this.drop, 'open');
        this.content.setAttribute('style', 'width: ' + this.target.offsetWidth + 'px');
        var selectedOption = this.find(this.drop, 'option-selected');
        if (!selectedOption) {
            return;
        }
        this.highlightOption(selectedOption);
        this.scrollDropContentToOption(selectedOption);
        var positionSelectStyle = function () {
            if (_this.hasClass(_this.drop, 'abutted-left') ||
                _this.hasClass(_this.drop, 'abutted-bottom')) {
                var dropBounds = getBounds(_this.drop);
                var optionBounds = getBounds(selectedOption);
                var offset = dropBounds.top - (optionBounds.top + optionBounds.height);
                _this.drop.style.top = ((parseFloat(_this.drop.style.top) || 0) + offset) + "px";
            }
        };
        var alignToHighlighted = this.options.alignToHighlighted;
        var _a = this.content, scrollHeight = _a.scrollHeight, clientHeight = _a.clientHeight;
        if (alignToHighlighted === 'always' || (alignToHighlighted === 'auto' && scrollHeight <= clientHeight)) {
            setTimeout(function () {
                positionSelectStyle();
            });
        }
        this.trigger('open');
    };
    Select.prototype.close = function () {
        if (!this.isOpen()) {
            return;
        }
        this.removeClass(this.target, 'open');
        this.removeClass(this.drop, 'open');
        this.trigger('close');
    };
    Select.prototype.toggle = function () {
        if (this.isOpen()) {
            this.close();
        }
        else {
            this.open();
        }
    };
    Select.prototype.isOpen = function () {
        return this.hasClass(this.drop, 'open');
    };
    Select.prototype.attach = function () {
        document.addEventListener('mousedown', this.globalClickListener);
    };
    Select.prototype.detach = function () {
        this.close();
        document.removeEventListener('mousedown', this.globalClickListener);
    };
    Select.prototype.bindClick = function () {
        var _this = this;
        this.target.addEventListener('mousedown', function (e) {
            e.preventDefault();
            _this.toggle();
        });
        this.globalClickListener = function (event) {
            if (!_this.isOpen()) {
                return;
            }
            // Clicking inside dropdown
            if (event.target === _this.drop ||
                _this.drop.contains(event.target)) {
                return;
            }
            // Clicking target
            if (event.target === _this.target ||
                _this.target.contains(event.target)) {
                return;
            }
            _this.close();
        };
    };
    Select.prototype.getSelectedItem = function () {
        if (this.value === undefined) {
            return;
        }
        for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
            var item = _a[_i];
            if (item.value == this.value) {
                return item;
            }
        }
    };
    Select.prototype.renderTarget = function () {
        var selectedItem = this.getSelectedItem();
        if (selectedItem) {
            this.valueContainer.textContent = this.getSelectedItem().text;
            this.removeClass(this.valueContainer, 'placeholder');
        }
        else if (this.options.placeholder) {
            // Render placeholder if available
            this.valueContainer.textContent = this.options.placeholder;
            this.addClass(this.valueContainer, 'placeholder');
        }
        else {
            // We want the select to align based on the baseline of the surrounding text.
            // This only works if the select actually contains text.
            // We force this by adding a non-breaking space.
            this.valueContainer.textContent = '\u00a0';
            this.removeClass(this.valueContainer, 'placeholder');
        }
    };
    Select.prototype.renderDrop = function () {
        var optionList = document.createElement('ul');
        this.addClass(optionList, 'options');
        for (var _i = 0, _a = this.items; _i < _a.length; _i++) {
            var item = _a[_i];
            var option = document.createElement('li');
            this.addClass(option, 'option');
            option.setAttribute('data-value', item.value);
            option.setAttribute('title', item.text);
            option.textContent = item.text;
            if (this.value == item.value) {
                this.addClass(option, 'option-selected');
            }
            if (item.disabled) {
                this.addClass(option, 'option-disabled');
            }
            optionList.appendChild(option);
        }
        this.content.innerHTML = '';
        this.content.appendChild(optionList);
    };
    Select.prototype.update = function () {
        this.renderDrop();
        this.renderTarget();
    };
    Select.prototype.findOptionsByPrefix = function (text) {
        var options = this.findAll(this.drop, 'option');
        text = text.toLowerCase();
        return Array.prototype.filter.call(options, function (option) {
            return option.innerHTML.toLowerCase().substr(0, text.length) === text;
        });
    };
    Select.prototype.getChosen = function () {
        if (this.isOpen()) {
            return this.find(this.drop, 'option-highlight');
        }
        return this.find(this.drop, 'option-selected');
    };
    Select.prototype.selectOption = function (option) {
        if (this.isOpen()) {
            this.highlightOption(option);
            this.scrollDropContentToOption(option);
        }
        else {
            this.pickOption(option, false);
        }
    };
    Select.prototype.setDisabled = function (disabled) {
        this.options.disabled = disabled;
        if (disabled) {
            this.close();
            this.addClass(this.target, 'disabled');
            this.target.removeAttribute('tabindex');
        }
        else {
            this.target.setAttribute('tabindex', 0);
            this.removeClass(this.target, 'disabled');
        }
    };
    Select.prototype.resetSelection = function () {
        this.selectOption(this.find(this.drop, 'option'));
    };
    Select.prototype.highlightOption = function (option) {
        var highlighted = this.find(this.drop, 'option-highlight');
        if (highlighted) {
            this.removeClass(highlighted, 'option-highlight');
        }
        // Refuse to highlight disabled options
        if (this.hasClass(option, 'option-disabled')) {
            return;
        }
        this.addClass(option, 'option-highlight');
        this.trigger('highlight', { option: option });
    };
    Select.prototype.moveHighlight = function (directionKeyCode) {
        var _this = this;
        var highlighted = this.find(this.drop, 'option-highlight');
        if (!highlighted) {
            this.highlightOption(this.find(this.drop, 'option'));
            return;
        }
        var options = this.findAll(this.drop, 'option');
        var enabledOptions = Array.prototype.filter.call(options, function (option) { return !_this.hasClass(option, 'option-disabled'); });
        var currentIndex = enabledOptions.indexOf(highlighted);
        if (currentIndex < 0) {
            return;
        }
        var newIndex = currentIndex + (directionKeyCode === UP ? -1 : 1);
        var newHighlight = enabledOptions[newIndex];
        if (!newHighlight) {
            return;
        }
        this.highlightOption(newHighlight);
        this.scrollDropContentToOption(newHighlight);
    };
    Select.prototype.scrollDropContentToOption = function (option) {
        var _a = this.content, scrollHeight = _a.scrollHeight, clientHeight = _a.clientHeight, scrollTop = _a.scrollTop;
        if (scrollHeight > clientHeight) {
            var contentBounds = getBounds(this.content);
            var optionBounds = getBounds(option);
            this.content.scrollTop = optionBounds.top - (contentBounds.top - scrollTop);
        }
    };
    Select.prototype.selectHighlightedOption = function () {
        var highlightedOption = this.find(this.drop, 'option-highlight');
        if (highlightedOption) {
            this.pickOption(highlightedOption);
        }
        else {
            this.closeWithDelay();
        }
    };
    // For some reason, after selecting an option through UI input,
    // the original select code closes the dropdown with a delay.
    Select.prototype.closeWithDelay = function () {
        var _this = this;
        setTimeout(function () {
            _this.close();
            _this.target.focus();
        });
    };
    Select.prototype.pickOption = function (option, close) {
        if (close === void 0) { close = true; }
        if (this.hasClass(option, 'option-disabled')) {
            return;
        }
        this.change(option.getAttribute('data-value'));
        this.trigger('change', { value: this.value });
        if (close) {
            this.closeWithDelay();
        }
    };
    Select.prototype.change = function (value) {
        this.value = value;
        this.update();
    };
    Select.prototype.bindKeys = function () {
        var select = this;
        select.target.addEventListener('keypress', function (e) {
            if (e.charCode === 0) {
                return;
            }
            if (e.keyCode === SPACE) {
                e.preventDefault();
            }
            clearTimeout(select.searchTextTimeout);
            select.searchTextTimeout = setTimeout(function () {
                select.searchText = '';
            }, 500);
            select.searchText += String.fromCharCode(e.charCode);
            var options = select.findOptionsByPrefix(select.searchText);
            if (options.length === 1) {
                // We have an exact match, choose it
                select.selectOption(options[0]);
            }
            if (select.searchText.length > 1 && isRepeatedChar(select.searchText)) {
                // They hit the same char over and over, maybe they want to cycle through
                // the options that start with that char
                var repeatedOptions = select.findOptionsByPrefix(select.searchText[0]);
                if (repeatedOptions.length) {
                    var selected = repeatedOptions.indexOf(select.getChosen());
                    // Pick the next thing (if something with this prefix wasen't selected
                    // we'll end up with the first option)
                    selected += 1;
                    selected = selected % repeatedOptions.length;
                    select.selectOption(repeatedOptions[selected]);
                    return;
                }
            }
            if (options.length) {
                // We have multiple things that start with this prefix.  Based on the
                // behavior of native select, this is considered after the repeated case.
                select.selectOption(options[0]);
                return;
            }
            // No match at all, do nothing
        });
        select.target.addEventListener('keydown', function (e) {
            // We consider this independently of the keypress handler so we can intercept
            // keys that have built-in functions.
            // Since we can't use a relatedTarget on blur events (not supported in
            // Firefox, causes problems when contained in an element with tabindex),
            // we need to have a different way of figuring out when to close the
            // the dropdown.
            // This code checks after a tab key has been pressed whether the current
            // select is still the active element. If not, it closes the select.
            // activeElement is updated after the event fires, so we need to wrap
            // this in a setTimeout.
            if (e.keyCode === TAB) {
                setTimeout(function () {
                    if (document.activeElement !== select.target) {
                        select.close();
                    }
                });
            }
            if ([UP, DOWN, ESCAPE].indexOf(e.keyCode) >= 0) {
                e.preventDefault();
            }
            if (select.isOpen()) {
                switch (e.keyCode) {
                    case UP:
                    case DOWN:
                        select.moveHighlight(e.keyCode);
                        break;
                    case ENTER:
                    case SPACE:
                        select.selectHighlightedOption();
                        break;
                    case ESCAPE:
                        select.close();
                        select.target.focus();
                }
            }
            else {
                if ([UP, DOWN, SPACE].indexOf(e.keyCode) >= 0) {
                    select.open();
                }
            }
        });
    };
    return Select;
})(Tether.Utils.Evented);
Select.defaults = {
    alignToHighlighed: 'auto',
    className: 'select-theme-default',
    classPrefix: 'select'
};
module.exports = Select;

},{"tether":2}],2:[function(require,module,exports){
/*! tether v1.1.0 | MIT License | github.com/HubSpot/tether */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require, exports, module);
  } else {
    root.Tether = factory();
  }
}(this, function(require, exports, module) {

'use strict';

var domutils = window.AwsUi.__DomUtils;
var removeClass = domutils.removeClass;
var addClass = domutils.addClass;
var hasClass = domutils.hasClass;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var uniqueId = (function () {
  var id = 0;
  return function () {
    return ++id;
  };
})();

var zeroPosCache = {};
var getOrigin = function getOrigin(doc) {
  // getBoundingClientRect is unfortunately too accurate.  It introduces a pixel or two of
  // jitter as the user scrolls that messes with our ability to detect if two positions
  // are equivilant or not.  We place an element at the top left of the page that will
  // get the same jitter, so we can cancel the two out.
  var node = doc._tetherZeroElement;
  if (typeof node === 'undefined') {
    node = doc.createElement('div');
    node.setAttribute('data-tether-id', uniqueId());
    extend(node.style, {
      top: 0,
      left: 0,
      position: 'absolute'
    });

    doc.body.appendChild(node);

    doc._tetherZeroElement = node;
  }

  var id = node.getAttribute('data-tether-id');
  if (typeof zeroPosCache[id] === 'undefined') {
    zeroPosCache[id] = {};

    var rect = node.getBoundingClientRect();
    for (var k in rect) {
      // Can't use extend, as on IE9, elements don't resolve to be hasOwnProperty
      zeroPosCache[id][k] = rect[k];
    }

    // Clear the cache when this position call is done
    defer(function () {
      delete zeroPosCache[id];
    });
  }

  return zeroPosCache[id];
};

function getBounds(el) {
  var doc = undefined;
  if (el === document) {
    doc = document;
    el = document.documentElement;
  } else {
    doc = el.ownerDocument;
  }

  var docEl = doc.documentElement;

  var box = {};
  // The original object returned by getBoundingClientRect is immutable, so we clone it
  // We can't use extend because the properties are not considered part of the object by hasOwnProperty in IE9
  var rect = el.getBoundingClientRect();
  for (var k in rect) {
    box[k] = rect[k];
  }

  var origin = getOrigin(doc);

  box.top -= origin.top;
  box.left -= origin.left;

  if (typeof box.width === 'undefined') {
    box.width = document.body.scrollWidth - box.left - box.right;
  }
  if (typeof box.height === 'undefined') {
    box.height = document.body.scrollHeight - box.top - box.bottom;
  }

  box.top = box.top - docEl.clientTop;
  box.left = box.left - docEl.clientLeft;
  box.right = doc.body.clientWidth - box.width - box.left;
  box.bottom = doc.body.clientHeight - box.height - box.top;

  return box;
}

function extend() {
  var out = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var args = [];

  Array.prototype.push.apply(args, arguments);

  args.slice(1).forEach(function (obj) {
    if (obj) {
      for (var key in obj) {
        if (({}).hasOwnProperty.call(obj, key)) {
          out[key] = obj[key];
        }
      }
    }
  });

  return out;
}

function getClassName(el) {
  if (el.className instanceof SVGAnimatedString) {
    return el.className.baseVal;
  }
  return el.className;
}

function setClassName(el, className) {
  el.setAttribute('class', className);
}

var deferred = [];
var defer = function defer(fn) {
  deferred.push(fn);
};

var Evented = (function () {
  function Evented() {
    _classCallCheck(this, Evented);
  }

  _createClass(Evented, [{
    key: 'on',
    value: function on(event, handler, ctx) {
      var once = arguments.length <= 3 || arguments[3] === undefined ? false : arguments[3];

      if (typeof this.bindings === 'undefined') {
        this.bindings = {};
      }
      if (typeof this.bindings[event] === 'undefined') {
        this.bindings[event] = [];
      }
      this.bindings[event].push({ handler: handler, ctx: ctx, once: once });
    }
  }, {
    key: 'once',
    value: function once(event, handler, ctx) {
      this.on(event, handler, ctx, true);
    }
  }, {
    key: 'off',
    value: function off(event, handler) {
      if (typeof this.bindings !== 'undefined' && typeof this.bindings[event] !== 'undefined') {
        return;
      }

      if (typeof handler === 'undefined') {
        delete this.bindings[event];
      } else {
        var i = 0;
        while (i < this.bindings[event].length) {
          if (this.bindings[event][i].handler === handler) {
            this.bindings[event].splice(i, 1);
          } else {
            ++i;
          }
        }
      }
    }
  }, {
    key: 'trigger',
    value: function trigger(event) {
      if (typeof this.bindings !== 'undefined' && this.bindings[event]) {
        var i = 0;
        while (i < this.bindings[event].length) {
          var _bindings$event$i = this.bindings[event][i];
          var handler = _bindings$event$i.handler;
          var ctx = _bindings$event$i.ctx;
          var once = _bindings$event$i.once;

          var context = ctx;
          if (typeof context === 'undefined') {
            context = this;
          }

          for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            args[_key - 1] = arguments[_key];
          }

          handler.apply(context, args);

          if (once) {
            this.bindings[event].splice(i, 1);
          } else {
            ++i;
          }
        }
      }
    }
  }]);

  return Evented;
})();

var Tether = {}
Tether.Utils = {
  getBounds: getBounds,
  extend: extend,
  addClass: addClass,
  removeClass: removeClass,
  hasClass: hasClass,
  Evented: Evented,
};

return Tether;

}));
},{}],3:[function(require,module,exports){
var Select = require('select');
function updateSelect() {
    this.__select.items = this.items || [];
    this.__select.update();
}
function updatePlaceholder() {
    this.__select.options.placeholder = this.placeholder;
    this.__select.update();
}
function updateValue() {
    this.__select.change(this.value);
}
function updateDisabled() {
    this.__select.setDisabled(this.disabled);
}
// Selector is used to allow a single choice from a set of items that are variations of a single type of thing.
//
// ***Note***: `awsui-select` is only usable in Angular right now.
AwsUi.__addComponent('awsui-select', {
    releaseStatus: 'preview',
    callbacks: {
        initialized: function () {
            var _this = this;
            this.__select = new Select({
                className: '',
                classPrefix: 'awsui-select'
            }, []);
            this.__select.on('change', function (item) {
                _this.value = item.value;
                _this.__fireEvent('change');
            });
        },
        attached: function () {
            this.__select.attach();
        },
        detached: function () {
            this.__select.detach();
        }
    },
    properties: {
        // Array of objects, each having the following properties:
        //
        // * `value` [string]: the value of the select when this item is selected
        // * `text` [string]: description shown in the select to describe this item
        // * `disabled` [boolean]: Whether this item is disabled
        items: {
            type: 'array',
            itemType: 'Item',
            onChange: updateSelect
        },
        // Hint text when no value has been selected
        placeholder: {
            type: 'string',
            onChange: updatePlaceholder
        },
        // Value of the currently selected item
        value: {
            type: 'string',
            onChange: updateValue,
        },
        // Whether the whole select should be disabled
        disabled: {
            type: 'boolean',
            onChange: updateDisabled,
        }
    },
    events: {
        // Fired whenever the user selects an item
        change: {
            bubbles: true,
            cancelable: false
        }
    },
    render: function (m, h) {
        var _this = this;
        return m("span", {
            config: function (el, isInitialized) {
                if (isInitialized) {
                    return;
                }
                el.appendChild(_this.__select.target);
                el.appendChild(_this.__select.drop);
            }
        });
    },
    wrapperSupport: {
        ngModel: {
            value: 'value',
            event: 'change'
        }
    }
});

},{"select":1}]},{},[3]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Tabs allow customers to easily switch between different sections of information
//
// Note: for this component to work properly, you need to explicity set the `activaTabId`
// property when creating the component.
AwsUi.__addComponent('awsui-tabs', {
    releaseStatus: 'preview',
    properties: {
        // Array of objects, each having the following properties:
        //
        // * `id` [string]: the tab id, this value will be set to activeTabId when the tab is selected
        // * `label` [string]: tab label shown in the UI
        // * `disabled` [boolean]: Whether this item is disabled
        tabs: {
            type: 'array',
            itemType: 'Tab'
        },
        // ID of the currently active tab
        activeTabId: {
            type: 'string',
        },
        // Determines the style of the tab bar. Use the borderless variant in
        // panel layouts and in containers with borders.
        variant: {
            type: 'string',
            valid: ['borderless', 'bordered'],
            defaultValue: 'bordered',
            nullable: false
        }
    },
    regions: {
        // Contents for the tabs
        content: { isDefault: true }
    },
    events: {
        // Fired whenever the user selects a different tab
        change: {
            bubbles: true,
            cancelable: false
        }
    },
    render: function (m, h) {
        var _this = this;
        var renderTab = function (tab) {
            var cb = new h.ClassBuilder(_this);
            cb.addClass('awsui-tabs-tab-link');
            cb.addClass('awsui-tabs-tab-active', _this.activeTabId === tab.id);
            cb.addClass('awsui-tabs-tab-disabled', tab.disabled);
            var linkAttributes = {
                className: cb.toClassName(),
                onclick: function (e) {
                    e.preventDefault();
                    if (tab.disabled) {
                        return;
                    }
                    if (tab.id === _this.activeTabId) {
                        return;
                    }
                    _this.activeTabId = tab.id;
                    _this.__fireEvent('change');
                }
            };
            if (tab.disabled) {
                linkAttributes['aria-disabled'] = true;
            }
            else {
                // Only add href attribute if tab isn't disabled.
                // This allows focus only on enabled tabs
                linkAttributes['href'] = '#';
            }
            var link = m('a', linkAttributes, tab.label);
            return m('li', { className: 'awsui-tabs-tab' }, link);
        };
        var header = m('ul', { className: 'awsui-tabs-container' }, (this.tabs || []).map(renderTab));
        var content = m('div', { className: 'awsui-tabs-panel' }, h.region('content', 'div', { className: 'awsui-tabs-content-container' }));
        var cb = new h.ClassBuilder(this);
        cb.addPropertyValueClass('variant');
        return m('div', { className: cb.toClassName() }, header, content);
    },
    wrapperSupport: {
        ngModel: {
            value: 'activeTabId',
            event: 'change'
        }
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
var getNativeElement = function (component) { return component.node.firstChild; };
var lastGeneratedId = 0;
function nextGeneratedId() {
    return 'awsui-textarea-' + lastGeneratedId++;
}
AwsUi.__addComponent('awsui-textarea', {
    releaseStatus: 'stable',
    callbacks: {
        initialized: function () {
            if (!this.controlId) {
                this.controlId = nextGeneratedId();
            }
        }
    },
    events: {
        // Fires when input focus is removed from the UI control.
        blur: {
            bubbles: true,
            cancelable: false
        },
        // Fires when input focus is removed from the UI control and the value of
        // the control has changed.
        change: {
            bubbles: true,
            cancelable: true
        },
        // Fires when input focus is set onto the UI control.
        focus: {
            bubbles: true,
            cancelable: false
        },
        // Fires when the value of the control has changed, even while focus
        // remains on the UI control.
        input: {
            bubbles: true,
            cancelable: true
        },
        // Fires when a key is pressed down in the UI control.
        keydown: {
            bubbles: true,
            cancelable: true,
            detailTypeName: 'KeyEvent'
        },
        // Fires when a key is released in the UI control.
        keyup: {
            bubbles: true,
            cancelable: true,
            detailTypeName: 'KeyEvent'
        }
    },
    render: function (m, h) {
        var _this = this;
        var component = this;
        var hasProperInputEventSupport = h.browserCapabilities.inputEvent;
        var props = ['placeholder', 'disabled', 'rows'];
        var inputProperties = h.copyDefined(component, props);
        var valueChanged = function (ev) { return ev.target.value !== _this.value; };
        var valueHandler = m.withAttr('value', function (value) { return _this.value = value; });
        var inputHandler = h.newEventHandler('input', valueHandler);
        // The 'value' attribute is handled separately for two reasons:
        // 1) It causes a rendering bug with Mitrhil when a character is entered
        //    in the input element. See the tests for more info.
        // 2) If the value is updated by the user, in IE the caret is reset to the end
        //    of the textarea, even if the update was in the middle of the text.
        // We work around these issues by having a config callback that only
        // changes the value if it has been updated.
        inputProperties.config = function (element) {
            if (element.value !== component.value) {
                element.value = component.value || '';
            }
        };
        if (component.controlId) {
            inputProperties.id = component.controlId;
        }
        inputProperties.className = 'awsui-textarea';
        inputProperties.onblur = h.newEventHandler('blur');
        inputProperties.onfocus = h.newEventHandler('focus');
        var keyDownHandler = function (e) { return component.__fireEvent('keydown', { keyCode: e.keyCode, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey }); };
        inputProperties.onkeydown = keyDownHandler;
        inputProperties.onkeyup = function (e) { return component.__fireEvent('keyup', { keyCode: e.keyCode, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey }); };
        // IE doesn't properly implement the `input` event, so we are forced to
        // mimic its behaviour through a bunch of other events.
        if (!hasProperInputEventSupport) {
            // Most of the events we use trigger before the content of the textfield
            // was updated.
            var valueUpdater = function (ev) {
                if (!valueChanged(ev)) {
                    return false;
                }
                _this.value = ev.target.value;
            };
            // `keydown`, `cut`, `paste`, and `change` will all trigger `awsui:input`
            var deferredHandler = h.newDeferredEventHandler('input', valueUpdater);
            inputProperties.onkeydown = function (e) {
                keyDownHandler(e);
                deferredHandler(e);
            };
            inputProperties.oncut = deferredHandler;
            inputProperties.onpaste = deferredHandler;
            inputProperties.onchange = (function (handler) {
                return function (ev) {
                    if (handler(ev) !== false) {
                        component.__fireEvent('change');
                    }
                };
            })(h.newEventHandler('input', valueUpdater));
        }
        else {
            inputProperties.oninput = inputHandler;
            inputProperties.onchange = h.newEventHandler('change', valueHandler);
        }
        return m('textarea', inputProperties);
    },
    functions: {
        // Sets input focus onto the UI control.
        focus: function () {
            getNativeElement(this).focus();
        },
        // Removes input focus from the UI control.
        blur: function () {
            getNativeElement(this).blur();
        }
    },
    properties: {
        // The text entered into the form element.
        value: {
            type: 'string'
        },
        // When set to a non-empty string, the text will be rendered as hint text.
        placeholder: {
            type: 'string'
        },
        // Specifies that the input should be disabled, preventing the user from
        // modifying the value and excluding the value from being included with a
        // form submit.
        disabled: {
            type: 'boolean'
        },
        // The id of the internal input. Useful for relating a label element's
        // "for" attribute to this control. Defaults to a generated id.
        controlId: {
            type: 'string',
            announceValue: true
        },
        // The number of lines of text to set the height to.
        rows: {
            type: 'integer',
            defaultValue: 3
        }
    },
    wrapperSupport: {
        ngModel: {
            value: 'value',
            event: 'input'
        }
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
var getNativeElement = function (component) { return component.node.querySelector('input'); };
var lastGeneratedId = 0;
function nextGeneratedId() {
    return 'awsui-textfield-' + lastGeneratedId++;
}
AwsUi.__addComponent('awsui-textfield', {
    releaseStatus: 'stable',
    callbacks: {
        initialized: function () {
            if (!this.controlId) {
                this.controlId = nextGeneratedId();
            }
        }
    },
    events: {
        // Fires when input focus is removed from the UI control.
        blur: {
            bubbles: true,
            cancelable: false
        },
        // Fires when input focus is removed from the UI control and the value of
        // the control has changed.
        change: {
            bubbles: true,
            cancelable: true
        },
        // Fires when input focus is set onto the UI control.
        focus: {
            bubbles: true,
            cancelable: false
        },
        // Fires when the value of the control has changed, even while focus
        // remains on the UI control.
        input: {
            bubbles: true,
            cancelable: true
        },
        // Fires when a key is pressed down in the UI control.
        keydown: {
            bubbles: true,
            cancelable: true,
            detailTypeName: 'KeyEvent'
        },
        // Fires when a key is released in the UI control.
        keyup: {
            bubbles: true,
            cancelable: true,
            detailTypeName: 'KeyEvent'
        }
    },
    render: function (m, h) {
        var _this = this;
        var component = this;
        var hasProperInputEventSupport = h.browserCapabilities.inputEvent;
        var props = ['placeholder', 'disabled', 'type'];
        var inputProperties = h.copyDefined(component, props);
        var valueChanged = function (ev) { return ev.target.value !== _this.value; };
        var valueHandler = m.withAttr('value', function (value) { return _this.value = value; });
        var inputHandler = h.newEventHandler('input', valueHandler);
        function icon() {
            if (component.type === 'search') {
                return m('span', {
                    className: 'awsui-textfield-icon awsui-icon search awsui-icon-subtle'
                });
            }
        }
        // The 'value' attribute is not included in the `copyDefined` call because
        // this causes a rendering bug with Mitrhil when a character is entered in
        // the input element. See the tests for more info.
        inputProperties.value = this.value || '';
        inputProperties.autocomplete = this.autocomplete ? 'on' : 'off';
        if (component.controlId) {
            inputProperties.id = component.controlId;
        }
        var cb = new h.ClassBuilder(this);
        cb.addClass('awsui-textfield');
        cb.addPropertyValueClass('type');
        inputProperties.className = cb.toClassName();
        inputProperties.onblur = h.newEventHandler('blur');
        inputProperties.onfocus = h.newEventHandler('focus');
        var keyDownHandler = function (e) { return component.__fireEvent('keydown', { keyCode: e.keyCode, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey }); };
        inputProperties.onkeydown = keyDownHandler;
        inputProperties.onkeyup = function (e) { return component.__fireEvent('keyup', { keyCode: e.keyCode, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey }); };
        // IE doesn't properly implement the `input` event, so we are forced to
        // mimic its behaviour through a bunch of other events.
        if (!hasProperInputEventSupport) {
            // Most of the events we use trigger before the content of the textfield
            // was updated.
            var valueUpdater = function (ev) {
                if (!valueChanged(ev)) {
                    return false;
                }
                _this.value = ev.target.value;
            };
            // `keydown`, `cut`, `paste`, and `change` will all trigger `awsui:input`
            var deferredHandler = h.newDeferredEventHandler('input', valueUpdater);
            inputProperties.onkeydown = function (e) {
                keyDownHandler(e);
                deferredHandler(e);
            };
            inputProperties.oncut = deferredHandler;
            inputProperties.onpaste = deferredHandler;
            inputProperties.onchange = (function (handler) {
                return function (ev) {
                    if (handler(ev) !== false) {
                        component.__fireEvent('change');
                    }
                };
            })(h.newEventHandler('input', valueUpdater));
        }
        else {
            inputProperties.oninput = inputHandler;
            inputProperties.onchange = h.newEventHandler('change', valueHandler);
        }
        return [icon(), m('input', inputProperties)];
    },
    functions: {
        // Sets input focus onto the UI control.
        focus: function () {
            getNativeElement(this).focus();
        },
        // Removes input focus from the UI control.
        blur: function () {
            getNativeElement(this).blur();
        }
    },
    properties: {
        // The text entered into the form element.
        value: {
            type: 'string'
        },
        // The type of control to render. The default type is text.
        type: {
            type: 'string',
            defaultValue: 'text',
            valid: [
                'text',
                'password',
                'search'
            ]
        },
        // When set to a non-empty string, the text will be rendered as hint text.
        placeholder: {
            type: 'string'
        },
        // Specifies that the input should be disabled, preventing the user from
        // modifying the value and excluding the value from being included with a
        // form submit.
        disabled: {
            type: 'boolean'
        },
        // Specifies whether browsers should enable autocomplete for this input.
        // In some cases it may be appropriate to disable autocomplete, e.g. for
        // security-sensitive fields.
        autocomplete: {
            type: 'boolean',
            defaultValue: true
        },
        // The id of the internal input. Useful for relating a label element's
        // "for" attribute to this control. Defaults to a generated id.
        controlId: {
            type: 'string',
            announceValue: true
        }
    },
    wrapperSupport: {
        ngModel: {
            value: 'value',
            event: 'input'
        }
    }
});

},{}]},{},[1]);
;
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
// Tooltips are contextual help displayed to the user about nearby elements.
// Make sure to set a `position`, otherwise the component won't render.
AwsUi.__addComponent('awsui-tooltip', {
    releaseStatus: 'experimental',
    properties: {
        // The content of the tooltip. No HTML is allowed.
        text: {
            type: 'string',
        },
        // Where, relative to the trigger region, should the tooltip be
        // displayed. Must be explicitly defined, or the component won't render.
        // Keep in mind that it won't throw any error, it will render your
        // content without the tooltip.
        position: {
            type: 'string',
            nullable: true,
            valid: [
                'top',
                'right',
                'bottom',
                'left',
            ],
        },
        // If set, this property will make the tooltip contents wrap in multiple
        // lines. Otherwise (if set to 'auto') it will just render in one line,
        // but the width of the tooltip will adjust to its contents.
        size: {
            type: 'string',
            defaultValue: 'auto',
            nullable: false,
            valid: [
                'auto',
                'small',
                'medium',
                'large',
            ],
        },
    },
    regions: {
        // The elements that will trigger the tooltip when hovered.
        trigger: {
            isDefault: true,
        },
    },
    render: function (m, h) {
        var triggerAttributes = {
            'aria-label': this.text,
        };
        if (!this.position || !this.text) {
            return h.region('trigger', 'span', triggerAttributes);
        }
        var cb = new h.ClassBuilder(this);
        cb.addClass('awsui-tooltip')
            .addClass('awsui-tooltip-rounded')
            .addClass('awsui-tooltip-no-slide')
            .addClass('awsui-tooltip-wrap', this.size !== 'auto')
            .addClass("awsui-tooltip-" + this.position)
            .addPropertyValueClass('size');
        triggerAttributes['data-awsui-tooltip-text'] = this.text;
        triggerAttributes['className'] = cb.toClassName();
        return h.region('trigger', 'span', triggerAttributes);
    },
});

},{}]},{},[1]);
