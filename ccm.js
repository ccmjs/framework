"use strict";

/**
 * @overview
 * Creates the global namespace [window.ccm]{@link ccm}.
 * @author André Kless <andre.kless@web.de> (https://github.com/akless) 2014-2024
 * @license The MIT License (MIT)
 * @version 28.0.0
 * @changes
 * Version 28.0.0 (10.05.2024)
 * - refactor(ccm.load)!: resource data is no longer cloned
 * - refactor(ccm.load)!: removed timeout for loading resources
 * - refactor(ccm.load)!: JSON is loaded either via fetch API or JSONP and no longer via XMLHttpRequest
 * - refactor(ccm.load)!: used HTTP method must be in upper case
 * - refactor(ccm.load): simplified error messages
 * - refactor(ccm.load): no more counting of same JS files that are loaded in parallel
 * - refactor(ccm.helper.html)!: dynamic parameters must be passed via object.
 * - fix(ccm.helper.generateKey): generates a UUID without dashes (avoids bugs when using a UUID in a URL).
 */
(() => {
  /**
   * Encapsulates everything related to _ccm_.
   * See [this wiki]{@link https://github.com/ccmjs/framework/wiki/} to learn everything about this web technology.
   * @global
   * @namespace
   */
  const ccm = {
    /**
     * @sumary Returns the _ccm_ framework version.
     * @returns {ccm.types.version_nr}
     */
    version: () => "28.0.0",

    /**
     * @summary Asynchronous Loading of Resources
     * @description
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Loading-of-Resources}
     * to learn everything about this method. There are also examples how to use it.
     * @param {...(string|ccm.types.resource_obj)} resources - Resources to load. Either the URL or a [resource object]{@link ccm.types.resource_obj} can be passed for a resource.
     * @returns {Promise<*>}
     */
    load: async (...resources) => {
      /**
       * results data of loaded resource(s)
       * @type {Array}
       */
      let results = [];

      /**
       * number of not finished loading resources
       * @type {number}
       */
      let counter = 1;

      /**
       * indicates if loading of at least one resource failed
       * @type {boolean}
       */
      let failed = false;

      return new Promise((resolve, reject) => {
        // Iterate through all the resources that should be loaded.
        resources.forEach((resource, i) => {
          counter++; // one more not finished loading resource

          // Should several resources be loaded one after the other (i.e. not in parallel)?
          if (Array.isArray(resource)) {
            results[i] = [];
            serial(null);
            return;
          }

          // A string is interpreted as the URL of the resource.
          if (typeof resource === "string") resource = { url: resource };

          // By default, a resource is loaded in the <head> of the webpage.
          if (!resource.context) resource.context = document.head;

          // If the resource should be loaded in the Shadow DOM of a component instance.
          if (ccm.helper.isInstance(resource.context))
            resource.context = resource.context.element.parentNode;

          // load the resource according to its type
          getOperation()();

          /**
           * When resources should be loaded one after the other.
           * @param {*} result - result of the last serially loaded resource
           */
          function serial(result) {
            // if there is a result value for the last loaded resource
            if (result !== null) results[i].push(result);

            // all resources have been loaded serially
            if (!resource.length) return check();

            // start loading next resource
            let next = resource.shift();
            if (!Array.isArray(next)) next = [next];
            ccm.load.apply(null, next).then(serial).catch(serial); // recursive call
          }

          /**
           * returns the operation to load resource according to its type
           * @returns {Function}
           */
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
              .split(/[#?]/)[0]
              .split(".")
              .pop()
              .trim();
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

          /** loads HTML via Fetch API as HTML string */
          function loadHTML() {
            resource.type = "html";
            loadJSON();
          }

          /** loads CSS via <link> tag */
          function loadCSS() {
            /** @type {ccm.types.html_data|Element} */
            let element = {
              tag: "link",
              rel: "stylesheet",
              type: "text/css",
              href: resource.url,
            };

            // setup individual HTML attributes for <link> tag
            if (resource.attr) element = Object.assign(element, resource.attr);

            element = ccm.helper.html(element); // convert to DOM element
            element.onload = () => success(resource.url);
            element.onerror = error;
            resource.context.appendChild(element);
          }

          /** preloads an image */
          function loadImage() {
            const image = new Image();
            image.src = resource.url;
            image.onload = () => success(resource.url);
            image.onerror = error;
          }

          /** loads JavaScript via <script> tag */
          function loadJS() {
            /**
             * extracted filename from URL without ".min" infix
             * @type {string}
             */
            const filename = resource.url
              .split("?")
              .shift()
              .split("/")
              .pop()
              .replace(".min.", ".");

            /** @type {ccm.types.html_data|Element} */
            let element = { tag: "script", src: resource.url, async: true };

            // setup individual HTML attributes for <script> tag
            if (resource.attr) element = Object.assign(element, resource.attr);

            element = ccm.helper.html(element); // convert to DOM element
            element.onload = () => {
              // The JS file can pass its result data to the ccm framework via a global variable.
              const data = window.ccm.files[filename];
              delete window.ccm.files[filename];
              element.parentNode.removeChild(element);
              success(data);
            };
            element.onerror = () => {
              element.parentNode.removeChild(element);
              error();
            };
            resource.context.appendChild(element);
          }

          /** loads a JavaScript module via import() */
          function loadModule() {
            // Use hash signs at the end of URL if only specific properties should be included in the result data.
            let [url, ...keys] = resource.url.split("#");

            // convert relative URL to absolute URL (dynamic imports don't work with relative URL's)
            if (url.startsWith("./"))
              url = url.replace(
                "./",
                location.href.substring(0, location.href.lastIndexOf("/") + 1),
              );

            import(url).then((result) => {
              // if only one specific deeper value has to be the result
              if (keys.length === 1)
                result = ccm.helper.deepValue(result, keys[0]);

              // if more than one specific property has to be included
              if (keys.length > 1) {
                const obj = {};
                keys.forEach((key) => (obj[key] = result[key]));
                result = obj;
              }

              success(result);
            });
          }

          /** loads JSON via Fetch API or JSONP */
          function loadJSON() {
            (resource.method === "JSONP" ? jsonp : fetchAPI)();

            function jsonp() {
              const callback = "callback" + ccm.helper.generateKey();

              // prepare HTTP GET parameters
              if (!resource.params) resource.params = {};
              resource.params.callback = "window.ccm.callbacks." + callback;

              /** @type {ccm.types.html_data|Element} */
              let element = {
                tag: "script",
                src: buildURL(resource.url, resource.params),
              };

              // setup individual HTML attributes for <script> tag
              if (resource.attr)
                element = Object.assign(element, resource.attr);

              element = ccm.helper.html(element); // convert to DOM element

              element.onerror = () => {
                element.parentNode.removeChild(element);
                error();
              };
              window.ccm.callbacks[callback] = (data) => {
                element.parentNode.removeChild(element);
                delete window.ccm.callbacks[callback];
                success(data);
              };
              resource.context.appendChild(element);
            }

            function fetchAPI() {
              if (resource.params)
                resource.method === "GET"
                  ? (resource.url = buildURL(resource.url, resource.params))
                  : (resource.body = JSON.stringify(resource.params));
              fetch(resource.url, resource)
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

          /** loads XML via Fetch API as XML document */
          function loadXML() {
            resource.type = "xml";
            loadJSON();
          }

          /**
           * callback when loading of a resource was successful
           * @param {*} data - result data of the loaded resource
           */
          function success(data) {
            if (data === undefined) return check();
            try {
              if (typeof data !== "object") data = JSON.parse(data);
            } catch (e) {}

            // An HTML file can contain multiple HTML templates via <ccm-template> tags.
            if (resource.type === "html") {
              const regex =
                /<ccm-template key="(\w*?)">([^]*?)<\/ccm-template>/g;
              const result = {};
              let array;
              while ((array = regex.exec(data))) result[array[1]] = array[2];
              if (Object.keys(result).length) data = result;
            }

            // XML is loaded as XML document
            if (resource.type === "xml")
              data = new window.DOMParser().parseFromString(data, "text/xml");

            results[i] = data;
            check();
          }

          /** callback when loading of a resource failed */
          function error() {
            failed = true;
            results[i] = Error(`loading of ${resource.url} failed`);
            check();
          }
        });
        check();

        /** callback when a resource has been loaded */
        function check() {
          if (--counter) return; // not all resources have been loaded yet
          if (results.length <= 1) results = results[0];
          (failed ? reject : resolve)(results);
        }
      });
    },

    /**
     * @summary Contains framework-relevant helper functions.
     * @description These are also useful for component developers.
     * @namespace
     */
    helper: {
      /**
       * @summary Returns or modifies a value contained in a nested data structure.
       * @param {Object} obj - nested data structure
       * @param {string} path - path to the property whose value has to be returned or changed
       * @param {any} [value] - new value to be set (if not specified, the value of the property is returned)
       * @returns {any} - existing or updated value of the property
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
       * @summary Replaces placeholders in data with values.
       * @param {string|Array|Object} data
       * @param {Object} values
       * @returns {string|Array|Object} - deep copy of data with replaced placeholders
       * @example // replace placeholders in a string
       * const string = "Hello, %name%!";
       * const values = { name: "World" };
       * const result = ccm.helper.format(string, values);
       * console.log(result); // => "Hello, World!"
       * @example // replace placeholders in an array
       * const array = ["Hello", "%name%"];
       * const values = {name: "World"};
       * const result = ccm.helper.format(string, values);
       * console.log(result); // => ["Hello", "World"]
       * @example // replace placeholders in an object
       * const object = { hello: "Hello, %name%!", onclick: "%click%" };
       * const values = { name: "World", click: () => console.log("click!") };
       * const result = ccm.helper.format(object, values);
       * console.log(result); // => { hello: "Hello, World!", onclick: () => console.log("click!")}
       */
      format: (data, values) => {
        const functions = {};

        // Convert data to string.
        data = JSON.stringify(data);

        // Replace placeholders with values (functions are rescued in a separate object).
        for (const key in values)
          if (typeof values[key] !== "function")
            data = data.replace(
              new RegExp(`%${key}%`, "g"),
              values[key].replace(/"/g, '\\"'),
            );
          else functions[`%${key}%`] = values[key];

        // Convert the data back to its original format and return it (replace placeholders for rescued functions).
        return JSON.parse(data, (key, val) =>
          Object.keys(functions).includes(val) ? functions[val] : val,
        );
      },

      /**
       * @summary Generates a unique identifier.
       * @returns {ccm.types.key} Universally Unique Identifier ([UUID](https://developer.mozilla.org/en-US/docs/Glossary/UUID)) without dashes
       * @example console.log(ccm.helper.generateKey()); // => 8aacc6ad149047eaa2a89096ecc5a95b
       */
      generateKey: () => crypto.randomUUID().replaceAll("-", ""),

      /**
       * @summary Converts HTML given as a string or JSON into HTML elements.
       * @description Placeholders marked with <code>%%</code> in the HTML are replaced with <code>values</code>.
       * @param {string|ccm.types.html_data} html - HTML as string or JSON
       * @param {Object} [values] - placeholders contained in the HTML are replaced by these values
       * @param {Object} [settings]
       * @param {boolean} [settings.ignore_apps] - no evaluation of \<ccm-app> tags
       * @param {string} [settings.namespace_uri] - namespace URI for HTML elements
       * @returns {Element|Text}
       * @example // converting HTML from string
       * const str = '<p>Hello, <b>%name%</b>! <button onclick="%click%"></button></p>';
       * const values = {
       *   name: "World",
       *   click: () => console.log("click!"),
       * };
       * const elem = ccm.helper.html(str, values);
       * document.body.appendChild(elem);
       * @example // converting HTML from JSON
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

        // HTML is only a string? => convert it to a text node
        if (typeof html === "string") return document.createTextNode(html);

        // replace placeholders with values
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
                    ccm.helper.html(child, undefined, settings), // recursive call for each child
                  ),
                );
              }
              break;
            default:
              if (key.indexOf("on") === 0 && typeof value === "function")
                element.addEventListener(key.substring(2), value);
              else element.setAttribute(key, value);
          }
        }

        // evaluate <ccm-app> tags
        const prefix = "CCM-";
        if (element.tagName.startsWith(prefix) && !settings.ignore_apps)
          ccm.start(
            element.tagName === "CCM-APP"
              ? element.getAttribute("component")
              : element.tagName.substring(prefix.length).toLowerCase(),
            ccm.helper.generateConfig(element),
            element,
          );
        return element;
      },

      /**
       * @summary Converts HTML to JSON.
       * @description Contained HTML comments will be removed.
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

        // HTML is a string? => convert it to a DocumentFragment
        if (typeof html === "string") {
          const template = document.createElement("template");
          template.innerHTML = html;
          html = template.content;
        }

        // Handle DocumentFragment.
        if (html instanceof DocumentFragment) {
          // DocumentFragment has no children? => Return text content.
          if (!html.children.length) return html.textContent;

          // Remove HTML comments.
          [...html.childNodes].forEach((child) => {
            if (child.nodeValue) {
              if (!child.nodeValue || child.nodeType === Node.COMMENT_NODE)
                child.parentNode.removeChild(child);
            }
          });

          // DocumentFragment has only one child? => Return this child.
          if (html.childNodes.length === 1) html = html.firstChild;
        }

        // HTML is not an Element? => Return whatever it is as result.
        if (!ccm.helper.isElement(html)) return html;

        // Convert the HTML element to JSON.
        if (html.tagName) json.tag = html.tagName.toLowerCase(); // Handle HTML tag name.
        if (json.tag === "div") delete json.tag; // Remove default tag name.
        // Handle HTML attributes.
        if (html.attributes)
          [...html.attributes].forEach(
            (attr) =>
              (json[attr.name] =
                attr.value === "" && attr.name !== "value" ? true : attr.value),
          );
        // Handle inner HTML.
        [...html.childNodes].forEach((child) => {
          // Remove HTML comments.
          if (child.nodeType === Node.COMMENT_NODE)
            return child.parentNode.removeChild(child);

          // Remove unnecessary whitespace.
          if (child.nodeValue && !child.parentElement?.closest("pre"))
            child.nodeValue = child.nodeValue.replace(/\s+/g, " ");

          // Convert child elements to JSON.
          if (ccm.helper.isElement(child) || child.nodeValue)
            json.inner.push(
              ccm.helper.isElement(child)
                ? ccm.helper.html2json(child) // Recursive call
                : child.textContent,
            );
        });
        if (!json.inner.length) delete json.inner;
        else if (json.inner.length === 1) json.inner = json.inner[0];
        return json;
      },

      /**
       * @summary Checks whether a value is a [_ccm_ component object]{@link ccm.types.component}.
       * @param {any} value
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
       * @summary Checks whether a value is a [_ccm_ datastore object]{@link ccm.types.store}.
       * @param {any} value
       * @returns {boolean}
       * @example
       * const value = await ccm.store();
       * ccm.helper.isDatastore(value); // => true
       */
      isDatastore: (value) => value?.get && value.local && value.source && true,

      /**
       * @summary Checks whether a value is a DOM element (or a DocumentFragment).
       * @param {any} value
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
       * @summary Checks whether a value is a [_ccm_ framework object]{@link ccm.types.framework}.
       * @param {any} value
       * @returns {boolean}
       * @example
       * const value = window.ccm;
       * ccm.helper.isFramework(value); // => true
       */
      isFramework: (value) => value?.components && value.version && true,

      /**
       * @summary Checks whether a value is a [_ccmjs_ component instance]{@link ccm.types.instance}.
       * @param {any} value
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
       * @param {any} value
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
       * @param {any} value
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
      isObject: (value) =>
        value && typeof value === "object" && !Array.isArray(value),

      /**
       * @summary Checks whether a value is a plain object.
       * @param {any} value
       * @returns {boolean}
       * @example
       * const value = {};
       * ccm.helper.isPlainObject(value); // => true
       * @example
       * class Test {}
       * const value = new Test();
       * ccm.helper.isPlainObject(value); // => false
       * @example
       * const value = function () {};
       * ccm.helper.isPlainObject(value); // => false
       */
      isPlainObject: (value) => {
        return Object.getPrototypeOf(value) === Object.prototype;
      },
    },
  };

  // Is this the first ccm framework version loaded in this webpage? => Initialize global namespace.
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

  // Is this the first time this specific ccm framework version is loaded in this webpage? => Initialize version specific namespace.
  if (!window.ccm[ccm.version()]) window.ccm[ccm.version()] = ccm;
})();

/**
 * @namespace ccm.types
 * @description _ccm_-specific Type Definitions
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
