"use strict";

/**
 * @overview
 * Defines the global namespace [window.ccm]{@link ccm} for accessing ccmjs services.
 *
 * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki} to learn more about ccmjs.
 *
 * @author André Kless <andre.kless@web.de> (https://github.com/akless)
 * @copyright 2014–2026 André Kless
 * @license The MIT License (MIT)
 * @version 28.0.0
 */

{
  /**
   * Encapsulates everything related to ccmjs.
   *
   * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki} to learn more about ccmjs.
   *
   * @global
   * @namespace
   */
  const ccm = {
    /**
     * Retrieves the current version of ccmjs.
     *
     * Returns the version number of ccmjs as a string following Semantic Versioning 2.0.0.
     * Use this as a synchronous, stable accessor for the ccmjs version.
     *
     * @returns {ccm.types.version_nr} Version number of ccmjs.
     */
    version: "28.0.0",

    /**
     * Asynchronous Loading of Resources
     *
     * Loads resources such as HTML, CSS, images, JavaScript, modules, JSON, or XML asynchronously.
     * Supports sequential and parallel loading of resources.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Loading-Resources}
     * to learn more about loading resources in ccmjs.
     *
     * @param {...(string|ccm.types.resource_obj)} resources - Resources to load. Either the URL or a [resource object]{@link ccm.types.resource_obj} can be passed for a resource.
     * @returns {Promise<*>} A promise that resolves with the loaded resources or rejects if loading of at least one resource fails.
     */
    load: async (...resources) => {
      let results = []; // Stores the results of loaded resources.
      let counter = 1; // Tracks the number of resources still loading.
      let failed = false; // Indicates if loading of at least one resource failed.

      return new Promise((resolve, reject) => {
        resources.forEach((resource, i) => {
          counter++; // Increment the counter for each resource.

          // Handle sequential loading of resources.
          if (Array.isArray(resource)) {
            results[i] = [];
            sequential(null);
            return;
          }

          // Convert string URLs to resource objects.
          if (typeof resource === "string") resource = { url: resource };

          // By default, a resource is loaded in the <head> of the web page.
          if (!resource.context) resource.context = document.head;

          // Handle loading in the Shadow DOM of a ccmjs instance.
          if (ccm.helper.isInstance(resource.context))
            resource.context = resource.context.element.parentNode;

          // Determine and call the operation to load the resource based on its type or file extension.
          getOperation()();

          /**
           * Recursively loads a resource one after the other.
           *
           * This function ensures that resources are loaded sequentially, maintaining the order of execution.
           * If a resource fails to load, it marks the operation as failed but continues loading the remaining resources.
           * Nested arrays allow precise control over whether resources are loaded in parallel or sequentially.
           *
           * @param {*} result - The result of the last successfully loaded resource.
           */
          function sequential(result) {
            // Add the result of the last loaded resource to the result array if it exists.
            if (result !== null) results[i].push(result);

            // Check if all resources have been loaded; if so, then treat the loading of these resources as complete.
            if (!resource.length) return check();

            // Retrieve the next resource to be loaded.
            let next = resource.shift();

            // Ensure the next resource is wrapped in an array for consistent processing.
            if (!Array.isArray(next)) next = [next];

            // Load the next resource and recursively call `sequential` upon success or failure.
            ccm.load
              .apply(null, next)
              .then(sequential)
              .catch((result) => {
                failed = true; // Mark the operation as failed if an error occurs.
                sequential(result); // Continue loading the remaining resources.
              });
          }

          /**
           * Returns the operation to load resource according to its type.
           * @returns {Function}
           */
          function getOperation() {
            switch (resource.type) {
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

            // Infer the type from the file extension of the resource URL when no type is given.
            const file_extension = resource.url
              .split(/[#?]/)[0] // Remove query parameters and hash from URL.
              .split(".") // Split the URL by dots to get the file extension.
              .at(-1) // Get the last part as the file extension.
              .trim(); // Remove any surrounding whitespace.

            // Match the file extension to the corresponding loading operation.
            switch (file_extension) {
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

          /**
           * Loads a CSS file via a `<link>` tag.
           *
           * Creates a `<link>` element to load the CSS file. Additional attributes can be set via the `resource.attr` property.
           * The CSS file is loaded in the specified context, and success or error callbacks are triggered accordingly.
           */
          function loadCSS() {

            const element = document.createElement("link");
            element.rel = "stylesheet";
            element.type = "text/css";
            element.href = resource.url;

            // additional attributes
            if (resource.attr) {
              for (const key in resource.attr) {
                element.setAttribute(key, resource.attr[key]);
              }
            }

            element.onload = () => success(resource.url);
            element.onerror = error;

            resource.context.appendChild(element);
          }

          /**
           * Preloads an image.
           *
           * Creates an `Image` object to preload the image. The `src` attribute of the image is set to the URL provided in the `resource` object.
           * When the image is successfully loaded, the `success` callback is triggered with the image URL.
           * If an error occurs during loading, the `error` callback is triggered.
           */
          function loadImage() {
            const image = new Image();
            image.src = resource.url;
            image.onload = () => success(resource.url);
            image.onerror = error;
          }

          /**
           * Loads JavaScript via a <script> tag.
           *
           * Creates a <script> element to load the JavaScript file. The filename is extracted and used to handle result data.
           * The script is loaded asynchronously, and success or error callbacks are triggered accordingly.
           */
          function loadJS() {

            const element = document.createElement("script");
            element.src = resource.url;
            element.async = true;

            // additional attributes
            if (resource.attr) {
              for (const key in resource.attr) {
                element.setAttribute(key, resource.attr[key]);
              }
            }

            element.onload = () => {
              element.remove();
              success(resource.url);
            };
            element.onerror = () => {
              element.remove();
              error();
            };

            resource.context.appendChild(element);
          }

          /**
           * Loads a JavaScript module via dynamic import.
           *
           * This function dynamically imports an ES module from a given URL. It supports Subresource Integrity (SRI) checks
           * to ensure the module's integrity. If specific properties of the module are requested (indicated by hash signs in the URL),
           * only those properties are included in the result. The function also clones the imported module to avoid caching issues.
           */
          async function loadModule() {

            // Extract optional property keys from URL hash
            let [url, ...keys] = resource.url.split("#");

            // Resolve relative URLs to absolute URLs
            url = new URL(url, location.href).href;

            let result;

            // Handle SRI verification
            if (resource.attr?.integrity) {

              // Fetch module source
              const text = await (await fetch(url)).text();

              // Compute SRI hash
              const prefix = resource.attr.integrity.slice(
                  0,
                  resource.attr.integrity.indexOf("-")
              );

              const algorithm = prefix.toUpperCase().replace("SHA", "SHA-");
              const data = new TextEncoder().encode(text);
              const hash = await crypto.subtle.digest(algorithm, data);
              const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
              const sri = `${prefix}-${base64}`;

              // Verify integrity
              if (sri !== resource.attr.integrity) return error();

              // Create blob URL for dynamic import
              const blobUrl = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
              result = await import(blobUrl);
              URL.revokeObjectURL(blobUrl);
            } else {
              result = await import(url);
            }

            // If only one specific deeper value has to be the result
            if (keys.length === 1)
              result = ccm.helper.deepValue(result, keys[0]);

            // If multiple properties should be returned
            if (keys.length > 1) {
              const obj = {};
              keys.forEach(key => obj[key] = result[key]);
              result = obj;
            }

            // Dynamic import returns cached module references → clone to avoid mutation
            success(ccm.helper.clone(result));
          }

          /**
           * Loads JSON data via Fetch API.
           *
           * Sends an HTTP request to fetch the JSON data and handles the response.
           * Supports both `GET` and `POST` methods, with optional parameters. Default is `GET`.
           */
          function loadJSON() {
            // Prepare the URL or request body based on the HTTP method.
            if (resource.params)
              resource.method === "POST"
                ? (resource.body = JSON.stringify(resource.params))
                : (resource.url = buildURL(resource.url, resource.params));

            // Perform the fetch request and handle the response.
            fetch(resource.url, resource)
              .then((response) => response.text())
              .then(success)
              .catch(error);
          }

          /**
           * Builds a URL with query parameters.
           *
           * Appends the provided query parameters to the base URL.
           * Supports nested objects and arrays for complex query structures.
           *
           * @param {string} url - Base URL
           * @param {Object} data - Query parameters to append
           * @returns {string} - URL with appended query parameters.
           */
          function buildURL(url, data) {
            // Append query parameters to the URL.
            return data ? url + "?" + params(data).slice(0, -1) : url;

            /**
             * Converts an object to query string parameters.
             *
             * Recursively processes nested objects and arrays to generate query strings.
             *
             * @param {Object} obj - Object to convert
             * @param {string} [prefix] - Prefix for nested keys
             * @returns {string} - Generated query string
             */
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

          /**
           * Loads XML via Fetch API as an XML document.
           *
           * Sets the resource type to `xml` and delegates the loading process to the `loadJSON` function.
           * The loaded XML content is parsed into an XML document.
           */
          function loadXML() {
            resource.type = "xml";
            loadJSON();
          }

          /**
           * Callback when loading of a resource was successful
           *
           * Processes the loaded data based on its type (e.g., XML) and updates the results array.
           * Triggers the next step in the loading process.
           *
           * @param {*} data - Loaded resource data.
           */
          function success(data) {
            // If the data is not defined, then treat the loading of this resource as complete.
            if (data === undefined) return check();

            // Attempt to parse the data as JSON if it is not already an object.
            try {
              if (typeof data !== "object") data = JSON.parse(data);
            } catch (e) {}

            // Process XML resources by parsing the data into an XML document.
            if (resource.type === "xml")
              data = new window.DOMParser().parseFromString(data, "text/xml");

            // Update the result array with the processed data.
            results[i] = data;

            // Treat the loading of this resource as complete and check if all resources have been loaded.
            check();
          }

          /**
           * Callback when loading of a resource failed
           *
           * Marks the loading process as failed and updates the results array with an error object.
           * Triggers the next step in the loading process.
           */
          function error(e) {
            // Indicate that at least one resource failed to load.
            failed = true;

            // Add an error object to the `results` array for the failed resource, including its URL.
            results[i] = e || new Error(`loading of ${resource.url} failed`);

            // Treat the loading of this resource as complete and check if all resources have been loaded, even if some failed.
            check();
          }
        });

        // Check if all resources already have been loaded.
        check();

        /**
         * Callback function to handle the completion of resource loading.
         *
         * This function is called whenever a resource is finished loading and checks whether all resources have been loaded. If not, it waits for the remaining resources.
         * Once all resources are loaded, it resolves or rejects the promise based on the loading status.
         */
        function check() {
          if (--counter) return; // If there are still resources loading, wait for them to finish.
          if (results.length <= 1) results = results[0]; // If only one resource was loaded, return it directly.
          (failed ? reject : resolve)(results); // Resolve or reject the promise based on the loading status.
        }
      });
    },

    /**
     * Registers a ccmjs component.
     *
     * This method registers a component, ensuring compatibility with different ccmjs versions.
     * It retrieves the component object, validates it, adjusts the ccmjs version, and registers the component.
     * If the component uses a different ccmjs version, it handles backwards compatibility.
     * The method also prepares the default instance configuration and adds methods for creating and starting ccmjs instances.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Embedding-Components}
     * to learn more about embedding components with ccmjs.
     *
     * @param {ccm.types.component_obj|string} component - Component object, index, or URL of the component to register.
     * @param {ccm.types.config} [config={}] - Priority data for the component's default instance configuration.
     * @returns {Promise<ccm.types.component_obj>} Clone of the registered component object.
     * @throws {Error} If the provided component is not valid.
     */
    component: async (component, config = {}) => {
      // Retrieve the component object via index, URL or directly as JavaScript object.
      component = await getComponentObject();

      // If the component is not a valid object, throw an error.
      if (!ccm.helper.isComponent(component))
        throw new Error("invalid component: " + component);

      // Adjust the ccmjs version used by the component via config.
      if (config.ccm) component.ccm = config.ccm;
      delete config.ccm;

      // Determine the ccmjs version the component must use (considering backwards compatibility).
      let version;
      if (ccm.helper.isFramework(component.ccm)) {
        const v = component.ccm.version;
        version = typeof v === "function" ? v() : v;
      } else version = component.ccm.match(/-(\d+\.\d+\.\d+)/)?.at(1);

      // Load the required ccmjs version if not already present in the web page.
      if (!window.ccm[version]) {
        // The ccmjs version is loaded with SRI when the SRI hash is appended to the URL with “#”.
        const [url, sri] = component.ccm.split("#");
        await ccm.load(
          sri
            ? { url, attr: { integrity: sri, crossorigin: "anonymous" } }
            : url,
        );
      }

      // If the component uses a different ccmjs version, handle backwards compatibility.
      if (version && version !== ccm.version)
        return backwardsCompatibility(version, "component", component, config);

      // Set the component index based on its name and version.
      component.index =
        component.name +
        (component.version ? "-" + component.version.join("-") : "");

      // Register the component if it is not already registered.
      if (!_components[component.index]) {
        _components[component.index] = component; // Store the component object encapsulated in ccmjs.
        ccm.components[component.index] = {}; // Create global component namespaces.
        component.instances = 0; // Add a counter for component instances.
        component.ready && (await component.ready.call(component)); // Execute the "ready" callback if defined.
        delete component.ready; // Remove the "ready" callback after execution.
      }

      // Clone the registered component object to avoid direct modifications.
      component = ccm.helper.clone(_components[component.index]);

      // Set the reference to the used ccmjs version.
      component.ccm = window.ccm[version] || ccm;

      // Prepare the default instance configuration.
      component.config = await ccm.helper.prepareConfig(
        config,
        component.config,
      );

      // Add methods for creating and starting instances of the component.
      component.instance = async (config = {}, element) =>
        ccm.instance(
          component,
          await ccm.helper.prepareConfig(config, component.config),
          element,
        );
      component.start = async (config = {}, element) =>
        ccm.start(
          component,
          await ccm.helper.prepareConfig(config, component.config),
          element,
        );

      return component;

      /**
       * Retrieves the component object via index, URL or directly as JavaScript object.
       * @returns {Promise<ccm.types.component_obj>} Component object
       */
      async function getComponentObject() {
        // Return the component directly if it is not a string.
        if (typeof component !== "string") return component;

        /**
         * Extracts metadata from the component URL.
         * @type {{name: string, index: string, version: string, filename: string, url: string, minified: boolean, sri: string}}
         */
        const url_data = /\.m?js(#.*)?$/.test(component)
          ? ccm.helper.parseComponentURL(component)
          : null;

        /**
         * Index of the component
         * @type {ccm.types.component_index}
         */
        const index = url_data?.index || component;

        // Return a clone of the registered component object if already registered.
        if (_components[index]) return ccm.helper.clone(_components[index]);

        // Abort if the component URL is not provided.
        if (!url_data) return component;

        // Load the component from the URL.
        let result = await ccm.load({
          url: url_data.url,
          type: "module",
          // If the SRI hash is provided, load the component with SRI.
          attr: url_data.sri && {
            integrity: url_data.sri,
            crossorigin: "anonymous",
          },
        });
        if (result?.component) result = result.component;
        else {
          // Component file did not return the component object => try to get the component from window.ccm.files. (backwards compatibility)
          const filename = `ccm.${url_data.name}.js`;
          if (!window.ccm.files) window.ccm.files = {};
          window.ccm.files[filename] = null; // marks the component as 'loading'
          window.ccm.files = new Proxy(window.ccm.files, {
            set(obj, key, value) {
              if (key === filename) {
                result = value;
                window.ccm.files = obj; // restore original files object
              }
              return Reflect.set(...arguments);
            },
          });
          await ccm.load(url_data.url);
          delete window.ccm.files[filename];
        }

        result.url = url_data.url; // A component remembers its URL.
        return result;
      }
    },

    /**
     * Creates and initializes a ccmjs instance from a given component.
     *
     * This method registers a ccmjs component, prepares its configuration, and creates an instance.
     * It resolves dependencies, sets up the instance's DOM structure, and initializes the instance.
     * If the component uses a different ccmjs version, it handles backwards compatibility.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Embedding-Components}
     * to learn more about embedding components in ccmjs.
     *
     * @param {ccm.types.component_obj|string} component - Component object, index, or URL of the component to register
     * @param {ccm.types.config} [config={}] - Priority data for instance configuration
     * @param {Element} [area=document.createElement("div")] - Web page area where the component instance will be embedded (default: on-the-fly `<div>`)
     * @returns {Promise<ccm.types.instance>} A promise that resolves to the created instance.
     * @throws {Error} If the provided component is not valid.
     */
    instance: async (
      component,
      config = {},
      area = document.createElement("div"),
    ) => {
      // Register the component.
      component = await ccm.component(component, { ccm: config?.ccm });

      // Abort if the component is not valid.
      if (!ccm.helper.isComponent(component)) return component;

      // Handle backwards compatibility if the component uses another ccmjs version.
      const version =
        typeof component.ccm.version === "function"
          ? component.ccm.version()
          : component.ccm.version;
      if (version && version !== ccm.version)
        return backwardsCompatibility(
          version,
          "instance",
          component,
          config,
          area,
        );

      // Render a loading icon in the web page area.
      area.innerHTML = "";
      const loading = ccm.helper.loading();
      area.appendChild(loading);

      // Prepare the instance configuration.
      config = await ccm.helper.prepareConfig(config, component.config);

      /**
       * The created ccmjs instance.
       * @type {ccm.types.instance}
       */
      const instance = new component.Instance();

      // Set ccmjs-specific properties for the instance.
      instance.ccm = component.ccm; // Reference to the used ccmjs version.
      instance.component = component; // The component the instance is created from.
      instance.id = ++_components[component.index].instances; // Instance ID. Unique within the component.
      instance.index = component.index + "-" + instance.id; // Instance index. Unique within the web page.
      if (!instance.init) instance.init = async () => {}; // Ensure the instance has an init method.
      instance.children = {}; // Store child instances used by this instance.
      instance.parent = config.parent; // Reference to the parent instance.
      delete config.parent; // Prevent cyclic recursion when resolving dependencies.
      instance.config = ccm.helper.stringify(config); // Store the original configuration.

      // Add the instance as a child to its parent instance.
      if (instance.parent) instance.parent.children[instance.index] = instance;

      // Create the host element for the instance.
      instance.host = document.createElement("div");

      // Create a shadow root for the instance if required.
      if (config.root !== "none")
        instance.root = instance.host.attachShadow({
          mode: config.root || "open",
        });
      delete config.root;

      // Create the content element, which lies directly within the shadow root of the host element.
      (instance.root || instance.host).appendChild(
        (instance.element = document.createElement("div")),
      );

      // Temporarily move the host element to <head> for resolving dependencies.
      document.head.appendChild(instance.host);
      config = await ccm.helper.solveDependencies(config, instance); // Resolve all dependencies in the instance configuration.
      area.appendChild(instance.host); // Move the host element back to the target web page area.
      instance.element.appendChild(loading); // Move the loading icon to the content element.

      // Apply configuration mapper if defined
      const mapper = config.mapper;
      delete config.mapper;
      if (mapper)
        config = ccm.helper.mapObject(config, mapper);

      // Remove reserved properties from the configuration to prevent conflicts with instance properties.
      const reserved = new Set([
        "children", "component", "element",
        "host", "init", "instance", "meta",
        "parent", "ready", "root", "start"
      ]);
      for (const key of reserved) {
        if (key in config) {
          console.warn(`ccmjs: config property '${key}' is reserved and was ignored.`);
          delete config[key];
        }
      }

      // Integrate configuration into instance
      Object.assign(instance, config);

      // Initialize the created and dependent instances if necessary.
      if (!instance.parent?.init) await initialize();

      return instance;

      /**
       * @summary Initializes the created instance and all dependent ccmjs instances.
       * @returns {Promise<void>} A promise that resolves when initialization is complete.
       */
      function initialize() {
        return new Promise((resolve) => {
          /**
           * @summary Stores all found ccmjs instances.
           * @type {ccm.types.instance[]}
           */
          const instances = [instance];

          // Find all sub-instances dependent on the created instance.
          find(instance);

          // Call init methods of all found ccmjs instances.
          let i = 0;
          init();

          /**
           * @summary Finds all dependent ccmjs instances (breadth-first-order, recursive).
           * @param {Array|Object} obj - The array or object to search.
           */
          function find(obj) {
            /**
             * Stores relevant inner objects/arrays for breadth-first-order.
             * @type {Array.<Array|Object>}
             */
            const relevant = [];

            // Search the object/array.
            for (const key in obj)
              if (Object.hasOwn(obj, key)) {
                const value = obj[key];

                // Add ccmjs instances to the list of found instances.
                if (ccm.helper.isInstance(value) && key !== "parent") {
                  instances.push(value);
                  relevant.push(value);
                }
                // Add relevant inner arrays/objects for further searching.
                else if (Array.isArray(value) || ccm.helper.isObject(value)) {
                  // relevant object type? => add to relevant inner arrays/objects
                  if (!ccm.helper.isNonCloneable(value)) relevant.push(value);
                }
              }

            // Recursively search relevant inner arrays/objects.
            relevant.forEach(find);
          }

          /**
           * @summary Calls the `init` methods of all ccmjs instances in sequence.
           * @description
           * This function processes a list of ccmjs instances and calls their `init` methods asynchronously.
           * Once all `init` methods are called, it proceeds to the `ready` method.
           * If an instance does not have an `init` method, it skips to the next instance.
           */
          function init() {
            // If all init methods are called, proceed to ready methods.
            if (i === instances.length) return ready();

            /**
             * The next ccmjs instance to call the init method.
             * @type {ccm.types.instance}
             */
            const next = instances[i++];

            // Call and delete the init method, then continue with the next instance.
            next.init
              ? next.init().then(() => {
                  delete next.init;
                  init();
                })
              : init();
          }

          /**
           * @summary Calls the `ready` methods of all ccmjs instances in reverse order.
           * @description
           * This function processes a stack of ccmjs instances, calling their `ready` methods asynchronously.
           * Once all `ready` methods are called, the promise is resolved.
           * If an instance does not have a `ready` method, it proceeds to the next instance.
           */
          function ready() {
            // If all ready methods are called, resolve the promise.
            if (!instances.length) return resolve();

            /**
             * @summary The next ccmjs instance to call the `ready` method.
             * @type {ccm.types.instance}
             */
            const next = instances.pop();

            // Call and delete the ready method, then proceed to the next instance.
            next.ready
              ? next.ready().then(() => {
                  delete next.ready;
                  proceed();
                })
              : proceed();

            /**
             * @summary Handles the next step after the instance is ready.
             * @description
             * If the instance is marked to start directly, it calls its `start` method.
             * Otherwise, it continues with the next instance in the stack.
             */
            function proceed() {
              // If configured for immediate execution, start the instance first, then call ready.
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
     * Registers a ccmjs component, creates an instance out of it, and starts the instance.
     *
     * This function handles the registration of a ccmjs component, creates an instance from it, and starts the instance.
     * It ensures compatibility with different ccmjs versions and initializes the instance if required.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Embedding-Components}
     * to learn more about embedding components in ccmjs.
     *
     * @param {ccm.types.component_obj|string} component - Component object, index, or URL of the component to register
     * @param {ccm.types.config} [config={}] - Priority data for instance configuration
     * @param {Element} [area=document.createElement("div")] - Web page area where the component instance will be embedded (default: on-the-fly `<div>`)
     * @returns {Promise<ccm.types.instance>} A promise that resolves to the created and started instance.
     * @throws {Error} If the provided component is not valid.
     */
    start: async (component, config = {}, area) => {
      // Register the component.
      component = await ccm.component(component, { ccm: config?.ccm });

      // Abort if the component is not valid.
      if (!ccm.helper.isComponent(component)) return component;

      // Handle backwards compatibility if the component uses another ccmjs version.
      const version =
        typeof component.ccm.version === "function"
          ? component.ccm.version()
          : component.ccm.version;
      if (version && version !== ccm.version)
        return backwardsCompatibility(
          version,
          "start",
          component,
          config,
          area,
        );

      // Create an instance out of the component.
      const instance = await ccm.instance(component, config, area);

      // Abort if the instance is not valid.
      if (!ccm.helper.isInstance(instance)) return instance;

      // Start the instance directly (is standalone) or mark it for starting after initialization (is child instance).
      instance.init ? (instance._start = true) : await instance.start();

      // Return the created and started instance.
      return instance;
    },

    /**
     * Creates and initializes a datastore accessor.
     *
     * Factory method that provides a unified abstraction for data persistence.
     * Based on the provided configuration, the appropriate datastore implementation is selected automatically:
     *
     * 1. **InMemoryStore** – Volatile, stored in a JavaScript object.
     * 2. **OfflineStore** – Persistent in browser storage (IndexedDB).
     * 3. **RemoteStore** – Persistent on a remote server via HTTP(S) or WebSocket API.
     *
     * The selection logic is purely configuration-driven:
     * - No `config.name` → InMemoryStore
     * - `config.name` only → OfflineStore
     * - `config.name` + `config.url` → RemoteStore
     *
     * The configuration is fully resolved before initialization
     * (including declarative CCM dependencies).
     *
     * Each invocation creates and initializes a fresh datastore instance.
     * No internal caching or global registry of datastore accessors exists.
     *
     * The returned object implements the common {@link Datastore} API,
     * independent of the underlying storage mechanism.
     *
     * Use {@link ccm.get} for one-time reads without needing direct
     * access to the datastore instance.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Data-Management}
     * to learn more about data management in ccmjs.
     *
     * @param {Object} [config={}] - Datastore configuration
     * @param {string} [config.name] - Logical name of the datastore (required for OfflineStore and RemoteStore)
     * @param {string} [config.url] - Remote endpoint URL. Used together with `name` to create a RemoteStore.
     * @param {string} [config.db] - (RemoteStore only) Optional database identifier if the server supports multiple databases.
     * @param {Object.<string,ccm.types.dataset>|ccm.types.dataset[]} [config.datasets] - (InMemoryStore only) Initial datasets, either as associative object `{ key: dataset }` or array `[ { key, ... }, ... ]`.
     * @param {Object} [config.observe] - (RemoteStore only) Query defining which datasets should be observed via WebSocket.
     * @param {function(Object):void} [config.onchange] - (RemoteStore only) Callback invoked when an observed dataset changes.
     * @param {Object} [config.user] - (RemoteStore only) Component instance used for authentication.
     * @returns {Promise<Datastore>} Resolves to an initialized datastore accessor implementing the common datastore API.
     */
    store: async (config = {}) => {
      // Resolve the configuration if it is a dependency.
      config = await ccm.helper.solveDependency(config);

      // Resolve any nested dependencies in the configuration.
      await ccm.helper.solveDependencies(config);

      // If a RemoteStore is specified, ensure the store name is provided.
      if (config.url && !config.name)
        throw new Error(`RemoteStore "${config.url}" requires a store name (config.name).`);

      // Determine the type of datastore to use based on the configuration.
      const store = new (
        config.name ? (config.url ? RemoteStore : OfflineStore) : InMemoryStore
      )();

      // Assign the resolved configuration properties to the datastore instance.
      Object.assign(store, config);

      // Initialize the datastore.
      await store.init();

      // Return the initialized datastore instance.
      return store;
    },

    /**
     * Loads dataset(s) from a datastore in a single step.
     *
     * Convenience method that creates a transient datastore accessor via {@link ccm.store} and immediately executes a `get()` operation.
     *
     * This method is primarily intended for declarative data dependencies in
     * instance configurations. It allows datasets to be loaded without exposing
     * the underlying datastore instance.
     *
     * Unlike {@link ccm.store}, this method does not return the datastore accessor.
     * Use {@link ccm.store} if further interaction (e.g. `set()`, `del()`, `count()`)
     * with the datastore is required.
     *
     * Store instances are not cached. Each call creates and initializes a fresh
     * datastore accessor based on the provided configuration.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Data-Management}
     * to learn more about data management in ccmjs.
     *
     * @param {Object} [config={}]- Datastore configuration (same as {@link ccm.store})
     * @param {ccm.types.key|Object} [key_or_query={}]
     * Either a dataset key or a query object.
     * If omitted or an empty object is provided, all datasets are returned.
     * @param {Object} [projection]
     * Optional field projection that limits which dataset properties are returned.
     * Support for this parameter depends on the datastore implementation.
     * Currently intended for use with {@link RemoteStore}.
     * @param {Object} [options]
     * Optional datastore-specific query options (e.g. sorting, pagination, server-side modifiers).
     * Interpretation depends on the datastore implementation and may be ignored by some store types.
     * @returns {Promise<ccm.types.dataset|ccm.types.dataset[]>} Resolves to the requested dataset or an array of datasets.
     */
    get: (config = {}, key_or_query = {}, projection, options) =>
      ccm.store(config).then((store) => store.get(key_or_query, projection, options)),

    /**
     * Contains ccmjs-relevant helper functions.
     *
     * These are also useful for component developers.
     *
     * @namespace
     */
    helper: {

      /**
       * Creates a deep copy of a value.
       *
       * Arrays and plain objects are recursively cloned.
       * Primitive values are returned unchanged.
       *
       * Special objects such as DOM nodes, CCM instances, datastores,
       * the CCM core, or the global window object are not cloned and
       * are returned as references.
       *
       * Cyclic references are detected using an internal hash set and
       * are not traversed again to avoid infinite recursion.
       *
       * @param {*} value - Value to clone
       * @param {Set<Object>} [hash] - Internal set used for cycle detection
       * @returns {*} Deep copy of the provided value
       */
      clone: (value, hash = new Set()) => {

        if (Array.isArray(value) || ccm.helper.isObject(value)) {

          // Do not clone special objects or already processed references
          if (ccm.helper.isNonCloneable(value) || hash.has(value))
            return value;

          hash.add(value);

          const copy = Array.isArray(value) ? [] : {};

          Object.keys(value).forEach(key => {
            copy[key] = ccm.helper.clone(value[key], hash);
          });

          return copy;
        }

        // Primitive values are returned unchanged
        return value;
      },

      /**
       * Converts an array of datasets into a datastore-compatible object.
       *
       * The returned object uses the dataset keys as property names:
       *
       * Dataset array:
       * [
       *   { key: "a", value: 1 },
       *   { key: "b", value: 2 }
       * ]
       *
       * Resulting object:
       * {
       *   a: { key: "a", value: 1 },
       *   b: { key: "b", value: 2 }
       * }
       *
       * Only valid datasets (objects containing a valid `key` property)
       * are included in the result. Other values in the array are ignored.
       *
       * If the provided value is not an array, it is returned unchanged.
       * This allows flexible usage when configuration values may already
       * be in datastore format.
       *
       * @param {ccm.types.dataset[]} arr - Array of datasets
       * @returns {Object<string,ccm.types.dataset>|*} Datastore-compatible object or original value
       * @example
       * ccm.helper.datasetsToStore([
       *   { key: "a", value: 1 },
       *   { key: "b", value: 2 }
       * ]);
       *
       * // returns:
       * {
       *   a: { key: "a", value: 1 },
       *   b: { key: "b", value: 2 }
       * }
       */
      datasetsToStore: (arr) => {

        // If the input is not an array, return it unchanged.
        if (!Array.isArray(arr)) return arr;

        const obj = {};

        // Convert dataset array into key-based object.
        arr.forEach(dataset => {

          // Only include valid datasets.
          if (ccm.helper.isDataset(dataset))
            obj[dataset.key] = dataset;

        });

        return obj;
      },

      /**
       * Gets or sets a deeply nested value using dot notation.
       *
       * If only `obj` and `path` are provided, the value is retrieved.
       * If a third argument is provided:
       *   - any value → sets the property
       *   - `undefined` → deletes the property
       *
       * Missing intermediate objects are created automatically when setting a value.
       *
       * @param {Object} obj - Target object
       * @param {string} path - Dot notation path
       * @param {*} [value] - Value to set (or `undefined` to delete)
       * @returns {*} Retrieved or set value.
       */
      deepValue: function (obj, path, value) {

        if (!obj || typeof path !== "string") return;

        const keys = path.split(".");
        const last = keys.pop();
        let current = obj;

        for (let i = 0; i < keys.length; i++) {

          const key = keys[i];
          const nextIsIndex = !isNaN(keys[i + 1]);

          // convert array index access
          if (!isNaN(key) && Array.isArray(current)) {
            if (!current[key]) {
              if (arguments.length < 3) return;
              current[key] = nextIsIndex ? [] : {};
            }
            current = current[key];
            continue;
          }

          // normal object access
          if (current[key] === undefined) {
            if (arguments.length < 3) return;
            current[key] = nextIsIndex ? [] : {};
          }

          current = current[key];
          if (typeof current !== "object") return;
        }

        // GET
        if (arguments.length < 3) {
          return current ? current[last] : undefined;
        }

        // DELETE
        if (value === undefined) {
          if (current && typeof current === "object") {
            delete current[last];
          }
          return;
        }

        // SET
        return current[last] = value;
      },

      /**
       * Embeds a ccmjs component into an HTML element.
       *
       * This helper is automatically used when a `<ccm-app>` custom element
       * is connected to the DOM. It reads the component and configuration
       * information from the element and starts the requested component
       * instance inside the element.
       *
       * Configuration can be provided in two ways:
       *
       * 1. Via the `config` attribute containing JSON.
       * 2. Via a `<script type="application/json">` child element.
       *
       * If both are present, the script configuration has higher priority
       * and overrides values from the attribute configuration.
       *
       * After parsing the configuration, possible ccmjs dependencies
       * inside the configuration are resolved before the component
       * instance is started.
       *
       * @param {HTMLElement} element - The `<ccm-app>` element that hosts the component.
       * @returns {Promise<ccm.types.instance>} Promise resolving to the started component instance.
       *
       * @example
       * <ccm-app
       *   component="./ccm.quiz.mjs"
       *   config='{"feedback":true}'>
       * </ccm-app>
       *
       * @example
       * <ccm-app component="./ccm.quiz.mjs">
       *   <script type="application/json">
       *   {
       *     "feedback": true
       *   }
       *   </script>
       * </ccm-app>
       */
      embed: async (element) => {

        /**
         * Read the component URL from the attribute.
         * Abort if the attribute is missing.
         */
        const component = element.getAttribute("component");
        if (!component)
          throw new Error("<ccm-app> missing 'component' attribute");

        // Configuration object that will be constructed from attribute configuration and inline JSON configuration.
        let config = {};

        // Parse configuration from the `config` attribute. If the attribute is missing, an empty object is used.
        try {
          config = JSON.parse(element.getAttribute("config") || "{}");
        } catch (e) {
          console.warn("Invalid JSON in <ccm-app> config attribute:", e);
        }

        // Look for an inline JSON configuration script. Only direct child scripts are considered. If found, its JSON content overrides attribute values.
        const script = element.querySelector(':scope > script[type="application/json"]');
        if (script) {
          try {
            Object.assign(config, JSON.parse(script.textContent.trim() || "{}"));
          } catch (e) {
            console.warn("Invalid JSON in <ccm-app> application/json script:", e);
          }
        }

        // Resolve possible ccmjs dependencies in the configuration.
        config = await ccm.helper.solveDependency(config);

        // Start the component instance inside the <ccm-app> element.
        return ccm.start(component, config, element);
      },

      /**
       * Finds the first defined property value in the ancestor chain of an instance.
       *
       * Traverses the current instance and its parent chain to find the first occurrence
       * of a given property that is defined (not `undefined`).
       *
       * This is commonly used to resolve contextual dependencies such as `user` or `lang`
       * from parent components without explicitly passing them through configuration.
       *
       * @param {ccm.types.instance} instance - Starting instance
       * @param {string} prop - Property name to look for
       * @returns {*} First defined property value found in the ancestor chain or `null` if not found.
       *
       * @example
       * // find nearest user instance in ancestor chain
       * const user = ccm.helper.findInAncestors(this, "user");
       */
      findInAncestors: (instance, prop) => {
        let current = instance;
        while (current) {
          // check if property exists and is explicitly defined
          if (Object.prototype.hasOwnProperty.call(current, prop) && current[prop] !== undefined)
            return current[prop];
          current = current.parent;
        }
        return null;
      },

      /**
       * Finds the root instance in the ancestor chain.
       *
       * Traverses the parent chain of the given instance until the top-level
       * instance without a parent is reached.
       *
       * @param {ccm.types.instance} instance - Starting instance
       * @returns {ccm.types.instance} Root instance of the component tree.
       *
       * @example
       * const root = ccm.helper.findRoot(this);
       */
      findRoot: (instance) => {
        while (instance && instance.parent)
          instance = instance.parent;
        return instance;
      },

      /**
       * Generates a unique key based on a UUID without dashes.
       *
       * Uses `crypto.randomUUID()` and removes dashes to produce a compact,
       * URL-safe identifier for contexts where dashes may be problematic.
       *
       * If the generated key starts with a digit, the first character is replaced
       * with `a` to ensure compatibility with contexts that require non-numeric identifiers
       * while preserving a fixed length.
       *
       * @returns {ccm.types.key} Unique identifier with fixed length and URL-safe format.
       *
       * @example
       * console.log(ccm.helper.generateKey()); // => a8acc6ad149047eaa2a89096ecc5a95b
       */
      generateKey: () => {
        let key = crypto.randomUUID().replaceAll("-", "");
        if (/^\d/.test(key)) key = "a" + key.slice(1); // ensure identifier does not start with a digit
        return key;
      },

      /**
       * Integrates priority data into a dataset.
       *
       * Properties in the priority data overwrite properties of the same name
       * in the dataset. Dot notation is supported for nested paths.
       *
       * A value of `undefined` removes the corresponding property.
       *
       * Uses `ccm.helper.deepValue()` internally.
       * Mutates the given dataset.
       *
       * If no valid priority data object is provided, the dataset is returned unchanged.
       * If no valid dataset object is provided, the priority data is returned.
       *
       * @param {Object} [priodata] - Priority data
       * @param {Object} [dataset] - Dataset
       * @returns {Object} Dataset with integrated priority data.
       *
       * @example
       * const result = ccm.helper.integrate(
       *   { lastname: "Done", fullname: undefined },
       *   { firstname: "John", lastname: "Doe", fullname: "John Doe" }
       * );
       * console.log(result);
       * // => { firstname: "John", lastname: "Done" }
       *
       * @example
       * const result = ccm.helper.integrate(
       *   { "foo.c": "z" },
       *   { foo: { a: "x", b: "y" } }
       * );
       * console.log(result);
       * // => { foo: { a: "x", b: "y", c: "z" } }
       */
      integrate: (priodata, dataset) => {
        if (!ccm.helper.isObject(priodata)) return dataset;
        if (!ccm.helper.isObject(dataset)) return priodata;
        for (const key in priodata)
          ccm.helper.deepValue(dataset, key, priodata[key]);
        return dataset;
      },

      /**
       * Checks whether a value is a valid ccmjs component object.
       *
       * A component object is defined as an object that provides:
       * - a non-empty string `name`
       * - a `ccm` reference (framework URL or core object)
       * - a default `config` object
       * - an `Instance` constructor function
       *
       * This function performs a structural validation only.
       * It does not guarantee that the component is fully functional.
       *
       * @param {*} value - Value to check
       * @returns {boolean}
       *
       * @example
       * ccm.helper.isComponent({
       *   name: "quiz",
       *   ccm: "https://ccmjs.github.io/framework/ccm.js",
       *   config: {},
       *   Instance: function () {}
       * }); // => true
       *
       * @example
       * ccm.helper.isComponent(null); // => false
       */
      isComponent: (value) => (
          ccm.helper.isObject(value) &&
          typeof value.name === "string" && value.name &&
          (typeof value.ccm === "string" || ccm.helper.isFramework(value.ccm)) &&
          ccm.helper.isObject(value.config) &&
          typeof value.Instance === "function"
      ),

      /**
       * Checks whether a value is a valid ccmjs dataset.
       *
       * A dataset is a JavaScript object that contains a valid `key` property.
       * Additional properties are allowed.
       *
       * The `key` must be a valid ccmjs key as defined by `ccm.helper.isKey()`.
       *
       * @param {*} value - Value to check
       * @returns {boolean}
       *
       * @example
       * ccm.helper.isDataset({ key: "task1" }); // => true
       *
       * @example
       * ccm.helper.isDataset({ key: ["app", "user"] }); // => true
       *
       * @example
       * ccm.helper.isDataset({ key: "_invalid" }); // => false
       *
       * @example
       * ccm.helper.isDataset(null); // => false
       */
      isDataset: (value) => (
          ccm.helper.isObject(value) &&
          ccm.helper.isKey(value.key)
      ),

      /**
       * Checks whether a value is a ccmjs dependency.
       *
       * A dependency is defined as an array whose first element is a string
       * starting with "ccm." and representing a framework method.
       *
       * This function performs a structural check only and does not validate
       * the arguments or the existence of the referenced method.
       *
       * @param {*} value - Value to check
       * @returns {boolean}
       *
       * @example
       * ccm.helper.isDependency(["ccm.load", "./file.json"]); // => true
       *
       * @example
       * ccm.helper.isDependency(["ccm.get", { name: "tasks" }, "task1"]); // => true
       *
       * @example
       * ccm.helper.isDependency(null); // => false
       */
      isDependency: (value) => (
          Array.isArray(value) &&
          typeof value[0] === "string" &&
          value[0].startsWith("ccm.")
      ),

      /**
       * Checks whether a value is a ccmjs framework instance.
       *
       * A framework instance provides the core API of ccmjs, including
       * functions for component loading, instance creation and datastore access.
       *
       * This check is structural and verifies the presence of essential API methods.
       * It does not guarantee that the framework is fully functional.
       *
       * @param {*} value - Value to check
       * @returns {boolean} True if value is a ccmjs framework instance.
       */
      isFramework: (value) => (
          ccm.helper.isObject(value) &&
          typeof value.component === "function" &&
          typeof value.instance === "function" &&
          typeof value.start === "function" &&
          typeof value.store === "function" &&
          typeof value.get === "function" &&
          ccm.helper.isObject(value.helper)
      ),

      /**
       * Checks whether a value is a ccmjs component instance.
       *
       * A component instance is an object created by the ccmjs framework
       * that represents a running component with its own state and lifecycle.
       *
       * This check is structural and verifies the presence
       * of essential instance properties and methods.
       *
       * @param {*} value - Value to check
       * @returns {boolean}
       *
       * @example
       * const instance = await ccm.start("./ccm.quiz.mjs");
       * ccm.helper.isInstance(instance); // => true
       *
       * @example
       * ccm.helper.isInstance(null); // => false
       */
      isInstance: (value) => (
          ccm.helper.isObject(value) &&
          typeof value.start === "function" &&
          ccm.helper.isObject(value.component) &&
          ccm.helper.isFramework(value.ccm)
      ),

      /**
       * Checks whether a value is a valid ccmjs key.
       *
       * A valid key is either:
       * - a string that matches the ccmjs key pattern, or
       * - a non-empty array of such strings (compound key)
       *
       * The key pattern is defined as:
       * - starts with a lowercase letter
       * - followed by lowercase letters, digits or underscores
       * - maximum length of 32 characters
       *
       * @param {*} value - Value to check.
       * @returns {boolean}
       *
       * @example
       * ccm.helper.isKey("task1"); // => true
       *
       * @example
       * ccm.helper.isKey(["app1", "user1"]); // => true
       *
       * @example
       * ccm.helper.isKey("_internal"); // => false
       *
       * @example
       * ccm.helper.isKey("1abc"); // => false
       */
      isKey: (value) => {
        const KEY_REGEX = /^[a-z][a-z0-9_]{0,31}$/;

        // single key
        if (typeof value === "string") {
          return KEY_REGEX.test(value);
        }

        // compound key (array)
        if (Array.isArray(value) && value.length) {
          return value.every(k => typeof k === "string" && KEY_REGEX.test(k));
        }

        return false;
      },

      /**
       * Checks whether a value should not be cloned.
       *
       * Non-cloneable values include browser-specific objects and ccmjs runtime
       * objects that must be passed by reference to preserve their identity
       * and behavior.
       *
       * @param {*} value - Value to check.
       * @returns {boolean} True if value should not be cloned.
       *
       * @example
       * ccm.helper.isNonCloneable(window); // => true
       *
       * @example
       * ccm.helper.isNonCloneable({}); // => false
       */
      isNonCloneable: (value) => (
          value === window ||
          value === document ||
          (typeof Node !== "undefined" && value instanceof Node) ||
          ccm.helper.isFramework(value) ||
          ccm.helper.isInstance(value) ||
          ccm.helper.isStore(value)
      ),

      /**
       * Checks whether a value is an object (excluding arrays and `null`).
       *
       * This includes plain objects as well as objects created via constructors.
       * Arrays and `null` are explicitly excluded.
       *
       * @param {*} value - Value to check
       * @returns {boolean}
       *
       * @example
       * ccm.helper.isObject({}); // => true
       *
       * @example
       * ccm.helper.isObject([]); // => false
       *
       * @example
       * ccm.helper.isObject(null); // => false
       */
      isObject: (value) => (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value)
      ),

      /**
       * Checks whether a value is a ccmjs datastore accessor (store).
       *
       * A store provides a unified API for accessing datasets
       * and must implement the standard datastore methods.
       *
       * This check is structural and verifies the presence of required methods.
       *
       * @param {*} value - Value to check
       * @returns {boolean}
       */
      isStore: (value) => (
          ccm.helper.isObject(value) &&
          typeof value.get === "function" &&
          typeof value.set === "function" &&
          typeof value.del === "function" &&
          typeof value.count === "function" &&
          typeof value.clear === "function"
      ),

      /**
       * Maps values from one object structure to another.
       *
       * The mapper can either be:
       *
       * 1) A mapping object that defines how values should be copied
       *    between object paths.
       *
       *    Example:
       *
       *    mapObject(source, {
       *      "user.name": "player.username",
       *      "user.score": "player.points"
       *    })
       *
       * 2) A mapping function that receives the source object and
       *    returns a transformed object.
       *
       *    Example:
       *
       *    mapObject(source, config => ({
       *      username: config.user.name,
       *      points: config.user.score
       *    }))
       *
       * The original object is not modified. A new object is returned.
       *
       * @param {Object} source - Source object
       * @param {Object|Function} mapper - Mapping object or mapping function
       * @returns {Object} New mapped object
       */
      mapObject: (source, mapper) => {

        // If mapper is a function, delegate transformation to it
        if (typeof mapper === "function")
          return mapper(source);

        // If mapper is not an object, return source unchanged
        if (!ccm.helper.isObject(mapper))
          return source;

        const result = {};

        // Apply path-based mapping
        for (const from in mapper) {
          const value = ccm.helper.deepValue(source, from);
          if (value !== undefined)
            ccm.helper.deepValue(result, mapper[from], value);
        }

        return result;
      },

      /**
       * Parses a ccmjs component URL and extracts component metadata.
       *
       * Supported filename patterns:
       *
       * - ccm.<name>.mjs
       * - ccm.<name>.min.mjs
       * - ccm.<name>-<version>.mjs
       * - ccm.<name>-<version>.min.mjs
       *
       * Example:
       *
       * https://example.com/lib/ccm.quiz-4.0.0.min.mjs#sha256-ABC
       *
       * Result:
       * ```
       * {
       *   url: "https://example.com/lib/ccm.quiz-4.0.0.min.mjs",
       *   filename: "ccm.quiz-4.0.0.min.mjs",
       *   sri: "sha256-ABC",
       *   name: "quiz",
       *   version: "4.0.0",
       *   minified: true,
       *   index: "quiz-4-0-0"
       * }
       * ```
       *
       * @param {string} url - URL of the ccmjs component
       * @returns {Object} Parsed component metadata.
       */
      parseComponentURL: (url) => {

        // Extract optional Subresource Integrity hash
        const [baseURL, sri] = url.split("#");

        // Extract filename
        const filename = baseURL.split("/").at(-1);

        // Validate filename
        if (!ccm.helper.regex("filename").test(filename))
          throw new Error("invalid component filename: " + filename);

        const result = {
          url: baseURL,
          filename
        };

        if (sri) result.sri = sri;

        // Remove prefix "ccm." and suffix ".mjs". Example: ccm.quiz-4.0.0.min.mjs → quiz-4.0.0.min
        let namePart = filename
            .replace(/^ccm\./, "")
            .replace(/\.(m?js)$/, "")

        // Detect minified builds
        if (namePart.endsWith(".min")) {
          result.minified = true;
          namePart = namePart.slice(0, -4);
        }

        // Extract name and optional version. Example: quiz-4.0.0 → name="quiz", version="4.0.0"
        const [name, version] = namePart.split("-");
        result.name = name;
        if (version) result.version = version;

        // Generate component index. Example: quiz-4.0.0 → quiz-4-0-0
        result.index = name + (version ? "-" + version.replace(/\./g, "-") : "");

        return result;
      },



      /**
       * checks if an object is a subset of another object
       * @param {Object} obj - object
       * @param {Object} other - another object
       * @returns {boolean}
       * @example
       * const obj = {
       *   name: 'John Doe',
       *   counter: 3,
       *   isValid: true,
       *   x: { y: 'z' },                 // check of inner object
       *   'values.1': 123,               // check of deeper array value
       *   'settings.title': 'Welcome!',  // check of deeper object value
       *   onLoad: true,                  // checks for truthy (is not falsy)
       *   search: '/foo,bar,baz/',       // checks with regular expression
       *   title: null                    // checks if property does not exist
       * };
       * const other = {
       *   name: 'John Doe',
       *   counter: 3,
       *   isValid: true,
       *   x: { y: 'z' },
       *   values: [ 'abc', 123, false ],
       *   settings: { title: 'Welcome!', year: 2017, greedy: true },
       *   onLoad: function () { console.log( 'Loading..' ); },
       *   search: 'foo,bar,baz'
       * };
       * const result = isSubset( obj, other );
       * console.log( result );  // => true
       */
      isSubset(obj, other) {
        for (const key in obj)
          if (obj[key] === null) {
            if (other[key] !== undefined) return false;
          } else if (obj[key] === true) {
            if (!other[key]) return false;
          } else if (
            typeof obj[key] === "string" &&
            obj[key].startsWith("/") &&
            obj[key].endsWith("/")
          ) {
            if (
              !new RegExp(obj[key].slice(1, -1)).test(
                other[key] && typeof other[key] === "object"
                  ? other[key].toString()
                  : other[key],
              )
            )
              return false;
          } else if (
            typeof obj[key] === "object" &&
            typeof other[key] === "object"
          ) {
            if (JSON.stringify(obj[key]) !== JSON.stringify(other[key]))
              return false;
          } else if (key.includes(".")) {
            if (ccm.helper.deepValue(other, key) !== obj[key]) return false;
          } else if (obj[key] !== other[key]) return false;
        return true;
      },

      /**
       * returns the ccmjs loading icon
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
       * @summary Prepares a configuration object by resolving dependencies and integrating defaults.
       * @description
       * This function processes a given configuration object by:
       * 1. Automatically resolving the configuration if it is given as a CCM dependency (e.g. ['ccm.load', ...] or ['ccm.get', ...]).
       * 2. Recursively resolving and integrating nested configurations, if present.
       * 3. Integrating the provided defaults into the final configuration.
       * 4. Removing the reserved `ccm` property from the resulting configuration.
       *
       * @param {Object} [config={}] - The initial configuration to process.
       * @param {Object} [defaults={}] - Default values to integrate into the configuration.
       * @returns {Promise<Object>} A promise that resolves to the prepared configuration object.
       */
      prepareConfig: async (config = {}, defaults = {}) => {
        // Is the configuration given as CCM dependency? => Resolve it first.
        config = await ccm.helper.solveDependency(config);

        // Recursively resolve and integrate nested configurations.
        if (config.config) {
          let base = await ccm.helper.prepareConfig(config.config);
          delete config.config;
          config = await ccm.helper.integrate(config, base);
        }

        // Integrate defaults into the configuration.
        const result = await ccm.helper.integrate(config, defaults);

        // Remove reserved `ccm` property from the resulting configuration.
        delete result.ccm;

        return result;
      },

      /**
       * @summary Provides a ccmjs-relevant regular expression.
       * @description
       * Possible index values, it's meanings, and it's associated regular expressions:
       * <table>
       *   <tr>
       *     <th>index</th>
       *     <th>meaning</th>
       *     <th>regular expression</th>
       *   </tr>
       *   <tr>
       *     <td><code>'filename'</code></td>
       *     <td>filename for a ccmjs instance</td>
       *     <td>/^(ccm.)?([^.-]+)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.mjs)$/</td>
       *   </tr>
       *   <tr>
       *     <td><code>'key'</code></td>
       *     <td>key for a ccmjs dataset</td>
       *     <td>/^[a-z_0-9][a-zA-Z_0-9]*$/</td>
       *   </tr>
       * </table>
       * @param {string} index - index of the regular expression
       * @returns {RegExp} RegExp Object
       * @example
       * // test if a given string is a valid filename for an ccm component
       * var string = 'ccm.dummy-3.2.1.min.mjs';
       * var result = ccm.helper.regex( 'filename' ).test( string );
       * console.log( result );  // => true
       * @example
       * // test if a given string is a valid key for a ccm dataset
       * var string = 'dummy12_Foo3';
       * var result = ccm.helper.regex( 'key' ).test( string );
       * console.log( result );  // => true
       */
      regex: (index) => {
        switch (index) {
          case "filename":
            return /^ccm\.([a-z][a-z_0-9]*)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.m?js)$/;
            // oder das hier? -> ^ccm\.[a-z][a-z0-9_-]*(?:-\d+\.\d+\.\d+)?(?:\.min)?\.mjs$
          case "key":
            return /^[a-z_][a-z0-9_]{0,31}$/;
          default:
            throw new Error(`Unknown regex index: ${index}`);
        }
      },

      /**
       * @summary Runs a query on objects and returns the results. If you want a deep copy, then call ccm.helper.clone for the results.
       * @param {Object} query
       * @param {Object[]|Object.<String,Object>} objects
       * @returns {Object[]}
       */
      runQuery: (query, objects) => {
        const results = [];
        for (const key in objects)
          ccm.helper.isSubset(query, objects[key]) &&
            results.push(objects[key]);
        return results;
      },

      /**
       * @summary solves ccmjs dependencies contained in an array or object
       * @param {Array|Object} obj - array or object
       * @param {ccm.types.instance} [instance] - associated ccmjs instance
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
            if (ccm.helper.isNonCloneable(obj)) return;
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
       * @param {ccm.types.instance} [instance] - associated ccmjs instance
       * @returns {Promise<*>}
       */
      solveDependency: async (dependency, instance) => {
        // the given value is no ccm dependency? => the result is the given value
        if (!ccm.helper.isDependency(dependency)) return dependency;

        /**
         * ccm operation to be performed
         * @type {string}
         */
        const operation = dependency.shift().substring("ccm.".length);

        // solve dependency
        switch (operation) {
          case "load":
            instance && setContext(dependency);
            break;
          case "component":
          case "instance":
          case "start":
            dependency[1] = await ccm.helper.solveDependency(dependency[1]);
            if (!dependency[1]) dependency[1] = {};
            if (instance) dependency[1].parent = instance;
            break;
          case "store":
          case "get":
            if (!dependency[0]) dependency[0] = {};
            if (instance) dependency[0].parent = instance;
        }
        return ccm[operation].apply(null, dependency);

        /**
         * The resources are automatically loaded in the shadow root of the associated ccm instance.
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
              ccm.helper.isNonCloneable(value)
            )
              value = null;
            return replacer ? replacer(key, value) : value;
          },
          space,
        ),
    },
  };

  // Check if this is the first ccmjs version loaded on the web page.
  if (!window.ccm) {
    // Initialize the global `ccm` namespace.
    window.ccm = ccm;

    // Define the `<ccm-app>` custom element if not already defined.
    if ("customElements" in window && !customElements.get("ccm-app")) {
      window.customElements.define(
        "ccm-app",
        class extends HTMLElement {
          /**
           * Handles the connection of the `<ccm-app>` element to the DOM.
           *
           * This lifecycle method is called when the `<ccm-app>` element
           * is inserted into the document. It starts the referenced ccmjs
           * component inside the element and ensures that it is only
           * embedded once.
           */
          async connectedCallback() {

            // prevent multiple starts
            if (this.firstChild) return;

            // embed component
            await ccm.helper.embed(this);
          }
        },
      );
    }
  }

  // Initialize the namespace for the current ccmjs version.
  if (!window.ccm[ccm.version]) {
    window.ccm[ccm.version] = ccm; // Set version-specific namespace.
    ccm.components = {}; // Initialize the global namespace for loaded components.
  }

  /**
   * @description
   * A private object that stores all registered components for the current version of ccmjs.
   * Each component is indexed by its unique identifier.
   *
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.types.component_index, ccm.types.component_obj>}
   */
  const _components = {};

  /**
   * When a requested component uses another ccmjs version.
   * This function performs the method call in the other ccmjs version.
   *
   * @param {number} version - Major number of the necessary ccmjs version
   * @param {string} method - Name of the method to be called ('component', 'instance' or 'start')
   * @param {ccm.types.component_obj|string} component - Object, index or URL of the component
   * @param {ccm.types.config} config - Priority data for instance configuration
   * @param {Element} [element] - Web page area where the component will be embedded (default: on-the-fly <div>).
   * @returns {Promise<ccm.types.component|ccm.types.instance>} Promise that resolves to the created component or instance.
   */
  async function backwardsCompatibility(
    version,
    method,
    component,
    config,
    element,
  ) {
    return new Promise((resolve, reject) => {
      const major = parseInt(version.split(".")[0]);
      window.ccm[version][method](
        component,
        config,
        major < 18 ? resolve : element,
      ) // before version 18, callbacks were used instead of promises (and there was no 3rd parameter for ccm.instance and ccm.start)
        ?.then(resolve)
        .catch(reject);
    });
  }

  /**
   * Abstract base class for datastore accessors in ccmjs.
   *
   * Defines the asynchronous data access API used by all datastore implementations.
   *
   * Concrete subclasses implement the actual persistence strategy:
   * - {@link InMemoryStore} – volatile in-memory storage
   * - {@link OfflineStore}  – browser-based persistence (IndexedDB)
   * - {@link RemoteStore}   – remote server persistence via HTTP/WebSocket
   *
   * Design contract:
   * - All methods are asynchronous and return Promises.
   * - Each dataset must contain a unique `key`.
   * - `get(key)` resolves to a dataset or `null`.
   * - `get(query)` resolves to an array (possibly empty).
   * - `set()` creates or updates a dataset.
   * - `del()` resolves to the deleted dataset or `null`.
   *
   * Subclasses may provide additional capabilities such as:
   * - `names()`            – list available stores
   * - `dbs()`              – list available databases
   * - `connect()`          – establish a live connection (RemoteStore)
   * - `close()`            – close active connections
   *
   * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Data-Management}
   * to learn more about data management in ccmjs.
   *
   * @class Datastore
   * @abstract
   */
  class Datastore {
    /**
     * Initializes the datastore accessor.
     *
     * @description
     * Called once during setup by {@link ccm.store}.
     * Subclasses may override this method to perform initialization logic
     * such as opening database connections or preparing internal state.
     *
     * After initialization, this method removes itself to prevent accidental re-initialization.
     *
     * @returns {Promise<void>}
     */
    async init() {
      this.init = undefined;
    }

    /**
     * Removes all datasets from this datastore.
     *
     * The default implementation retrieves all datasets via `get()`
     * and deletes them individually via `del()`.
     *
     * Subclasses may override this method for more efficient
     * storage-specific implementations.
     *
     * Errors during deletion are logged but do not interrupt the process.
     *
     * @returns {Promise<void>}
     */
    async clear() {
      const datasets = await this.get();
      const results = await Promise.allSettled(
        datasets.map((dataset) => this.del(dataset.key)),
      );
      results.forEach((res, i) => {
        if (res.status === "rejected") {
          console.error("Failed to delete dataset", datasets[i], res.reason);
        }
      });
    }

    /**
     * Returns metadata describing the datastore source.
     *
     * Provides identifying information about the underlying storage.
     * Mainly useful for debugging, logging, or remote synchronization.
     *
     * @returns {{name?: string, url?: string, db?: string}}
     */
    source() {
      return { name: this.name, url: this.url, db: this.db };
    }

    /**
     * Validates that a given value is a valid dataset key.
     *
     * Throws an error if the value does not satisfy the key constraints defined by {@link ccm.helper.isKey}.
     *
     * @param {*} key - Value to validate as dataset key.
     * @throws {Error} If the key is invalid.
     * @protected
     */
    _checkKey(key) {
      if (!ccm.helper.isKey(key))
        throw new Error(`Invalid dataset key: ${JSON.stringify(key)}`);
    }
  }

  /**
   * Volatile in-memory datastore implementation.
   *
   * Stores all datasets in a plain JavaScript object within the current runtime environment.
   * Data exists only for the lifetime of the page and is lost on reload.
   * Each instance operates independently and does not share state with other InMemoryStore instances.
   *
   * Characteristics:
   * - Fully compliant with the Datastore contract.
   * - No persistence beyond the current runtime.
   * - No external dependencies.
   * - Internal state is protected by returning cloned datasets.
   *
   * Typical use cases:
   * - Temporary application state
   * - Testing and development
   * - Declarative default datasets
   *
   * @class InMemoryStore
   * @extends Datastore
   * @example
   * const store = await ccm.store({
   *   datasets: [
   *     { key: "a", value: 1 },
   *     { key: "b", value: 2 }
   *   ]
   * });
   *
   * const data = await store.get("a"); // { key: "a", value: 1 }
   */
  class InMemoryStore extends Datastore {

    /**
     * Initializes the in-memory store.
     *
     * Resolves potential dataset dependencies, normalizes the internal
     * dataset structure, and prepares the internal key–dataset map.
     *
     * If no datasets are provided, an empty store is created.
     *
     * @returns {Promise<void>}
     */
    async init() {
      super.init();
      if (!this.datasets) this.datasets = {};
      this.datasets = await ccm.helper.solveDependency(this.datasets);
      this.datasets = ccm.helper.datasetsToStore(this.datasets);
    }

    /**
     * Retrieves one or multiple datasets from memory.
     *
     * - If a key is provided, resolves to the matching dataset or `null`.
     * - If a query object is provided, resolves to an array of matching datasets.
     *
     * Returned datasets are cloned to prevent external mutation of
     * the internal store state.
     *
     * @param {ccm.types.key|Object} [key_or_query={}] - Dataset key or query object. Defaults to `{}` which returns all datasets.
     * @returns {Promise<ccm.types.dataset|null|ccm.types.dataset[]>} Promise that resolves to the requested dataset(s).
     */
    async get(key_or_query = {}) {
      let result;

      if (ccm.helper.isObject(key_or_query))
        result = ccm.helper.runQuery(key_or_query, this.datasets);
      else {
        this._checkKey(key_or_query);
        result = this.datasets[key_or_query] || null;
      }

      return ccm.helper.clone(result);
    }

    /**
     * Creates or updates a dataset in memory.
     *
     * - Generates a key if none is provided.
     * - Updates existing datasets by integrating new properties.
     * - Creates a new dataset if the key does not exist.
     *
     * The returned dataset is a cloned copy of the stored data.
     *
     * @param {ccm.types.dataset} priodata - Dataset to create or update.
     * @returns {Promise<ccm.types.dataset>} A promise that resolves to the created or updated dataset.
     */
    async set(priodata) {
      if (!priodata.key) priodata.key = ccm.helper.generateKey();

      this._checkKey(priodata.key);

      // Integrate with existing dataset if it exists, otherwise create new entry
      const existing = this.datasets[priodata.key];
      this.datasets[priodata.key] = existing
          ? await ccm.helper.integrate(priodata, existing)
          : ccm.helper.clone(priodata);

      return ccm.helper.clone(this.datasets[priodata.key]);
    }

    /**
     * Deletes a dataset from memory.
     *
     * Resolves to the deleted dataset or `null` if no dataset with the given key existed.
     * The returned dataset is a cloned copy.
     *
     * @param {ccm.types.key} key - Dataset key
     * @returns {Promise<ccm.types.dataset|null>} A promise that resolves to the deleted dataset or `null` if it did not exist.
     */
    async del(key) {
      this._checkKey(key);
      const dataset = this.datasets[key];
      delete this.datasets[key];
      return ccm.helper.clone(dataset) || null;
    }

    /**
     * Removes all datasets from the in-memory store.
     *
     * Resets the internal dataset map to an empty object.
     *
     * @returns {Promise<void>}
     */
    async clear() {
      this.datasets = {};
    }

    /**
     * Counts datasets matching a query.
     *
     * @param {Object} [query={}] - Query object. Defaults to `{}` which counts all datasets.
     * @returns {Promise<number>} Resolves to the number of datasets matching the query.
     */
    async count(query = {}) {
      return ccm.helper.runQuery(query, this.datasets).length;
    }
  }

  /**
   * Browser-based persistent datastore using IndexedDB.
   *
   * Persists datasets locally in the browser via IndexedDB.
   * Each store corresponds to an IndexedDB object store within a shared database namespace.
   *
   * Characteristics:
   * - Fully compliant with the Datastore contract.
   * - Persistent across page reloads.
   * - Operates entirely client-side.
   * - Uses the dataset `key` as IndexedDB keyPath.
   *
   * Each instance connects to a named object store within the internal IndexedDB database.
   *
   * @class OfflineStore
   * @extends Datastore
   */
  class OfflineStore extends Datastore {

    /**
     * Name of the internal IndexedDB database used for storage.
     * @type {string}
     */
    dbName = "ccm";

    /**
     * Reference to the opened IndexedDB database connection.
     * @type {IDBDatabase}
     */
    database;

    /**
     * Initializes the IndexedDB connection and object store.
     *
     * Opens (or upgrades) the internal IndexedDB database.
     * If the configured object store does not exist, it is created via a version upgrade.
     *
     * @returns {Promise<void>}
     */
    async init() {

      super.init();

      // Open database to inspect existing object stores
      const db = await this.#pReq(indexedDB.open(this.dbName));

      // If store already exists, use the connection directly
      if (db.objectStoreNames.contains(this.name)) {
        this.#setupDatabase(db);
        return;
      }

      // Otherwise upgrade database version to create the object store
      const newVersion = db.version + 1;
      db.close();

      const request = indexedDB.open(this.dbName, newVersion);
      let upgradeComplete;

      request.onupgradeneeded = event => {
        const upgradeDB = event.target.result;
        const tx = event.target.transaction;

        if (!upgradeDB.objectStoreNames.contains(this.name))
          upgradeDB.createObjectStore(this.name, { keyPath: "key" });

        // Ensure upgrade transaction finishes before continuing
        upgradeComplete = new Promise(resolve => tx.oncomplete = resolve);
      };

      const upgradedDB = await this.#pReq(request);
      if (upgradeComplete) await upgradeComplete;
      this.#setupDatabase(upgradedDB);
    }

    /**
     * Retrieves one or multiple datasets from IndexedDB.
     *
     * - If a key is provided, resolves to the matching dataset or `null`.
     * - If a query object is provided, retrieves all datasets and filters them in memory.
     *
     * @param {ccm.types.key|Object} [key_or_query={}] - Dataset key or query object. Defaults to `{}` which returns all datasets.
     * @returns {Promise<ccm.types.dataset|null|ccm.types.dataset[]>}
     */
    async get(key_or_query = {}) {
      if (ccm.helper.isObject(key_or_query))
        return ccm.helper.runQuery(key_or_query, await this.#pReq(this.#getStore().getAll()));
      this._checkKey(key_or_query);
      return (await this.#pReq(this.#getStore().get(key_or_query))) || null;
    }

    /**
     * Creates or updates a dataset in IndexedDB.
     *
     * - Generates a key if none is provided.
     * - Integrates updates into existing datasets.
     * - Persists the result via a readwrite transaction.
     *
     * @param {ccm.types.dataset} priodata - Dataset to create or update
     * @returns {Promise<ccm.types.dataset>} Resolves to the created or updated dataset.
     */
    async set(priodata) {
      if (!priodata.key) priodata.key = ccm.helper.generateKey();
      this._checkKey(priodata.key);
      let dataset = await this.get(priodata.key);
      dataset = dataset ? await ccm.helper.integrate(priodata, dataset) : priodata;
      await this.#pReq(this.#getStore("readwrite").put(dataset));
      return dataset;
    }

    /**
     * Deletes a dataset from IndexedDB.
     *
     * Removes the dataset and resolves to the deleted dataset or `null` if none existed.
     *
     * @param {ccm.types.key} key - Dataset key
     * @returns {Promise<ccm.types.dataset|null>}
     */
    async del(key) {
      this._checkKey(key);
      const dataset = await this.get(key);
      await this.#pReq(this.#getStore("readwrite").delete(key));
      return dataset || null;
    }

    /**
     * Removes all datasets from this object store.
     *
     * Deletes all datasets in the store.
     *
     * @returns {Promise<void>}
     */
    async clear() {
      await this.#pReq(this.#getStore("readwrite").clear());
    }

    /**
     * Counts datasets matching a query.
     *
     * @param {Object} [query={}] - Query object. Defaults to `{}` which counts all datasets.
     * @returns {Promise<number>}
     */
    async count(query = {}) {
      return ccm.helper.runQuery(query, await this.#pReq(this.#getStore().getAll())).length;
    }

    /**
     * Lists available object store names within the database.
     *
     * @returns {Promise<string[]>}
     */
    async names() {
      return Array.from(this.database?.objectStoreNames || []);
    }

    /**
     * Returns an IndexedDB object store transaction.
     *
     * @param {"readonly"|"readwrite"} [mode="readonly"] - Transaction mode
     * @returns {IDBObjectStore}
     * @private
     */
    #getStore(mode = "readonly") {
      if (!this.database)
        throw new Error("OfflineStore not initialized.");
      const tx = this.database.transaction(this.name, mode);
      return tx.objectStore(this.name);
    }

    /**
     * Wraps an IndexedDB request in a Promise.
     *
     * @param {IDBRequest} request
     * @returns {Promise<any>}
     * @private
     */
    #pReq(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
        request.onblocked = () => {
          console.warn(
              `[IndexedDB] Open request blocked for '${this.dbName}'. Close other tabs using this database.`
          );
        };
      });
    }

    /**
     * Configures database lifecycle handlers.
     *
     * @param {IDBDatabase} db
     * @private
     */
    #setupDatabase(db) {
      db.onversionchange = () => {
        console.warn(`[IndexedDB] Database '${this.dbName}' version change detected. Closing connection.`);
        db.close();
      };
      db.onclose = () => {
        console.log(`[IndexedDB] Database '${this.dbName}' connection closed.`);
      };
      this.database = db;
    }
  }

  /**
   * Remote datastore implementation that communicates with a server.
   *
   * Provides persistent data access via HTTP(S) requests and optional
   * realtime updates via WebSocket connections.
   *
   * The server endpoint must implement the ccmjs datastore API and
   * accept JSON-based requests for operations such as `get`, `set`,
   * `del`, and `count`.
   *
   * Characteristics:
   * - Fully compliant with the Datastore contract.
   * - Persistence is handled by a remote server.
   * - Supports authentication via a CCM user instance or explicit token.
   * - Optional realtime updates using WebSockets (`observe` + `onchange`).
   *
   * @class RemoteStore
   * @extends Datastore
   */
  class RemoteStore extends Datastore {

    /**
     * Initializes the remote datastore connection.
     *
     * - Resolves the user instance from the component hierarchy.
     * - Establishes a WebSocket connection if realtime observation is enabled.
     *
     * @returns {Promise<void>}
     */
    async init() {
      super.init();

      // Look for a user instance in parent components for authentication
      this.user = ccm.helper.findInAncestors(this, "user");

      // Enable realtime updates if observe query is provided and WebSockets are supported
      if (this.observe && window.WebSocket) {
        if (!this.onchange && this.parent) this.onchange = this.parent.start;
        this.connect();
      }
    }

    /**
     * Retrieves one or multiple datasets from the remote datastore.
     *
     * - If a key is provided, resolves to the matching dataset or `null`.
     * - If a query object is provided, resolves to an array of matching datasets.
     *
     * Optional `projection` and `options` parameters correspond to MongoDB-style
     * query extensions and are forwarded directly to the server.
     *
     * @param {ccm.types.key|Object} [key_or_query={}] - Dataset key or query object
     * @param {Object} [projection] - Fields to include or exclude
     * @param {Object} [options] - Additional query options (e.g. sort, limit)
     * @returns {Promise<ccm.types.dataset|ccm.types.dataset[]>}
     */
    async get(key_or_query = {}, projection, options) {
      if (!ccm.helper.isObject(key_or_query)) this._checkKey(key_or_query);

      const params = { get: key_or_query };

      // Forward optional query modifiers to the server
      if (projection) params.projection = projection;
      if (options) params.options = options;

      return this.#send(params);
    }

    /**
     * Creates or updates a dataset on the remote server.
     *
     * Generates a key if none is provided and forwards the dataset to the server.
     *
     * @param {ccm.types.dataset} priodata - Dataset to create or update
     * @returns {Promise<ccm.types.dataset>}
     */
    async set(priodata) {
      if (!priodata.key) priodata.key = ccm.helper.generateKey();
      this._checkKey(priodata.key);

      return this.#send({ set: priodata });
    }

    /**
     * Deletes a dataset from the remote datastore.
     *
     * @param {ccm.types.key} key - Dataset key
     * @returns {Promise<ccm.types.dataset|null>}
     */
    async del(key) {
      this._checkKey(key);
      return this.#send({ del: key });
    }

    /**
     * Counts datasets matching a query.
     *
     * @param {Object} [query={}] - Query object
     * @returns {Promise<number>}
     */
    async count(query = {}) {
      return this.#send({ count: query });
    }

    /**
     * Lists available datastore names in the current database.
     *
     * @returns {Promise<string[]>}
     */
    async names() {
      return this.#send({ names: this.db });
    }

    /**
     * Lists available databases on the server.
     *
     * @returns {Promise<string[]>}
     */
    async dbs() {
      return this.#send({ names: "dbs" });
    }

    /**
     * Sends a request to the remote datastore server.
     *
     * Automatically attaches:
     * - framework version (`ccm`)
     * - database identifier (`db`)
     * - store name (`store`)
     * - authentication token (if available)
     *
     * Handles authentication errors by attempting automatic re-login.
     *
     * @param {Object} [params={}] - Request parameters
     * @returns {Promise<any>}
     * @private
     */
    async #send(params = {}) {

      // Attach framework version for compatibility checks
      params.ccm = this.ccm || ccm.version;

      // Attach database and store identifiers
      params.db = this.db || "";
      params.store = this.name;

      // Attach authentication token if available
      if (this.user?.isLoggedIn()) params.token = this.user.getState().token;
      if (this.token) params.token = this.token;

      try {
        return await ccm.load({ url: this.url, params });
      } catch (e) {
        // Handle authentication errors by retrying login
        if (this.user && (e.status === 401 || e.status === 403)) {
          try {
            await this.user.logout();
            await this.user.login();
            params.token = this.user.getState().token;
            return await ccm.load({ url: this.url, params });
          } catch (e) {
            // If login fails, restart the root component
            if (this.parent) await ccm.helper.findRoot(this).start();
            else throw e;
          }
        } else throw e;
      }
    }

    /**
     * Establishes a WebSocket connection for realtime datastore updates.
     *
     * The server will push notifications when datasets matching the configured `observe` query change.
     */
    connect() {

      // Convert HTTP endpoint to WebSocket endpoint
      this.socket = new WebSocket(this.url.replace(/^http/, "ws"));

      // Subscribe to datastore observation when connection opens
      this.socket.onopen = () => {
        this.socket.send(
            JSON.stringify({
              db: this.db,
              store: this.name,
              observe: this.observe,
            }),
        );
      };

      // Handle incoming update notifications
      this.socket.onmessage = (message) => {
        try {
          this.onchange && this.onchange(JSON.parse(message.data));
        } catch (e) {
          console.error("Failed to parse WebSocket message:", message.data, e);
        }
      };

      // Log WebSocket errors
      this.socket.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      // Attempt a single automatic reconnect if the connection drops
      this.socket.onclose = (event) => {
        console.warn(
            `WebSocket closed, code=${event.code}, reason=${event.reason}`,
        );
        if (!this._manualClose && !this._reconnectAttempted) {
          this._reconnectAttempted = true;
          this.connect();
        }
      };
    }

    /**
     * Closes the active WebSocket connection.
     */
    close() {
      if (this.socket) {
        this._manualClose = true;
        this.socket.close();
        delete this._manualClose;
        this.socket = null;
      }
    }
  }
}

/**
 * @namespace ccm.types
 * @description ccmjs-specific Type Definitions
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
 * @summary ccmjs dependency
 * @example ["ccm.load", ...]
 * @example ["ccm.component", ...]
 * @example ["ccm.instance", ...]
 * @example ["ccm.start", ...]
 * @example ["ccm.store", ...]
 * @example ["ccm.get", ...]
 */

/**
 * @typedef {Object} ccm.types.ccmjs
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
 * @property {Element|ccm.types.instance} [context] - Context in which the resource is loaded (default is <code>\<head></code>). Only relevant when loading CSS or JavaScript. CSS is loaded via <code>\<link></code> and JavaScript is loaded via <code>\<script></code>. When a [ccmjs instance]{@link ccm.types.instance} is passed, the resource is loaded in the Shadow DOM of that instance.
 * @property {string} [type] - Resource is loaded as <code>'css'</code>, <code>'image'</code>, <code>'js'</code>, <code>'module'</code>, <code>'json'</code> or <code>'xml'</code>. If not specified, the type is automatically recognized by the file extension. If the file extension is unknown, <code>'json'</code> is used by default.
 * @property {string} [attr] - Additional HTML attributes to be set for the HTML tag that loads the resource. Only relevant when loading CSS or JavaScript. CSS is loaded via <code>\<link></code> and JavaScript is loaded via <code>\<script></code>. With the additional attributes <code>integrity</code> and <code>crossorigin</code> the resource can be loaded with Subresource Integrity (SRI).
 * @property {string} [method] - The request method, e.g., <code>"GET"</code>, <code>"POST"</code>. The default is <code>"GET"</code>. Only relevant when loading data. <code>"JSONP"</code> is also supported.
 * @property {Object} [params] - HTTP parameters to send. Only relevant when loading data.
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
