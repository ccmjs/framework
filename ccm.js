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
   * Contains the registered components within this _ccm_ framework version.
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.types.component_index, ccm.types.component_obj>}
   */
  const _components = {};

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
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Loading-Resources}
     * to learn everything about this method. There are also examples of how to use it.
     * @param {...(string|ccm.types.resource_obj)} resources - Resources to load. Either the URL or a [resource object]{@link ccm.types.resource_obj} can be passed for a resource.
     * @returns {Promise<*>}
     */
    load: async (...resources) => {
      /**
       * results of loaded resources
       * @type {Array}
       */
      let results = [];

      /**
       * number of not finished loading resources
       * @type {number}
       */
      let counter = 1;

      /**
       * Indicates if loading of at least one resource failed.
       * @type {boolean}
       */
      let failed = false;

      return new Promise((resolve, reject) => {
        // Iterate through all the resources that should be loaded.
        resources.forEach((resource, i) => {
          counter++; // one more not finished loading resource

          // Should several resources be loaded one after the other (not in parallel)?
          if (Array.isArray(resource)) {
            results[i] = [];
            serial(null);
            return;
          }

          // A string is interpreted as the URL of the resource.
          if (typeof resource === "string") resource = { url: resource };

          // By default, a resource is loaded in the <head> of the webpage.
          if (!resource.context) resource.context = document.head;

          // A resource can be loaded in the Shadow DOM of a component instance.
          if (ccm.helper.isInstance(resource.context))
            resource.context = resource.context.element.parentNode;

          // Load the resource according to its type.
          getOperation()();

          /**
           * Recursively loads the resource one after the other.
           * @param {*} result - result of the last serially loaded resource
           */
          function serial(result) {
            // if there is a result value for the last loaded resource
            if (result !== null) results[i].push(result);

            // all resources have been loaded serially
            if (!resource.length) return check();

            // start loading the next resource
            let next = resource.shift();
            if (!Array.isArray(next)) next = [next];
            ccm.load
              .apply(null, next)
              .then(serial)
              .catch((result) => {
                failed = true;
                serial(result);
              }); // recursive call
          }

          /**
           * Returns the operation to load resource according to its type.
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

            // The type of the resource is determined by its file extension.
            const suffix = resource.url
              .split(/[#?]/)[0]
              .split(".")
              .at(-1)
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
            /** @type {ccm.types.html|Element} */
            let element = {
              tag: "link",
              rel: "stylesheet",
              type: "text/css",
              href: resource.url,
            };

            // set up individual HTML attributes for <link> tag
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
              .at(0)
              .split("/")
              .at(-1)
              .replace(".min.", ".");

            /** @type {ccm.types.html|Element} */
            let element = { tag: "script", src: resource.url, async: true };

            // set up individual HTML attributes for <script> tag
            if (resource.attr) element = Object.assign(element, resource.attr);

            element = ccm.helper.html(element); // convert to DOM element
            element.onload = () => {
              // The JS file can pass its result data to the ccm framework via a global variable.
              const data = window.ccm.files[filename] || resource.url;
              delete window.ccm.files[filename];
              element.parentNode.removeChild(element);
              success(data);
            };
            element.onerror = () => {
              delete window.ccm.files[filename];
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

              /** @type {ccm.types.html|Element} */
              let element = {
                tag: "script",
                src: buildURL(resource.url, resource.params),
              };

              // set up individual HTML attributes for <script> tag
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
            results[i] = new Error(`loading of ${resource.url} failed`);
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
     * @summary Registers a _ccm_ component.
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Embedding-Components}
     * to learn everything about embedding components in _ccm_. There are also examples how to use this method.
     * @param {ccm.types.component_obj|string} component - object, index or URL of component
     * @param {ccm.types.config} [config={}] - priodata for component default instance configuration
     * @returns {Promise<ccm.types.component_obj>|Error} clone of registered component object
     * @throws {Error} if component is not valid
     */
    component: async (component, config = {}) => {
      component = await getComponentObject();
      if (!ccm.helper.isComponent(component))
        throw new Error("invalid component: " + component);

      // the framework version used by a component can be adjusted via config
      if (config.ccm) component.ccm = config.ccm;
      delete config.ccm;

      /**
       * framework version that the component has to use
       * @type {ccm.types.version_nr}
       */
      let version;
      if (ccm.helper.isCore(component.ccm)) version = component.ccm.version();
      else {
        const [url] = component.ccm.split("#");
        if (url.includes("-"))
          version = url.split("-").at(-1).split(".").slice(0, 3).join(".");
      }

      // framework version is not present in the current webpage?
      if (!window.ccm[version]) {
        // load framework version from URL (SRI hash can be added with '#')
        const [url, sri] = component.ccm.split("#");
        await ccm.load(
          sri
            ? { url, attr: { integrity: sri, crossorigin: "anonymous" } }
            : url,
        );
      }

      // Does this component use another framework version? => register a component via another framework version (backward compatibility)
      if (version && version !== ccm.version())
        return new Promise((resolve, reject) =>
          window.ccm[version]
            .component(component, config, resolve) // before ccm v18, callbacks were used instead of promises
            ?.then(resolve)
            .catch(reject),
        );

      // set component index
      component.index =
        component.name +
        (component.version ? "-" + component.version.join("-") : "");

      // component isn't registered yet?
      if (!_components[component.index]) {
        _components[component.index] = component; // register component
        ccm.components[component.index] = {}; // create global component namespaces
        component.instances = 0; // add ccm instance counter
        component.ready && (await component.ready.call(component)); // execute “ready” callback, if any
        delete component.ready; // "ready" callback is no more needed (one-time call)
        await defineCustomElement(component.index); // define HTML tag for component
      }

      // never give out the original reference to a component object once registered (security reasons)
      component = ccm.helper.clone(_components[component.index]);

      // set reference to the used framework version
      component.ccm = window.ccm[version] || ccm;

      // prepare default instance configuration
      component.config = await prepareConfig(config, component.config);

      // add functions for creating and starting instances
      component.instance = async (config = {}, element) =>
        ccm.instance(
          component,
          await prepareConfig(config, component.config),
          element,
        );
      component.start = async (config = {}, element) =>
        ccm.start(
          component,
          await prepareConfig(config, component.config),
          element,
        );

      return component;

      /**
       * get component object via index or URL
       * @returns {Promise<ccm.types.component_obj>}
       */
      async function getComponentObject() {
        // no string? => abort
        if (typeof component !== "string") return component;

        /**
         * data extracted from component URL
         * @type {{name: string, index: string, version: string, filename: string, url: string, minified: boolean, sri: string}}
         */
        const url_data = component.includes(".js")
          ? ccm.helper.convertComponentURL(component)
          : null;

        /**
         * index of the component
         * @type {ccm.types.component_index}
         */
        const index = url_data?.index || component;

        // component already registered? => use clone of an already registered component object
        if (_components[index]) return ccm.helper.clone(_components[index]);

        // no component URL? => abort
        if (!url_data) return component;

        // load component from URL (SRI hash can be added with '#')
        const response = await ccm.load(
          url_data.sri
            ? {
                url: url_data.url,
                attr: { integrity: url_data.sri, crossorigin: "anonymous" },
              }
            : url_data.url,
        );

        response.url = url_data.url; // a component remembers its URL
        return response;
      }
    },

    /**
     * @summary Registers a _ccm_ component and creates an instance out of it.
     * @description
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Embedding-Components}
     * to learn everything about embedding components in _ccm_. There are also examples how to use this method.
     * @param {ccm.types.component_obj|string} component - object, index or URL of component
     * @param {ccm.types.config} [config={}] - priority data for instance configuration
     * @param {Element} [element=document.createElement("div")] - webpage area where the component instance will be embedded (default: on-the-fly <div>)
     * @returns {Promise<ccm.types.instance>}
     * @throws {Error} if component is not valid
     */
    instance: async (
      component,
      config = {},
      element = document.createElement("div"),
    ) => {
      // register component
      component = await ccm.component(component, { ccm: config?.ccm });

      // no component object? => abort
      if (!ccm.helper.isComponent(component)) return component;

      // Does the instance use another framework version? => register a component via another framework version (backward compatibility)
      const version = component.ccm.version();
      if (version && version !== ccm.version())
        return new Promise((resolve, reject) => {
          const major = parseInt(version.split(".")[0]);
          window.ccm[version]
            .instance(component, config, major < 18 ? resolve : element) // before version 18, callbacks were used instead of promises (and there was no 3rd parameter)
            ?.then(resolve)
            .catch(reject);
        });

      // render loading icon in the webpage area
      element.innerHTML = "";
      const loading = ccm.helper.loading();
      element.appendChild(loading);

      // prepare instance configuration
      config = await prepareConfig(config, component.config);

      /**
       * an instance newly created out of the component
       * @type {ccm.types.instance}
       */
      const instance = new component.Instance();

      // set ccm-specific properties
      instance.ccm = component.ccm; // reference to the used framework version
      instance.component = component; // an instance knows which component it comes from
      instance.id = ++_components[component.index].instances; // instance ID
      instance.index = component.index + "-" + instance.id; // instance index (unique in hole webpage)
      if (!instance.init) instance.init = async () => {}; // each instance must have an init method
      instance.parent = config.parent; // an instance knows which parent instance is using it as a child
      delete config.parent; // prevents cyclic recursion when resolving dependencies
      instance.children = {}; // an instance knows all child instances that it uses
      instance.config = ccm.helper.stringify(config); // each instance knows his original config

      // convert Light DOM to Element Node
      if (config.inner)
        config.inner = ccm.helper.html(config.inner, undefined, {
          ignore_apps: true,
        });

      // add instance as child to parent instance
      if (instance.parent) instance.parent.children[instance.index] = instance;

      // set the root element of the created instance
      instance.root = ccm.helper.html({ id: instance.index });
      // create a Shadow DOM in the root element
      if (config.shadow !== "none")
        instance.shadow = instance.root.attachShadow({
          mode: config.shadow || "closed",
        });
      delete config.shadow;

      // set content element of created instance
      (instance.shadow || instance.root).appendChild(
        (instance.element = ccm.helper.html({ id: "element" })),
      );

      document.head.appendChild(instance.root); // move root element temporary to <head> (resolving dependencies requires DOM contact)
      config = await ccm.helper.solveDependencies(config, instance); // resolve all dependencies in config
      element.appendChild(instance.root); // move the root element back to the webpage area
      instance.element.appendChild(loading); // move loading icon to content element

      Object.assign(instance, config); // integrate config in the created instance
      if (!instance.parent?.init) await initialize(); // initialize created and dependent instances

      return instance;

      /**
       * calls init and ready method of created instance and all dependent ccm instances
       * @returns {Promise<void>}
       */
      function initialize() {
        return new Promise((resolve) => {
          /**
           * found ccm instances
           * @type {ccm.types.instance[]}
           */
          const instances = [instance];

          // find all sub-instances dependent on the created instance
          find(instance);

          // call init methods of all found ccm instances
          let i = 0;
          init();

          /**
           * finds all dependent ccm instances (breadth-first-order, recursive)
           * @param {Array|Object} obj - array/object that is searched
           */
          function find(obj) {
            /**
             * found relevant inner objects/arrays (needed for breath-first-order)
             * @type {Array.<Array|Object>}
             */
            const relevant = [];

            // search object/array
            for (const key in obj)
              if (Object.hasOwn(obj, key)) {
                const value = obj[key];

                // value is a ccm instance? (not parent instance) => add to found instances
                if (ccm.helper.isInstance(value) && key !== "parent") {
                  instances.push(value);
                  relevant.push(value);
                }
                // value is an array/object?
                else if (Array.isArray(value) || ccm.helper.isObject(value)) {
                  // relevant object type? => add to relevant inner arrays/objects
                  if (!ccm.helper.isSpecialObject(value)) relevant.push(value);
                }
              }

            // search relevant inner arrays/objects (recursive calls)
            relevant.forEach(find);
          }

          /** calls init methods (forward) of all found ccm instances (recursive, asynchron) */
          function init() {
            // all init methods called? => call ready methods
            if (i === instances.length) return ready();

            /**
             * first founded ccm instance with didn't call init method
             * @type {ccm.types.instance}
             */
            const next = instances[i++];

            // call and delete the init method and continue with the next found ccm instance (recursive call)
            next.init
              ? next.init().then(() => {
                  delete next.init;
                  init();
                })
              : init();
          }

          /** calls ready methods (backward) of all found ccm instances (recursive, asynchron) */
          function ready() {
            // all ready methods called? => perform callback
            if (!instances.length) return resolve();

            /**
             * last founded ccm instance with a not called ready method
             * @type {ccm.types.instance}
             */
            const next = instances.pop();

            // result has a ready function? => perform and delete the ready function and check the next result afterward (recursive call)
            next.ready
              ? next.ready().then(() => {
                  delete next.ready;
                  proceed();
                })
              : proceed();

            /** when instance is ready */
            function proceed() {
              // does the app have to be started directly? => do it (otherwise: continue with next instance)
              if (next._start) {
                delete next._start;
                next.start().then(ready);
              } else ready();
            }
          }
        });
      }
    },

    /**
     * @summary Registers a _ccm_ component, creates an instance out of it and starts the instance.
     * @description
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Embedding-Components}
     * to learn everything about embedding components in _ccm_. There are also examples how to use this method.
     * @param {ccm.types.component_obj|string} component - object, index or URL of component
     * @param {ccm.types.config} [config={}] - priority data for instance configuration
     * @param {Element} [element=document.createElement("div")] - webpage area where the component instance will be embedded (default: on-the-fly <div>)
     * @returns {Promise<ccm.types.instance>}
     */
    start: async (
      component,
      config = {},
      element = document.createElement("div"),
    ) => {
      // register component
      component = await ccm.component(component, { ccm: config?.ccm });

      // no component object? => abort
      if (!ccm.helper.isComponent(component)) return component;

      // component uses another framework version? => create an instance via another framework version
      if (component.ccm.version() !== ccm.version())
        return component.ccm.start(component, config, element);

      const instance = await ccm.instance(component, config, element);
      if (!ccm.helper.isInstance(instance)) return instance;
      instance.init ? (instance._start = true) : await instance.start();
      return instance;
    },

    /**
     * @summary Contains framework-relevant helper functions.
     * @description These are also useful for component developers.
     * @namespace
     */
    helper: {
      /**
       * @summary Creates a deep copy of a value.
       * @param {any} value
       * @param [hash] - internal usage
       * @returns {any}
       */
      clone: (value, hash = new Set()) => {
        if (Array.isArray(value) || ccm.helper.isObject(value)) {
          if (ccm.helper.isSpecialObject(value) || hash.has(value))
            return value;
          hash.add(value);
          const copy = Array.isArray(value) ? [] : {};
          for (const i in value) copy[i] = ccm.helper.clone(value[i], hash);
          return copy;
        }
        return value;
      },

      /**
       * @summary Extract data from a _ccm_ component URL. (TODO: SRI in doc)
       * @param {string} url
       * @returns {{name: string, index: string, version: string, filename: string, url: string, minified: boolean, sri: string}}
       * @throws {Error} if component filename is not valid
       * @example
       * const data = ccm.helper.convertComponentURL( './ccm.quiz.js' );  // latest version
       * console.log(data); // {"name":"quiz","index":"quiz","filename":"ccm.quiz.js","url":"./ccm.quiz.js"}
       * @example
       * const data = ccm.helper.convertComponentURL( './ccm.quiz-4.0.2.js' ); // specific version
       * console.log(data); // {"name":"quiz","version":"4.0.2","index":"quiz-4-0-2","filename":"ccm.quiz-4.0.2.js","url":"./ccm.quiz-4.0.2.js"}
       * @example
       * const data = ccm.helper.convertComponentURL( './ccm.quiz.min.js' );  // minified
       * console.log(data); // {"name":"quiz","index":"quiz","filename":"ccm.quiz.min.js","url":"./ccm.quiz.min.js","minified":true}
       */
      convertComponentURL: (url) => {
        /**
         * from given url extracted filename of the ccm component
         * @type {string}
         */
        let sri;
        [url, sri] = url.split("#");
        const filename = url.split("/").at(-1);

        // abort if extracted filename is not a valid filename for a ccm component
        if (!ccm.helper.regex("filename").test(filename))
          throw new Error("invalid component filename: " + filename);

        // extract data
        const data = { url, filename, sri };
        let tmp = filename.substring(4, filename.length - 3); // remove prefix 'ccm.' and postfix '.js'
        if (tmp.endsWith(".min")) {
          data.minified = true;
          tmp = tmp.substring(0, tmp.length - 4); // removes optional infix '.min'
        }
        tmp = tmp.split("-");
        data.name = tmp.at(0); // name
        if (tmp.length > 1) data.version = tmp[1]; // version
        data.index =
          data.name +
          (data.version ? "-" + data.version.replace(/\./g, "-") : ""); // index

        return data;
      },

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
       * @summary generates an instance configuration out of a HTML element
       * @description
       * @param {Element} element - HTML element
       * @returns {ccm.types.config}
       * @example
       * <ccm-app component="..." config='["ccm.load",...]'></ccm-app>
       * @example
       * <ccm-app component="..." config='["ccm.get",...]'></ccm-app>
       * @example
       * <ccm-app component="..." config='{"foo":"bar",...}'></ccm-app>
       * @example
       * <ccm-app component="...">
       *   {
       *     "foo": "bar",
       *     ...
       *   }
       * <ccm-app>
       */
      generateConfig: async (element) => {
        // innerHTML contains config as JSON? => move it to 'config' attribute
        if (element.innerHTML.startsWith("{")) {
          element.setAttribute("config", element.innerHTML);
          element.innerHTML = "";
        }

        // get config from 'config' attribute
        let config = element.getAttribute("config");
        if (!config) return null;
        try {
          config = JSON.parse(config);
        } catch (e) {}
        return ccm.helper.solveDependency(config);
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
       * @param {string|ccm.types.html} html - HTML as string or JSON
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
       * @returns {ccm.types.html} JSON representation of the HTML
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
       * @summary integrates priority data into a given dataset
       * @description
       * Each value of each property in the given priority data will be set in the given dataset for the property of the same name.
       * This method also supports dot notation in given priority data to set a single deeper property in the given dataset.
       * With no given priority data, the result is the given dataset.
       * With no given dataset, the result is the given priority data.
       * Any data dependencies will be resolved before integration.
       * @param {Object} [priodata] - priority data
       * @param {Object} [dataset] - dataset
       * @returns {Object} dataset with integrated priority data
       * @example
       * const dataset  = { firstname: 'John', lastname: 'Doe', fullname: 'John Doe' };
       * const priodata = { lastname: 'Done', fullname: undefined };
       * const result = await ccm.helper.integrate( priodata, dataset );
       * console.log( result );  // { firstname: 'John', lastname: 'Done', fullname: undefined };
       * @example
       * const result = await ccm.helper.integrate( { 'foo.c': 'z' }, { foo: { a: 'x', b: 'y' } } );
       * console.log( result );  // { foo: { a: 'x', b: 'y', c: 'z' } }
       * @example
       * const result = await ccm.helper.integrate( { value: 'foo' } );
       * console.log( result );  // { value: 'foo' }
       * @example
       * const result = await ccm.helper.integrate( undefined, { value: 'foo' } );
       * console.log( result );  // { value: 'foo' }
       * @example
       * const store = { data: { key: 'data', foo: 'bar' } };
       * const result = await ccm.helper.integrate( { 'value.foo': 'baz' }, { value: [ 'ccm.get', { local: store }, 'data' ] } );
       * console.log( result );  // { value: { foo: 'baz' } }
       */
      integrate: async (priodata, dataset) => {
        dataset = ccm.helper.clone(dataset);

        // no given priority data? => return given dataset
        if (!ccm.helper.isObject(priodata)) return dataset;

        // no given dataset? => return given priority data
        if (!ccm.helper.isObject(dataset)) return ccm.helper.clone(priodata);

        // iterate over priority data properties
        for (let key in priodata) {
          // search and solve data dependencies along key path before integration of priority data value
          const split = key.split(".");
          let obj = dataset;
          for (let i = 0; i < split.length; i++) {
            const prop = split[i];
            if (
              ccm.helper.isDependency(obj[prop]) &&
              obj[prop][0] === "ccm.get"
            )
              obj[prop] = await ccm.helper.solveDependency(obj[prop]);
            obj = obj[prop];
            if (!obj) break;
          }

          // set value for the same property in the given dataset
          ccm.helper.deepValue(dataset, key, priodata[key]);
        }

        // return dataset with integrated priority data
        return dataset;
      },

      /**
       * @summary Checks whether a value is a [_ccm_ component object]{@link ccm.types.component_obj}.
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
      isComponent: (value) =>
        value?.name && value.ccm && value.config && value.Instance && true,

      /**
       * @summary Checks if a value is a _ccm_ core object.
       * @param {*} value - value to check
       * @returns {boolean}
       */
      isCore: (value) => value?.components && value.version && true,

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
       * check value if it is a _ccm_ dependency
       * @param {*} value
       * @returns {boolean}
       * @example ["ccm.load", ...]
       * @example ["ccm.component", ...]
       * @example ["ccm.instance", ...]
       * @example ["ccm.start", ...]
       * @example ["ccm.store", ...]
       * @example ["ccm.get", ...]
       */
      isDependency: function (value) {
        if (Array.isArray(value))
          if (value.length > 0)
            switch (value[0]) {
              case "ccm.load":
              case "ccm.component":
              case "ccm.instance":
              case "ccm.start":
              case "ccm.store":
              case "ccm.get":
                return true;
            }
        return false;
      },

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
      isElement: (value) =>
        value instanceof Element || value instanceof DocumentFragment,

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
       * @summary Checks whether a value is a [_ccm_ component instance]{@link ccm.types.instance}.
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
       * @summary Checks whether a value is a valid [unique identifier]{@link ccm.types.key}.
       * @param {any} value
       * @returns {boolean}
       * @example
       * const value = await ccm.generateKey();
       * ccm.helper.isKey(value); // => true
       */
      isKey: (value) => /^[a-z0-9]{32}$/.test(value),

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
      isPlainObject: (value) =>
        Object.getPrototypeOf(value) === Object.prototype,

      /**
       * @summary checks if a value is a special object
       * @description
       * A special object is Window Object, Node, _ccm_ Object, _ccm_ Instance and _ccm_ Datastore.
       * These objects lead to endless loops if you recursively go through each property in depth.
       * @param {*} value
       * @returns {boolean}
       */
      isSpecialObject: (value) => {
        return !!(
          value === window ||
          ccm.helper.isNode(value) ||
          ccm.helper.isCore(value) ||
          ccm.helper.isInstance(value) ||
          ccm.helper.isDatastore(value)
        );
      },

      /**
       * returns the _ccm_ loading icon
       * @param {ccm.types.instance} [instance] - then the keyframe animation of the icon is placed within the Shadow DOM of this instance (default: <code>document.head</code>)
       * @returns {Element}
       * @example document.body.appendChild(loading())
       * @example instance.element.appendChild(loading(instance))
       */
      loading: (instance) => {
        // create keyframe animation, if not already present
        if (!document.head.querySelector(":scope > #ccm_keyframe")) {
          const style = document.createElement("style");
          style.id = "ccm_keyframe";
          style.appendChild(
            document.createTextNode(
              "@keyframes ccm_loading {to {transform: rotate(360deg)}}",
            ),
          );
          document.head.appendChild(style);
        }

        // create loading icon
        const element = document.createElement("div");
        element.classList.add("ccm_loading");
        element.setAttribute("style", "display: grid; padding: 0.5em;");
        element.innerHTML =
          '<div style="align-self: center; justify-self: center; display: inline-block; width: 2em; height: 2em; border: 0.3em solid #f3f3f3; border-top-color: #009ee0; border-left-color: #009ee0; border-radius: 50%; animation: ccm_loading 1.5s linear infinite;"></div>';

        return element;
      },

      /**
       * @summary Provides a _ccm_-relevant regular expression.
       * @description
       * Possible index values, it's meanings and it's associated regular expressions:
       * <table>
       *   <tr>
       *     <th>index</th>
       *     <th>meaning</th>
       *     <th>regular expression</th>
       *   </tr>
       *   <tr>
       *     <td><code>'filename'</code></td>
       *     <td>filename for an _ccmjs_ instance</td>
       *     <td>/^(ccm.)?([^.-]+)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.js)$/</td>
       *   </tr>
       *   <tr>
       *     <td><code>'key'</code></td>
       *     <td>key for a _ccmjs_ dataset</td>
       *     <td>/^[a-z_0-9][a-zA-Z_0-9]*$/</td>
       *   </tr>
       * </table>
       * @param {string} index - index of the regular expression
       * @returns {RegExp} RegExp Object
       * @example
       * // test if a given string is a valid filename for an ccm component
       * var string = 'ccm.dummy-3.2.1.min.js';
       * var result = ccm.helper.regex( 'filename' ).test( string );
       * console.log( result );  // => true
       * @example
       * // test if a given string is a valid key for a ccm dataset
       * var string = 'dummy12_Foo3';
       * var result = ccm.helper.regex( 'key' ).test( string );
       * console.log( result );  // => true
       */
      regex: function (index) {
        switch (index) {
          case "filename":
            return /^ccm\.([a-z][a-z_0-9]*)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.js)$/;
          case "key":
            return /^[a-zA-Z0-9_-]+$/;
        }
      },

      /**
       * @summary solves _ccm_ dependencies contained in an array or object
       * @param {Array|Object} obj - array or object
       * @param {ccm.types.instance} [instance] - associated _ccm_ instance
       * @returns {Promise<void>}
       */
      solveDependencies: (obj, instance) =>
        new Promise((resolve, reject) => {
          obj = ccm.helper.clone(obj);
          if (!Array.isArray(obj) && !ccm.helper.isObject(obj))
            return resolve(obj);
          let failed = false;
          let counter = 1;
          search(obj);
          check();

          function search(obj) {
            if (ccm.helper.isSpecialObject(obj)) return;
            for (const key in obj)
              if (Object.hasOwn(obj, key))
                if (key !== "ignore") {
                  const value = obj[key];
                  if (ccm.helper.isDependency(value)) {
                    counter++;
                    ccm.helper
                      .solveDependency(obj[key], instance)
                      .then((result) => {
                        obj[key] = result;
                        check();
                      })
                      .catch((result) => {
                        failed = true;
                        obj[key] = result;
                        check();
                      });
                  } else if (Array.isArray(value) || ccm.helper.isObject(value))
                    search(value);
                }
          }

          function check() {
            !--counter && (failed ? reject : resolve)(obj);
          }
        }),

      /**
       * @summary solves a ccm dependency
       * @param {Array} dependency - ccm dependency
       * @param {ccm.types.instance} [instance] - associated _ccm_ instance
       * @returns {Promise<*>}
       */
      solveDependency: async (dependency, instance) => {
        // given value is no ccm dependency? => result is given value
        if (!ccm.helper.isDependency(dependency)) return dependency;

        // prevent changes via original reference
        dependency = ccm.helper.clone(dependency);

        /**
         * ccm operation to be performed
         * @type {string}
         */
        const operation = dependency.shift().substring("ccm.".length);

        // solve dependency
        let result;
        switch (operation) {
          case "load":
            instance && setContext(dependency);
            result = await ccm.load.apply(null, dependency);
            break;
          case "component":
          case "instance":
          case "start":
          case "store":
          case "get":
            if (!dependency[0]) dependency[0] = {};
            if (instance) dependency[0].parent = instance;
            result = await ccm[operation].apply(null, dependency);
        }

        // instance configuration has been loaded that contains a base configuration?
        if (result?.config) {
          // base config given as dependency? => solve it
          result.config = await ccm.helper.solveDependency(result.config);
          // integrate instance configuration into base configuration
          result = await ccm.helper.integrate(result, result.config);
          delete result.config;
        }

        return result;

        /**
         * load resources in Shadow DOM of given ccm instance
         * @param {Array} resources
         */
        function setContext(resources) {
          for (let i = 0; i < resources.length; i++) {
            if (Array.isArray(resources[i])) {
              setContext(resources[i]);
              continue;
            }
            if (!ccm.helper.isObject(resources[i]))
              resources[i] = { url: resources[i] };
            if (!resources[i].context)
              resources[i].context = instance.element.parentNode;
          }
        }
      },

      /**
       * @summary Converts a value to a JSON string and removes not JSON valid data.
       * @param {*} value
       * @param {Function} [replacer]
       * @param {string|number} [space]
       * @returns {string} JSON string
       */
      stringify: (value, replacer, space) =>
        JSON.stringify(
          value,
          (key, value) => {
            if (
              typeof value === "function" ||
              ccm.helper.isSpecialObject(value)
            )
              value = null;
            return replacer ? replacer(key, value) : value;
          },
          space,
        ),
    },
  };

  // is this the first ccm framework version loaded on this webpage? => initialize global namespace
  if (!window.ccm) {
    window.ccm = ccm;

    /**
     * @description
     * This namespace is only used internally.
     * JSONP callbacks for loading data via {@link ccm.load} are temporarily stored here (is always emptied directly).
     * @namespace ccm.callbacks
     * @type {Object.<string,function>}
     */
    ccm.callbacks = {};

    /**
     * @description
     * This namespace is only used internally.
     * Result data of loaded JavaScript files via {@link ccm.load} are temporarily stored here (is always emptied directly).
     * @namespace ccm.files
     * @type {Object}
     */
    ccm.files = {};

    // define Custom Element <ccm-app>
    defineCustomElement("app");
  }

  // is this the first time this specific ccm framework version is loaded on this webpage?
  if (!window.ccm[ccm.version()]) {
    window.ccm[ccm.version()] = ccm; // set version specific namespace
    ccm.components = {}; // set namespace for loaded components
  }

  /**
   * defines a ccm-specific Custom Element
   * @param {string} name - element name (without 'ccm-' prefix)
   * @returns {Promise<void>}
   */
  async function defineCustomElement(name) {
    // no support of Custom Elements in current webbrowser? => abort
    if (!("customElements" in window)) return;

    // Custom Element already exists in current webpage? => abort
    if (customElements.get("ccm-" + name)) return;

    window.customElements.define(
      "ccm-" + name,
      class extends HTMLElement {
        async connectedCallback() {
          // not connected with DOM? => abort
          if (!document.body.contains(this)) return;

          // within another ccm-specific HTML tag? => abort
          let node = this;
          while ((node = node.parentNode))
            if (node.tagName && node.tagName.startsWith("CCM-")) return;

          // embed ccm instance in this ccm-specific HTML tag
          await ccm.start(
            this.tagName === "CCM-APP" ? config.component : name,
            ccm.helper.generateConfig(this),
            this,
          );
        }
      },
    );
  }

  /**
   * prepares a ccm instance configuration
   * @param {ccm.types.config|ccm.types.dependency} [config={}] - instance configuration
   * @param {ccm.types.config} [defaults={}] - default configuration (from component object)
   * @returns {Promise<ccm.types.config>}
   */
  async function prepareConfig(config = {}, defaults = {}) {
    // config given as dependency? => solve it
    config = await ccm.helper.solveDependency(config);

    // integrate instance configuration into default configuration
    const result = await ccm.helper.integrate(config, defaults);

    // delete reserved properties
    delete result.ccm;

    return result;
  }
})();

/**
 * @namespace ccm.types
 * @description _ccm_-specific Type Definitions
 */

/**
 * @typedef {Object} ccm.types.component_index
 */

/**
 * @typedef {Object} ccm.types.component_obj
 */

/**
 * @typedef {Object} ccm.types.config
 */

/**
 * @typedef {Array} ccm.types.dependency
 * @summary _ccm_ dependency
 * @example ["ccm.load", ...]
 * @example ["ccm.component", ...]
 * @example ["ccm.instance", ...]
 * @example ["ccm.start", ...]
 * @example ["ccm.store", ...]
 * @example ["ccm.get", ...]
 */

/**
 * @typedef {Object} ccm.types.framework
 */

/**
 * @typedef {Object|string} ccm.types.html
 * @summary JSON representation of HTML
 * @description
 * Other properties besides <code>tag</code> and <code>inner</code> are used to define HTML attributes.
 * The HTML data can also contain placeholders marked with <code>%%</code>, which can be dynamically replaced with values via {@link ccm.helper.html} or {@link ccm.helper.format}.
 * A string instead of an object represents pure text content without HTML tags.
 * @property {string} [tag="div"] - HTML tag name
 * @property {ccm.types.html} [inner] - inner HTML
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
