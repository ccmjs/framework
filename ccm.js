"use strict";

/**
 * @overview
 * Creates the global namespace [window.ccm]{@link ccm}.
 * @author André Kless <andre.kless@web.de> (https://github.com/akless) 2014-2023
 * @license The MIT License (MIT)
 * @version 28.0.0
 * @changes
 * Version 28.0.0
 * - ccm.load: resource data is no longer cloned
 * - ccm.load: removed timeout for loading resources
 * - ccm.load: JSON is loaded either via fetch API or JSONP (no longer via XMLHttpRequest)
 * - ccm.load: used HTTP method must be in upper case
 * - ccm.load: simplified error messages
 * - ccm.helper.html: dynamic parameters must be passed via an object
 */
(() => {
  /**
   * Encapsulates everything related to _ccmjs_.
   * See [this wiki]{@link https://github.com/ccmjs/framework/wiki/} to learn everything about this web technology.
   * @global
   * @namespace
   */
  const ccm = {
    /**
     * @description Returns the _ccmjs_ framework version.
     * @returns {ccm.types.version_nr}
     */
    version: () => "28.0.0",

    /**
     * @summary Asynchronous Loading of Resources
     * @description See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Loading-of-Resources} to learn everything about this method. There are also examples how to use it.
     * @param {...(string|ccm.types.resource_obj)} resources - Resources to load. Either the URL or a [resource object]{@link ccm.types.resource_obj} can be passed for a resource.
     * @returns {Promise<*>}
     */
    load: async (...resources) => {
      let results = [];
      let counter = 1;
      let failed = false;
      return new Promise((resolve, reject) => {
        resources.forEach((resource, i) => {
          counter++;
          if (Array.isArray(resource)) {
            results[i] = [];
            serial(null);
            return;
          }
          if (typeof resource === "string") resource = { url: resource };
          if (!resource.context) resource.context = document.head;
          if (ccm.helper.isInstance(resource.context))
            resource.context = resource.context.element.parentNode;
          getOperation()();

          function serial(result) {
            if (result !== null) results[i].push(result);
            if (!resource.length) return check();
            let next = resource.shift();
            if (!Array.isArray(next)) next = [next];
            ccm.load.apply(null, next).then(serial).catch(serial);
          }

          function getOperation() {
            switch (resource.type) {
              case "html":
                return loadHTML;
              case "css":
                return loadCSS;
              case "image":
                return loadImage;
              case "js":
                return loadJS;
              case "module":
                return loadModule;
              case "json":
                return loadJSON;
              case "xml":
                return loadXML;
            }
            const suffix = resource.url
              .split("?")
              .shift()
              .split("#")
              .shift()
              .split(".")
              .pop()
              .toLowerCase();
            switch (suffix) {
              case "html":
                return loadHTML;
              case "css":
                return loadCSS;
              case "jpg":
              case "jpeg":
              case "gif":
              case "png":
              case "svg":
              case "bmp":
                return loadImage;
              case "js":
                return loadJS;
              case "mjs":
                return loadModule;
              case "xml":
                return loadXML;
              default:
                return loadJSON;
            }
          }

          function loadHTML() {
            resource.type = "html";
            loadJSON();
          }

          function loadCSS() {
            let element = {
              tag: "link",
              rel: "stylesheet",
              type: "text/css",
              href: resource.url,
            };
            if (resource.attr) element = Object.assign(element, resource.attr);
            element = ccm.helper.html(element);
            element.onload = () => success(resource.url);
            element.onerror = error;
            resource.context.appendChild(element);
          }

          function loadImage() {
            const image = new Image();
            image.src = resource.url;
            image.onload = () => success(resource.url);
            image.onerror = error;
          }

          function loadJS() {
            const filename = resource.url
              .split("/")
              .pop()
              .split("?")
              .shift()
              .replace(".min.", ".");
            window.ccm.files[filename] = null;
            window.ccm.files["#" + filename] = window.ccm.files["#" + filename]
              ? window.ccm.files["#" + filename] + 1
              : 1;
            let element = { tag: "script", src: resource.url, async: true };
            if (resource.attr) element = Object.assign(element, resource.attr);
            element = ccm.helper.html(element);
            element.onload = () => {
              const data = window.ccm.files[filename];
              if (!--window.ccm.files["#" + filename]) {
                delete window.ccm.files[filename];
                delete window.ccm.files["#" + filename];
              }
              element.parentNode.removeChild(element);
              success(data);
            };
            element.onerror = () => {
              element.parentNode.removeChild(element);
              error();
            };
            resource.context.appendChild(element);
          }

          function loadModule() {
            let [url, ...keys] = resource.url.split("#");
            if (url.startsWith("./"))
              url = url.replace(
                "./",
                location.href.substring(0, location.href.lastIndexOf("/") + 1)
              );
            import(url).then((result) => {
              if (keys.length === 1)
                result = ccm.helper.deepValue(result, keys[0]);
              if (keys.length > 1) {
                const obj = {};
                keys.forEach((key) => (obj[key] = result[key]));
                result = obj;
              }
              success(result);
            });
          }

          function loadJSON() {
            (resource.method === "JSONP" ? jsonp : fetchAPI)();

            function jsonp() {
              const callback = "callback" + ccm.helper.generateKey();
              if (!resource.params) resource.params = {};
              resource.params.callback = "window.ccm.callbacks." + callback;
              let element = {
                tag: "script",
                src: buildURL(resource.url, resource.params),
              };
              if (resource.attr)
                element = Object.assign(element, resource.attr);
              element = ccm.helper.html(element);
              element.onerror = () => {
                element.parentNode.removeChild(element);
                error();
              };
              window.ccm.callbacks[callback] = (data) => {
                element.parentNode.removeChild(element);
                delete window.ccm.callbacks[callback];
                success(data);
              };
              resource.context.appendChild(script);
            }

            function fetchAPI() {
              if (resource.params)
                resource.method === "GET"
                  ? (resource.url = buildURL(resource.url, resource.params))
                  : (resource.body = JSON.stringify(resource.params));
              fetch(resource.url, { ...resource })
                .then((response) => response.text())
                .then(success)
                .catch(error);
            }

            function buildURL(url, data) {
              if (ccm.helper.isObject(data.json))
                data.json = JSON.stringify(data.json);
              return data ? url + "?" + params(data).slice(0, -1) : url;
              function params(obj, prefix) {
                let result = "";
                for (const i in obj) {
                  const key = prefix
                    ? prefix + "[" + encodeURIComponent(i) + "]"
                    : encodeURIComponent(i);
                  if (typeof obj[i] === "object") result += params(obj[i], key);
                  else result += key + "=" + encodeURIComponent(obj[i]) + "&";
                }
                return result;
              }
            }
          }

          function loadXML() {
            resource.type = "xml";
            loadJSON();
          }

          function success(data) {
            if (data === undefined) return check();
            try {
              if (typeof data !== "object") data = JSON.parse(data);
            } catch (e) {}
            if (resource.type === "html") {
              const regex =
                /<ccm-template key="(\w*?)">([^]*?)<\/ccm-template>/g;
              const result = {};
              let array;
              while ((array = regex.exec(data))) result[array[1]] = array[2];
              if (Object.keys(result).length) data = result;
            }
            if (resource.type === "xml")
              data = new window.DOMParser().parseFromString(data, "text/xml");
            results[i] = data;
            check();
          }

          function error() {
            failed = true;
            results[i] = Error(`loading of ${resource.url} failed`);
            check();
          }
        });
        check();

        function check() {
          if (--counter) return;
          if (results.length <= 1) results = results[0];
          (failed ? reject : resolve)(results);
        }
      });
    },

    /**
     * @description
     * Contains framework-relevant helper functions.
     * These are also useful for component developers.
     * @namespace
     */
    helper: {
      /**
       * @summary Returns or modifies a value contained in a nested data structure.
       * @param {Object} obj - Nested data structure
       * @param {string} path - Path to the property whose value is to be returned or changed.
       * @param {any} [value] - New value to be set. If not specified, the value of the property is returned.
       * @returns {any} - Existing or updated value of the property.
       * @example // Get value
       * const obj = { foo: { bar: [{ abc: "xyz" }] } };
       * const result = ccm.helper.deepValue(obj, "foo.bar.0.abc");
       * console.log(result); // => 'xyz'
       * @example // Set value
       * var obj = {};
       * var result = ccm.helper.deepValue(obj, "foo.bar", "abc");
       * console.log(obj);    // => { foo: { bar: "abc" } }
       * console.log(result); // => "abc"
       */
      deepValue: function (obj, path, value) {
        return recursive(obj, path.split("."), value);
        function recursive(obj, key, value) {
          if (!obj) return;
          const next = key.shift();
          if (key.length === 0)
            return value !== undefined ? (obj[next] = value) : obj[next];
          if (!obj[next] && value !== undefined)
            obj[next] = isNaN(key[0]) ? {} : [];
          return recursive(obj[next], key, value);
        }
      },

      /**
       * @summary Replaces placeholders in data with values (e.g. in a string or object).
       * @param {any} data
       * @param {Object} values
       * @returns {any} - Deep copy of data with replaced placeholders.
       * @example // Replace placeholders in a string
       * const string = "Hello, %name%!";
       * const values = { name: "World" };
       * const result = ccm.helper.format(string, values);
       * console.log(result); // => "Hello, World!"
       * @example // Replace placeholders in an object
       * const object = { hello: "Hello, %name%!" };
       * const values = { name: "World" };
       * const result = ccm.helper.format(object, values);
       * console.log(result); // => { hello: "Hello, World!" }
       */
      format: (data, values) => {
        const functions = {};

        // convert data to string (if not already)
        data = JSON.stringify(data);

        // replace placeholders with values (functions are stored in a separate object)
        for (const key in values)
          if (typeof values[key] !== "function")
            data = data.replace(
              new RegExp(`%${key}%`, "g"),
              values[key].replace(/"/g, '\\"')
            );
          else functions[`%${key}%`] = values[key];

        // convert the data back to its original format and return it (replace placeholders for functions)
        return JSON.parse(data, (key, val) =>
          Object.keys(functions).includes(val) ? functions[val] : val
        );
      },

      /**
       * @summary Converts HTML given as a string or JSON into HTML elements.
       * @description Placeholders marked with <code>%%</code> in the HTML are replaced with <code>values</code>.
       * @param {string|ccm.types.html_data} html - HTML as string or JSON
       * @param {Object} values - Placeholders contained in the HTML are replaced by these values.
       * @param {Object} settings
       * @param {boolean} [settings.ignore_apps] - No evaluation of \<ccm-app> tags.
       * @param {string} [settings.namespace_uri] - Namespace URI for HTML elements.
       * @returns {Element|Text}
       * @example // Converting an HTML string
       * const str = '<p>Hello, <b>%name%</b>! <button onclick="%click%"></button></p>';
       * const values = {
       *   name: "World",
       *   click: () => console.log("click!"),
       * };
       * const elem = ccm.helper.html(str, values);
       * document.body.appendChild(elem);
       * @example // Converting HTML data
       * const json = {
       *   tag: "p",
       *   inner: [
       *     "Hello, ",
       *     {
       *       tag: "b",
       *       inner: "%name%",
       *     },
       *     "! ",
       *     {
       *       tag: "button",
       *       onclick: "%click%",
       *     },
       *   ],
       * };
       * const values = {
       *   name: "World",
       *   click: () => console.log("click!"),
       * };
       * const elem = window.ccm.helper.html(json, values);
       * document.body.appendChild(elem);
       */
      html: (html, values, settings = {}) => {
        // convert HTML to JSON
        html = ccm.helper.html2json(html);

        // HTML is a primitive value (e.g. a string)? => convert it to a text node
        if (!ccm.helper.isObject(html)) return document.createTextNode(html);

        // replace placeholders in the HTML with values, if given
        if (values) html = ccm.helper.format(html, values);

        // is a svg element? => set namespace URI
        if (html.tag === "svg")
          settings.namespace_uri = "http://www.w3.org/2000/svg";

        // create HTML element
        const element = settings.namespace_uri
          ? document.createElementNS(settings.namespace_uri, html.tag || "div")
          : document.createElement(html.tag || "div");

        // set attributes, inner HTML and event listeners
        delete html.tag;
        for (const key in html) {
          const value = html[key];
          switch (key) {
            case "async":
            case "autofocus":
            case "defer":
            case "disabled":
            case "ismap":
            case "multiple":
            case "required":
            case "selected":
              if (value) element[key] = true;
              break;
            case "checked":
              if (value) {
                element[key] = true;
                element.setAttribute(key, "");
              }
              break;
            case "readonly":
              if (value) element.readOnly = true;
              break;
            case "inner":
              if (
                typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean"
              )
                element.innerHTML = value;
              else {
                const children = Array.isArray(value) ? value : [value];
                children.forEach((child) =>
                  element.appendChild(
                    // recursive call for each child
                    ccm.helper.html(child, undefined, settings)
                  )
                );
              }
              break;
            default:
              if (key.indexOf("on") === 0 && typeof value === "function")
                element.addEventListener(key.substring(2), value);
              else element.setAttribute(key, value);
          }
        }
        if (element.tagName.startsWith("CCM-") && !settings.no_evaluation)
          ccm.start(
            element.tagName === "CCM-APP"
              ? element.getAttribute("component")
              : element.tagName.substring(4).toLowerCase(),
            ccm.helper.generateConfig(element),
            element
          );
        return element;
      },

      /**
       * @summary Converts HTML to JSON
       * @description Comments contained in the HTML will be removed.
       * @param {string|Element|DocumentFragment} html - HTML as string, Element or DocumentFragment
       * @returns {ccm.types.html_data} JSON representation of the HTML
       * @example // Converting an HTML string
       * const html = '<p>Hello, <b>World</b>!';
       * const json = ccm.helper.html2json(html);
       * console.log(json);
       * //{
       * //  tag: "p",
       * //  inner: [
       * //    "Hello, ",
       * //    {
       * //      tag: "b",
       * //      inner: "World",
       * //    },
       * //    "!",
       * //  ],
       * //};
       */
      html2json: (html) => {
        const json = { inner: [] };
        if (typeof html === "string") {
          const template = document.createElement("template");
          template.innerHTML = html;
          html = template.content;
        }
        if (html instanceof DocumentFragment) {
          if (!html.children.length) return html.textContent;
          [...html.childNodes].forEach((child) => {
            if (child.nodeValue) {
              if (!child.nodeValue || child.nodeType === Node.COMMENT_NODE)
                child.parentNode.removeChild(child);
            }
          });
          if (html.childNodes.length === 1) html = html.firstChild;
        }
        if (!ccm.helper.isElement(html)) return html;
        if (html.tagName) json.tag = html.tagName.toLowerCase();
        if (json.tag === "div") delete json.tag;
        if (html.attributes)
          [...html.attributes].forEach(
            (attr) =>
              (json[attr.name] =
                attr.value === "" && attr.name !== "value" ? true : attr.value)
          );
        [...html.childNodes].forEach((child) => {
          if (child.nodeType === Node.COMMENT_NODE)
            return child.parentNode.removeChild(child);
          if (child.nodeValue && !child.parentElement?.closest("pre"))
            child.nodeValue = child.nodeValue.replace(/\s+/g, " ");
          if (ccm.helper.isElement(child) || child.nodeValue)
            json.inner.push(
              ccm.helper.isElement(child)
                ? ccm.helper.html2json(child)
                : child.textContent
            );
        });
        if (!json.inner.length) delete json.inner;
        else if (json.inner.length === 1) json.inner = json.inner[0];
        return json;
      },

      /**
       * @summary Checks whether a value is a _ccmjs_ component object.
       * @param {any} value - Value to be checked.
       * @returns {boolean}
       * @example
       * const value = await ccm.component({
       *   name: "component",
       *   ccm: "./libs/ccm/ccm.js",
       *   config: {},
       *   Instance: function () {
       *     this.start = async () => {};
       *   },
       * });
       * ccm.helper.isComponent(value); // => true
       */
      isComponent: (value) => value?.Instance && value.ccm && true,

      /**
       * @summary Checks whether a value is a _ccmjs_ datastore object.
       * @param {any} value - Value to be checked.
       * @returns {boolean}
       * @example
       * const value = await ccm.store();
       * ccm.helper.isDatastore(value); // => true
       */
      isDatastore: (value) => value?.get && value.local && value.source && true,

      /**
       * @summary Checks whether a value is a DOM element or a DocumentFragment.
       * @param {any} value - Value to be checked.
       * @returns {boolean}
       * @example
       * const value = document.body;
       * ccm.helper.isElement(value); // => true
       * @example
       * const value = document.createElement("div");
       * ccm.helper.isElement(value); // => true
       * @example
       * const value = document.createDocumentFragment();
       * ccm.helper.isElement(value); // => true
       */
      isElement: (value) => {
        return value instanceof Element || value instanceof DocumentFragment;
      },

      /**
       * @summary Checks whether a value is a _ccmjs_ framework object.
       * @param {any} value - Value to be checked.
       * @returns {boolean}
       * @example
       * const value = window.ccm;
       * ccm.helper.isFramework(value); // => true
       */
      isFramework: (value) => value?.components && value.version && true,

      /**
       * @summary Checks whether a value is a _ccmjs_ component instance.
       * @param {any} value - Value to be checked.
       * @returns {boolean}
       * @example
       * const value = await ccm.instance({
       *   name: "component",
       *   ccm: "./libs/ccm/ccm.js",
       *   config: {},
       *   Instance: function () {
       *     this.start = async () => {};
       *   },
       * });
       * ccm.helper.isInstance(value); // => true
       */
      isInstance: (value) => ccm.helper.isComponent(value?.component),

      /**
       * @summary Checks whether a value is a DOM Node.
       * @param {any} value - Value to be checked.
       * @returns {boolean}
       * @example
       * const value = document.body;
       * ccm.helper.isNode(value); // => true
       * @example
       * const value = document.createElement("div");
       * ccm.helper.isNode(value); // => true
       * @example
       * const value = document.createDocumentFragment();
       * ccm.helper.isNode(value); // => true
       * @example
       * const value = document.createTextNode("Hello, World!");
       * ccm.helper.isNode(value); // => true
       * @example
       * const value = document.createAttribute("disabled");
       * ccm.helper.isNode(value); // => true
       * @example
       * const value = document.createComment("Hello, World!");
       * ccm.helper.isNode(value); // => true
       */
      isNode: (value) => value instanceof Node,

      /**
       * @summary Checks whether a value is an object.
       * @description Also returns <code>false</code> for <code>null</code> and array.
       * @param {any} value - Value to be checked.
       * @returns {boolean}
       * @example
       * const value = null;
       * ccm.helper.isObject(value); // => false
       * @example
       * const value = [];
       * ccm.helper.isObject(value); // => false
       * @example
       * const value = {};
       * ccm.helper.isObject(value); // => true
       */
      isObject: (value) => {
        return value && typeof value === "object" && !Array.isArray(value);
      },

      /**
       * @summary Checks whether a value is a plain object.
       * @param {any} value - Value to be checked.
       * @returns {boolean}
       * @example
       * const value = {};
       * ccm.helper.isPlainObject(value); // => true
       * @example
       * const value = function () {};
       * ccm.helper.isPlainObject(value); // => false
       */
      isPlainObject: (value) => {
        return Object.getPrototypeOf(value) === Object.prototype;
      },
    },
  };

  // Is this the first ccmjs framework version loaded in this webpage? => Initialize global namespace.
  if (!window.ccm)
    window.ccm = {
      /**
       * @description
       * This namespace is only used internally.
       * JSONP callbacks for loading data via {@link ccm.load} are temporarily stored here (is always emptied directly).
       * @namespace ccm.callbacks
       * @type {Object.<string,function>}
       */
      callbacks: {},

      /**
       * @description
       * This namespace is only used internally.
       * Result data of loaded JavaScript files via {@link ccm.load} are temporarily stored here (is always emptied directly).
       * @namespace ccm.files
       * @type {Object}
       */
      files: {},
    };

  // Is this the first time this specific ccmjs framework version is loaded in this webpage? => Initialize version specific namespace.
  if (!window.ccm[ccm.version()]) window.ccm[ccm.version()] = ccm;
})();

/**
 * @namespace ccm.types
 * @description _ccmjs_-specific Type Definitions
 */

/**
 * @typedef {Object} ccm.types.component
 */

/**
 * @typedef {Object} ccm.types.framework
 */

/**
 * @typedef {Object|string} ccm.types.html_data
 * @summary JSON representation of HTML
 * @description
 * Other properties besides <code>tag</code> and <code>inner</code> are used to define HTML attributes.
 * The HTML data can also contain placeholders marked with <code>%%</code>, which can be dynamically replaced with values via {@link ccm.helper.html} or {@link ccm.helper.format}.
 * A string instead of an object represents pure text content without HTML tags.
 * @property {string} [tag="div"] - HTML tag name
 * @property {ccm.types.html_data} [inner] - inner HTML
 * @example
 * {
 *   tag: "p",
 *   inner: [
 *     "Hello, ",
 *     {
 *       tag: "b",
 *       inner: "%name%",
 *     },
 *     "! ",
 *     {
 *       tag: "button",
 *       onclick: "%click%",
 *     },
 *   ]
 * }
 * // represents the following HTML:
 * // <p>Hello, <b>%name%</b>! <button onclick="%click%"></button></p>
 */

/**
 * @typedef {Object} ccm.types.instance
 */

/**
 * @typedef {Object} ccm.types.resource_obj
 * @description
 * Instead of a URL, a resource object can be passed to the method {@link ccm.load}, which then contains other information besides the URL, via which the loading of the resource is even more flexible controllable.
 * In the case of HTML, JSON and XML, the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) is used to load the ressource. All properties in the resource object are also spread into the <code>options</code> object (2nd parameter of [fetch()](https://developer.mozilla.org/en-US/docs/Web/API/fetch)). This means that, for example, HTTP headers can also be set here.
 * @property {string} url - URL from which the resource should be loaded.
 * @property {Element|ccm.types.instance} [context] - Context in which the resource is loaded (default is <code>\<head></code>). Only relevant when loading CSS or JavaScript. CSS is loaded via <code>\<link></code> and JavaScript is loaded via <code>\<script></code>. When a [_ccmjs_ component instance]{@link ccm.types.instance} is passed, the resource is loaded in the Shadow DOM of that instance.
 * @property {string} [type] - Resource is loaded as <code>'css'</code>, <code>'html'</code>, <code>'image'</code>, <code>'js'</code>, <code>'module'</code>, <code>'json'</code> or <code>'xml'</code>. If not specified, the type is automatically recognized by the file extension. If the file extension is unknown, <code>'json'</code> is used by default.
 * @property {string} [attr] - Additional HTML attributes to be set for the HTML tag that loads the resource. Only relevant when loading CSS or JavaScript. CSS is loaded via <code>\<link></code> and JavaScript is loaded via <code>\<script></code>. With the additional attributes <code>integrity</code> and <code>crossorigin</code> the resource can be loaded with Subresource Integrity (SRI).
 * @property {string} [method] - The request method, e.g., <code>"GET"</code>, <code>"POST"</code>. The default is <code>"GET"</code>. Only relevant when loading data. <code>"JSONP"</code> is also supported.
 * @property {string} [params] - HTTP parameters to send. Only relevant when loading data.
 * @tutorial loading-of-resources
 */

/**
 * @typedef {Object} ccm.types.store
 */

/**
 * @typedef {string} ccm.types.version_nr
 * @description A version number that is conformed with Semantic Versioning 2.0.0 ({@link http://semver.org}).
 * @example "1.0.0"
 * @example "2.1.3"
 */
