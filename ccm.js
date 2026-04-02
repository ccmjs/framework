"use strict";

/**
 * @overview
 * Provides the ccmjs core framework, including component loading, instance creation, and dependency resolution,
 * and defines the global namespace {@link ccm}.
 *
 * See the {@link https://github.com/ccmjs/framework/wiki ccmjs Wiki} for more information.
 *
 * @author André Kless <andre.kless@web.de> (https://github.com/akless)
 * @copyright 2014–2026 André Kless
 * @license The MIT License (MIT)
 * @version 28.0.0
 */

{
  /**
   * The global ccmjs namespace providing access to the core framework API.
   *
   * @global
   * @namespace
   */
  const ccm = {

    // -----------------------------------------------------------------------------
    // Core API
    // -----------------------------------------------------------------------------

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
            resource.context = resource.context.element.parentElement;

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
           *
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
              case "png":
              case "gif":
              case "svg":
              case "webp":
              case "avif":
              case "apng":
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

            // Extract optional property keys from URL hash.
            let [url, ...keys] = resource.url.split("#");

            // Resolve relative URLs to absolute URLs.
            url = new URL(url, location.href).href;

            let result;

            // Handle SRI verification.
            if (resource.attr?.integrity) {

              // Fetch module source.
              const text = await (await fetch(url)).text();

              // Compute SRI hash.
              const prefix = resource.attr.integrity.slice(
                  0,
                  resource.attr.integrity.indexOf("-")
              );

              const algorithm = prefix.toUpperCase().replace("SHA", "SHA-");
              const data = new TextEncoder().encode(text);
              const hash = await crypto.subtle.digest(algorithm, data);
              const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
              const sri = `${prefix}-${base64}`;

              // Verify integrity.
              if (sri !== resource.attr.integrity) return error();

              // Create blob URL for dynamic import.
              const blobUrl = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
              result = await import(blobUrl);
              URL.revokeObjectURL(blobUrl);
            } else {
              result = await import(url);
            }

            // If only one specific deeper value has to be the result.
            if (keys.length === 1)
              result = ccm.helper.deepValue(result, keys[0]);

            // If multiple properties should be returned.
            if (keys.length > 1) {
              const obj = {};
              keys.forEach(key => obj[key] = result[key]);
              result = obj;
            }

            // Dynamic import returns cached module references → clone to avoid mutation.
            if (ccm.helper.isObject(result))
              result = ccm.helper.clone(result);

            success(result);
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
             * @returns {string} - Generated query string.
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
           * Callback when loading of a resource was successful.
           *
           * Processes the loaded data based on its type (e.g., XML) and updates the results array.
           * Triggers the next step in the loading process.
           *
           * @param {*} data - Loaded resource data
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
           * Callback when loading of a resource failed.
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
     * @param {ccm.types.component_obj|string} component - Component object, index, or URL of the component to register
     * @param {ccm.types.config} [config={}] - Priority data for the component's default instance configuration
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
      component.instance = async (config = {}, area) =>
          ccm.instance(
              component,
              await ccm.helper.prepareConfig(config, component.config),
              area,
          );
      component.start = async (config = {}, area) =>
          ccm.start(
              component,
              await ccm.helper.prepareConfig(config, component.config),
              area,
          );

      return component;

      /**
       * Retrieves the component object via index, URL or directly as JavaScript object.
       *
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
      const loading = ccm.helper.loading();
      area.replaceChildren(loading);

      // Prepare the instance configuration.
      config = await ccm.helper.prepareConfig(config, component.config);

      /**
       * Created ccmjs instance
       * @type {ccm.types.instance}
       */
      const instance = new component.Instance();

      // Set ccmjs-specific properties for the instance.
      instance.ccm = component.ccm; // Reference to the used ccmjs version
      instance.component = component; // Component the instance is created from
      instance.id = ++_components[component.index].instances; // Instance ID. Unique within the component.
      instance.index = component.index + "-" + instance.id; // Instance index. Unique within the web page.
      if (!instance.init) instance.init = async () => {}; // Ensure the instance has an init method.
      instance.children = {}; // Store child instances used by this instance.
      instance.parent = config.parent; // Reference to parent instance
      delete config.parent; // Prevent cyclic recursion when resolving dependencies.
      instance.config = ccm.helper.stringify(config); // Store the original configuration.

      // Add the instance as a child to its parent instance.
      if (instance.parent) instance.parent.children[instance.index] = instance;

      // Create the host element for the instance.
      instance.host = document.createElement("div");

      // Create a shadow root for the instance if required.
      if (config.root !== false)
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

      // Apply configuration mapper if defined.
      const mapper = config.mapper;
      delete config.mapper;
      if (mapper)
        config = ccm.helper.mapObject(config, mapper);

      // Remove reserved properties from the configuration to prevent conflicts with instance properties.
      const reserved = new Set([
        "children", "component", "element",
        "host", "init", "instance",
        "parent", "ready", "root", "start"
      ]);
      for (const key of reserved) {
        if (key in config) {
          console.warn(`[ccmjs] config property '${key}' is reserved and was ignored.`);
          delete config[key];
        }
      }

      // Integrate configuration into instance.
      Object.assign(instance, config);

      // Initialize created and dependent instances if necessary.
      if (!instance.parent?.init) await initialize();

      // Remove loading icon from content element
      loading.remove();

      return instance;

      /**
       * Initializes the created instance and all dependent ccmjs instances.
       *
       * @returns {Promise<void>} A promise that resolves when initialization is complete.
       */
      function initialize() {
        return new Promise((resolve) => {

          /**
           * Stores all found ccmjs instances.
           * @type {ccm.types.instance[]}
           */
          const instances = [instance];

          // Find all sub-instances dependent on the created instance.
          find(instance);

          // Call init methods of all found ccmjs instances.
          let i = 0;
          init();

          /**
           * Finds all dependent ccmjs instances (breadth-first-order, recursive).
           *
           * @param {Array|Object} obj - Array or object to search
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
           * Calls the `init` methods of all ccmjs instances in sequence.
           *
           * This function processes a list of ccmjs instances and calls their `init` methods asynchronously.
           * Once all `init` methods are called, it proceeds to the `ready` method.
           * If an instance does not have an `init` method, it skips to the next instance.
           */
          function init() {

            // If all init methods are called, proceed to ready methods.
            if (i === instances.length) return ready();

            /**
             * Next ccmjs instance to call the init method.
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
           * Calls the `ready` methods of all ccmjs instances in reverse order.
           *
           * This function processes a stack of ccmjs instances, calling their `ready` methods asynchronously.
           * Once all `ready` methods are called, the promise is resolved.
           * If an instance does not have a `ready` method, it proceeds to the next instance.
           */
          function ready() {

            // If all ready methods are called, resolve the promise.
            if (!instances.length) return resolve();

            /**
             * Next ccmjs instance to call the `ready` method.
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
             * Handles the next step after the instance is ready.
             *
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
     * @param {Element} [area=document.createElement("div")] - Web page area where the component instance will be embedded (default: on-the-fly `<div>`).
     * @returns {Promise<ccm.types.instance>} A promise that resolves to the created and started instance.
     * @throws {Error} If the provided component is not valid.
     */
    start: async (component, config = {}, area) => {

      // Register component.
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
     * @param {ccm.types.store_config} [config={}] - Datastore configuration
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
     * @param {ccm.types.store_config} [config={}] - Datastore configuration (same as {@link ccm.store})
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
       * @returns {*} Deep copy of the provided value.
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
       * @returns {Object<string,ccm.types.dataset>|*} Datastore-compatible object or original value.
       *
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
        const isIndex = key => /^\d+$/.test(key);
        let current = obj;
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const nextIsIndex = isIndex(keys[i + 1]);

          // convert array index access
          if (isIndex(key) && Array.isArray(current)) {
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
       * @param {HTMLElement} element - `<ccm-app>` element that hosts the component
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

        // Read the component URL from the attribute. Abort if the attribute is missing.
        const component = element.getAttribute("component");
        if (!component)
          throw new Error("<ccm-app> missing 'component' attribute");

        // Configuration object that will be constructed from attribute configuration and inline JSON configuration.
        let config = {};

        // Parse configuration from the `config` attribute. If the attribute is missing, an empty object is used.
        try {
          config = JSON.parse(element.getAttribute("config") || "{}");
        } catch (e) {
          console.warn("[ccmjs] Invalid JSON in <ccm-app> config attribute:", e);
        }

        // Look for an inline JSON configuration script. Only direct child scripts are considered. If found, its JSON content overrides attribute values.
        const script = element.querySelector(':scope > script[type="application/json"]');
        if (script) {
          try {
            Object.assign(config, JSON.parse(script.textContent.trim() || "{}"));
          } catch (e) {
            console.warn("[ccmjs] Invalid JSON in <ccm-app> application/json script:", e);
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
       * // Find nearest user instance in ancestor chain.
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
        if (/^\d/.test(key)) key = "a" + key.slice(1); // ensure identifier does not start with a digit (replace first char)
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
          if (Object.hasOwn(priodata, key))
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
       * @param {*} value - Value to check
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
        if (typeof value === "string")
          return KEY_REGEX.test(value);

        // compound key (array)
        if (Array.isArray(value) && value.length)
          return value.every(k => typeof k === "string" && KEY_REGEX.test(k));

        return false;
      },

      /**
       * Checks whether a value should not be cloned.
       *
       * Non-cloneable values include browser-specific objects and ccmjs runtime
       * objects that must be passed by reference to preserve their identity
       * and behavior.
       *
       * @param {*} value - Value to check
       * @returns {boolean}
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
       * Checks whether an object is a subset of another object.
       *
       * All properties of the query object must match the corresponding values
       * in the target object.
       *
       * Supported query features:
       * - direct equality
       * - dot notation (deep property access)
       * - `null` → property must be undefined
       * - `true` → property must be truthy
       * - RegExp as string (`"/pattern/"`)
       * - nested object comparison
       *
       * @param {Object} query - Query object (subset definition)
       * @param {Object} target - Object to test against
       * @returns {boolean}
       */
      isSubset: (query, target) => {
        if (!ccm.helper.isObject(query) || !target) return false;

        for (const key in query) {
          const expected = query[key];

          // resolve actual value (support dot notation)
          const actual = key.includes(".")
              ? ccm.helper.deepValue(target, key)
              : target[key];

          // null → must be undefined
          if (expected === null) {
            if (actual !== undefined) return false;
            continue;
          }

          // true → must be truthy
          if (expected === true) {
            if (!actual) return false;
            continue;
          }

          // RegExp string "/.../"
          const match = typeof expected === "string" && expected.match(/^\/(.+?)\/([gimsuy]*)$/);
          if (match) {
            const regex = new RegExp(match[1], match[2]);
            const value = actual && typeof actual === "object"
                ? actual.toString()
                : actual;
            if (!regex.test(value)) return false;
            continue;
          }

          // nested object → recursive subset check
          if (
              ccm.helper.isObject(expected) &&
              ccm.helper.isObject(actual)
          ) {
            if (!ccm.helper.isSubset(expected, actual)) return false;
            continue;
          }

          // default equality
          if (expected !== actual) return false;
        }

        return true;
      },

      /**
       * Creates a default loading indicator element.
       *
       * Returns a lightweight loading indicator that provides visual feedback
       * while a component instance is being initialized.
       *
       * The element is fully self-contained and does not rely on external CSS.
       *
       * This helper is used internally by the framework but can be overridden
       * via the `loading` property in a component configuration.
       *
       * @returns {HTMLElement} Loading indicator element.
       *
       * @example
       * const el = ccm.helper.loading();
       * document.body.appendChild(el);
       *
       * @example
       * ccm.start(component, {
       *   loading: () => document.createTextNode("Loading..."),
       * });
       */
      loading: () => {

        // wrapper element
        const wrapper = document.createElement("div");
        wrapper.style.display = "grid";
        wrapper.style.padding = "0.5em";

        // spinner element
        const spinner = document.createElement("div");
        spinner.style.width = "2em";
        spinner.style.height = "2em";
        spinner.style.border = "0.3em solid #f3f3f3";
        spinner.style.borderTopColor = "#009ee0";
        spinner.style.borderLeftColor = "#009ee0";
        spinner.style.borderRadius = "50%";

        // animate spinner
        spinner.animate(
            [
              { transform: "rotate(0deg)" },
              { transform: "rotate(360deg)" }
            ],
            {
              duration: 1000,
              iterations: Infinity
            }
        );

        wrapper.appendChild(spinner);
        return wrapper;
      },

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
       * @returns {Object} New mapped object.
       */
      mapObject: (source, mapper) => {

        // If mapper is a function, delegate transformation to it.
        if (typeof mapper === "function")
          return mapper(source);

        // If mapper is not an object, return source unchanged.
        if (!ccm.helper.isObject(mapper))
          return source;

        const result = {};

        // Apply path-based mapping.
        for (const from in mapper) {
          if (Object.hasOwn(mapper, from)) {
            const value = ccm.helper.deepValue(source, from);
            if (value !== undefined)
              ccm.helper.deepValue(result, mapper[from], value);
          }
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
        const [baseURL, ...rest] = url.split("#");
        const sri = rest.length ? rest.join("#") : undefined;

        // Extract filename
        const filename = baseURL.split("/").at(-1);

        const REGEX = /^ccm\.([a-z][a-z0-9_]*)(?:-(\d+\.\d+\.\d+))?(?:\.min)?\.(?:mjs|js)$/;
        const match = filename.match(REGEX);

        // Validate filename
        if (!match)
          throw new Error("invalid component filename: " + filename);

        const result = {
          url: baseURL,
          filename
        };
        if (sri) result.sri = sri;

        // Remove prefix "ccm." and suffix ".js/.mjs"
        let namePart = filename.slice(4).replace(/\.(m?js)$/, "");

        // Detect minified builds
        if (namePart.endsWith(".min")) {
          result.minified = true;
          namePart = namePart.slice(0, -4);
        }

        // Extract name and optional version
        const dashIndex = namePart.indexOf("-");
        const name = dashIndex === -1 ? namePart : namePart.slice(0, dashIndex);
        const version = dashIndex === -1 ? undefined : namePart.slice(dashIndex + 1);

        result.name = name;
        if (version) result.version = version;

        // Generate component index
        result.index = name + (version ? "-" + version.replace(/\./g, "-") : "");

        return result;
      },

      /**
       * Prepares a configuration before dependency resolution.
       *
       * Resolves configuration dependencies if the config itself is a dependency,
       * processes recursive base configurations via the `config` property,
       * and applies configuration priority rules.
       *
       * Priority order:
       * defaults < base configuration(s) < local configuration
       *
       * Note:
       * This function does NOT resolve nested dependencies within the configuration.
       * For that, use `ccm.helper.solveDependencies()` afterward.
       *
       * @param {ccm.types.config|ccm.types.dependency} config - Configuration or dependency to prepare
       * @param {ccm.types.config} defaults - Default configuration
       * @returns {Promise<ccm.types.config>} Prepared configuration.
       */
      prepareConfig: async (config = {}, defaults = {}) => {

        // Resolve config if it is given as a dependency.
        config = await ccm.helper.solveDependency(config);

        let base = {};

        // Resolve base configuration recursively if present.
        if (config && config.config)
          base = await ccm.helper.prepareConfig(config.config);

        // Create a shallow copy of config without the `config` property (avoid mutation).
        const local = { ...config };
        delete local.config;

        // Merge configurations according to priority: defaults < base < local
        let result = ccm.helper.clone(defaults);
        result = ccm.helper.integrate(base, result);
        result = ccm.helper.integrate(local, result);

        // Remove reserved framework property used only for component loading.
        delete result.ccm;

        return result;
      },

      /**
       * Filters a collection of objects using a query.
       *
       * Returns all objects that match the given query. Matching is performed
       * using `ccm.helper.isSubset()`, meaning that all properties in the query
       * must be contained in the object with equal values.
       *
       * @param {Object} query - Query object used for matching.
       * @param {Object} objects - Object map containing datasets or values.
       * @returns {Object[]} Array of matching objects.
       *
       * @example
       * const data = {
       *   a: { key: "a", done: true },
       *   b: { key: "b", done: false }
       * };
       *
       * const result = ccm.helper.runQuery({ done: true }, data);
       * // => [{ key: "a", done: true }]
       */
      runQuery: (query, objects) => {
        const results = [];
        if (!objects || typeof objects !== "object") return results;
        for (const key of Object.keys(objects)) {
          const obj = objects[key];
          if (ccm.helper.isSubset(query, obj))
            results.push(obj);
        }
        return results;
      },

      /**
       * Resolves all dependencies in a given object or array.
       *
       * Recursively traverses the structure and replaces dependency entries
       * with their resolved values. Errors during resolution are collected
       * and inserted into the result object instead of aborting execution.
       *
       * If at least one dependency fails, the returned Promise is rejected
       * with the partially resolved object.
       *
       * @param {Object|Array} obj - Object or array containing dependencies
       * @param {Object} instance - Instance used for dependency resolution
       * @returns {Promise<Object|Array>} Object with resolved dependencies.
       */
      solveDependencies: async (obj, instance) => {

        // Clone input to avoid mutation of original configuration.
        obj = ccm.helper.clone(obj);

        // Nothing to resolve → return as is.
        if (!Array.isArray(obj) && !ccm.helper.isObject(obj))
          return obj;

        let failed = false;

        /**
         * Recursively resolves dependencies within a structure.
         *
         * @param {Object|Array} current - Current object or array
         * @param {string} path - Current property path for debugging
         * @returns {Promise<Object|Array>}
         */
        async function resolveRecursive(current, path = "") {

          // Skip non-cloneable objects (DOM, instances, etc.).
          if (ccm.helper.isNonCloneable(current)) return current;

          const tasks = [];
          for (const key in current) {
            if (!Object.hasOwn(current, key)) continue;

            // Skip ignored section
            if (key === "ignore") continue;

            const value = current[key];
            const currentPath = path ? `${path}.${key}` : key;

            // Resolve dependency
            if (ccm.helper.isDependency(value)) {
              tasks.push(
                  ccm.helper.solveDependency(value, instance)
                      .then(result => current[key] = result)
                      .catch(error => {
                        failed = true;

                        // Emit warning with context.
                        console.warn(
                            `[ccmjs] failed to resolve dependency at '${currentPath}'`,
                            { dependency: value, error }
                        );

                        // Store error in place of resolved value.
                        current[key] = error;
                      })
              );
            }

            // Recurse into nested structures.
            else if (Array.isArray(value) || ccm.helper.isObject(value))
              tasks.push(resolveRecursive(value, currentPath));
          }

          // Wait for all async tasks (resolved or failed).
          await Promise.allSettled(tasks);

          return current;
        }

        const result = await resolveRecursive(obj);

        // Reject if any dependency failed, otherwise resolve normally.
        return failed ? Promise.reject(result) : result;
      },

      /**
       * Resolves a single ccmjs dependency.
       *
       * Executes the corresponding ccmjs operation (e.g. load, component, instance)
       * and prepares parameters depending on the operation type.
       *
       * @param {Array} dependency - Dependency to resolve
       * @param {Object} [instance] - Instance used as context for resolution
       * @returns {Promise<*>} Resolved dependency result.
       */
      solveDependency: async (dependency, instance) => {

        // Not a dependency → return as is.
        if (!ccm.helper.isDependency(dependency)) return dependency;

        // Extract operation and arguments (without mutating original array).
        const [op, ...args] = dependency;
        const operation = op.substring("ccm.".length);

        // Prepare arguments depending on operation.
        switch (operation) {
          case "load":
            if (instance) setContext(args);
            break;
          case "component":
          case "instance":
          case "start": {
            let config = await ccm.helper.solveDependency(args[1]);
            if (!config) config = {};
            if (instance) config.parent = instance;
            args[1] = config;
            break;
          }
          case "store":
          case "get": {
            let settings = args[0] || {};
            if (instance) settings.parent = instance;
            args[0] = settings;
            break;
          }
        }

        if (typeof ccm[operation] !== "function")
          throw new Error(`Unknown ccmjs operation: ${operation}`);

        // Execute ccm operation.
        return ccm[operation](...args);

        /**
         * Ensures that load resources use the correct DOM context.
         *
         * @param {Array} resources - Resources to process
         */
        function setContext(resources) {
          for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            if (Array.isArray(res)) {
              setContext(res);
              continue;
            }
            if (!ccm.helper.isObject(res))
              resources[i] = { url: res };
            if (!resources[i].context)
              resources[i].context = instance.element.parentNode;
          }
        }
      },

      /**
       * Serializes a value to valid JSON.
       *
       * Ensures that the resulting string contains only JSON-compatible data.
       * All non-serializable values (functions, symbols, DOM nodes, ccmjs instances,
       * framework objects, circular references, etc.) are completely removed.
       *
       * Properties containing such values are omitted entirely (no `null` placeholders).
       * Arrays are compacted (invalid entries are removed instead of replaced).
       *
       * @param {*} value - Value to serialize
       * @param {Function} [replacer] - Optional JSON replacer function
       * @param {number|string} [space] - Optional indentation
       * @returns {string} Valid JSON string.
       */
      stringify: (value, replacer, space) => {

        // Tracks visited objects to prevent circular reference crashes.
        const seen = new WeakSet();

        /**
         * Checks if a value is a plain object (i.e. `{}`).
         *
         * @param {*} obj
         * @returns {boolean}
         */
        const isPlainObject = obj => {
          const proto = Object.getPrototypeOf(obj);
          return proto === Object.prototype || proto === null;
        };

        /**
         * Recursively cleans a value so it becomes JSON-safe.
         *
         * @param {*} val
         * @returns {*} cleaned value or `undefined` (to remove property).
         */
        const clean = val => {

          // Allow valid primitive values.
          if (
              val === null ||
              typeof val === "string" ||
              typeof val === "number" ||
              typeof val === "boolean"
          ) {
            // Remove invalid numbers (NaN, Infinity).
            if (typeof val === "number" && !isFinite(val)) return undefined;
            return val;
          }

          // Remove unsupported primitive types.
          if (
              val === undefined ||
              typeof val === "function" ||
              typeof val === "symbol"
          ) return undefined;

          // Remove framework-specific non-cloneable.
          if (ccm.helper.isNonCloneable?.(val)) return undefined;

          // Handle arrays.
          if (Array.isArray(val)) {
            const arr = [];
            for (const item of val) {
              const cleaned = clean(item);
              if (cleaned !== undefined) arr.push(cleaned);
            }
            return arr;
          }

          // Handle objects.
          if (val && typeof val === "object") {

            // Prevent circular references.
            if (seen.has(val)) return undefined;
            seen.add(val);

            // Only allow plain objects.
            if (!isPlainObject(val)) return undefined;

            const obj = {};
            for (const key in val) {
              if (!Object.hasOwn(val, key)) continue;
              const cleaned = clean(val[key]);

              // Remove property entirely if not serializable.
              if (cleaned !== undefined)
                obj[key] = cleaned;
            }

            return obj;
          }

          // Everything else is removed
          return undefined;
        };

        const cleaned = clean(value);
        return JSON.stringify(cleaned, replacer || null, space);
      },
    },
  };

  // -----------------------------------------------------------------------------
  // Global Registration
  // -----------------------------------------------------------------------------

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

              // Prevent multiple starts.
              if (this.hasChildNodes()) return;

              // Embed component.
              await ccm.helper.embed(this);
            }
          },
      );
    }
  }

  // Initialize the namespace for the current ccmjs version.
  if (!window.ccm[ccm.version])
    window.ccm[ccm.version] = ccm;

  // -----------------------------------------------------------------------------
  // Private State
  // -----------------------------------------------------------------------------

  /**
   * A private object that stores all registered components for the current version of ccmjs.
   * Each component is indexed by its unique identifier.
   *
   * @memberOf ccm
   * @private
   * @type {Object.<ccm.types.component_index, ccm.types.component_obj>}
   */
  const _components = {};

  // -----------------------------------------------------------------------------
  // Internal Utilities
  // -----------------------------------------------------------------------------

  /**
   * When a requested component uses another ccmjs version.
   * This function performs the method call in the other ccmjs version.
   *
   * @param {number} version - Major number of the necessary ccmjs version
   * @param {string} method - Name of the method to be called ('component', 'instance' or 'start')
   * @param {ccm.types.component_obj|string} component - Object, index or URL of the component
   * @param {ccm.types.config} config - Priority data for instance configuration
   * @param {Element} [element] - Web page area where the component will be embedded (default: on-the-fly <div>)
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
      ) // Before version 18, callbacks were used instead of promises (and there was no 3rd parameter for ccm.instance and ccm.start).
          ?.then(resolve)
          .catch(reject);
    });
  }

  // -----------------------------------------------------------------------------
  // Datastore Implementation
  // -----------------------------------------------------------------------------

  /**
   * Abstract base class for datastore accessors in ccmjs.
   *
   * Defines the asynchronous data access API used by all datastore implementations.
   *
   * Concrete subclasses implement the actual persistence strategy:
   *
   * - {@link InMemoryStore} – volatile in-memory storage
   * - {@link OfflineStore}  – browser-based persistence (IndexedDB)
   * - {@link RemoteStore}   – remote server persistence via HTTP/WebSocket
   *
   * Design contract:
   *
   * - All methods are asynchronous and return Promises.
   * - Each dataset must contain a unique `key`.
   * - `get(key)` resolves to a dataset or `null`.
   * - `get(query)` resolves to an array (possibly empty).
   * - `set()` creates or updates a dataset.
   * - `del()` resolves to the deleted dataset or `null`.
   *
   * Subclasses may provide additional capabilities such as:
   *
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
     * Called once during setup by {@link ccm.store}.
     * Subclasses may override this method to perform initialization logic
     * such as opening database connections or preparing internal state.
     *
     * After initialization, this method removes itself to prevent accidental re-initialization.
     *
     * @returns {Promise<void>}
     */
    async init() {
      delete this.init;
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
   *
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
     * @param {ccm.types.dataset} priodata - Dataset to create or update
     * @returns {Promise<ccm.types.dataset>} A promise that resolves to the created or updated dataset.
     */
    async set(priodata) {
      if (!priodata.key) priodata.key = ccm.helper.generateKey();
      this._checkKey(priodata.key);

      // Integrate with existing dataset if it exists, otherwise create new entry.
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

      // Open database to inspect existing object stores.
      const db = await this.#pReq(indexedDB.open(this.dbName));

      // If store already exists, use the connection directly.
      if (db.objectStoreNames.contains(this.name)) {
        this.#setupDatabase(db);
        return;
      }

      // Otherwise upgrade database version to create the object store.
      const newVersion = db.version + 1;
      db.close();

      const request = indexedDB.open(this.dbName, newVersion);
      let upgradeComplete;
      request.onupgradeneeded = event => {
        const upgradeDB = event.target.result;
        const tx = event.target.transaction;
        if (!upgradeDB.objectStoreNames.contains(this.name))
          upgradeDB.createObjectStore(this.name, { keyPath: "key" });

        // Ensure upgrade transaction finishes before continuing.
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

      // Forward optional query modifiers to the server.
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

      // Attach framework version for compatibility checks.
      params.ccm = this.ccm || ccm.version;

      // Attach database and store identifiers.
      params.db = this.db || "";
      params.store = this.name;

      // Attach authentication token if available.
      if (this.user?.isLoggedIn()) params.token = this.user.getAppState().token;
      if (this.token) params.token = this.token;

      try {
        return await ccm.load({ url: this.url, params });
      } catch (e) {

        // Handle authentication errors by retrying login
        if (this.user && (e.status === 401 || e.status === 403)) {
          try {
            await this.user.logout();
            await this.user.login();
            params.token = this.user.getAppState().token;
            return await ccm.load({ url: this.url, params });
          } catch (e) {

            // If login fails, restart the root component
            if (this.parent)
              await ccm.helper.findRoot(this).start();
            else
              throw e;
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

      // Convert HTTP endpoint to WebSocket endpoint.
      this.socket = new WebSocket(this.url.replace(/^http/, "ws"));

      // Subscribe to datastore observation when connection opens.
      this.socket.onopen = () => {
        this.socket.send(
            JSON.stringify({
              db: this.db,
              store: this.name,
              observe: this.observe,
            }),
        );
      };

      // Handle incoming update notifications.
      this.socket.onmessage = (message) => {
        try {
          this.onchange && this.onchange(JSON.parse(message.data));
        } catch (e) {
          console.error("Failed to parse WebSocket message:", message.data, e);
        }
      };

      // Log WebSocket errors.
      this.socket.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      // Attempt a single automatic reconnect if the connection drops.
      this.socket.onclose = (event) => {
        console.warn(
            `[ccmjs] WebSocket closed, code=${event.code}, reason=${event.reason}`,
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
 * @description ccmjs-specific type definitions
 */

/**
 * @typedef {string} ccm.types.component_index
 * @description Unique identifier of a registered component
 * @example "quiz-4-0-0"
 */

/**
 * @typedef {Object} ccm.types.component_obj
 * @description ccmjs component definition object
 * @property {string} name - Component name
 * @property {string|ccm.types.framework} ccm - ccmjs framework reference or URL
 * @property {ccm.types.config} config - Default configuration for instances
 * @property {Function} Instance - Instance constructor
 */

/**
 * @typedef {Object} ccm.types.config
 * @description
 * Configuration object used to create a ccmjs component instance.
 *
 * A configuration may contain plain values, nested objects and ccmjs dependencies.
 *
 * See {@link https://github.com/ccmjs/framework/wiki/ccmjs-Conventions#configuration-conventions}
 * for detailed rules and conventions regarding configuration handling.
 */

/**
 * @typedef {Array} ccm.types.dependency
 * @description ccmjs dependency definition
 * @example ["ccm.load", "./file.json"]
 * @example ["ccm.component", "./ccm.quiz.mjs"]
 * @example ["ccm.instance", "./ccm.quiz.mjs", {}]
 * @example ["ccm.start", "./ccm.quiz.mjs", {}]
 * @example ["ccm.store", { name: "tasks" }]
 * @example ["ccm.get", { name: "tasks" }, "key"]
 */

/**
 * @typedef {Object} ccm.types.framework
 * @description ccmjs framework instance
 * @property {ccm.types.version_nr} version - Framework version
 * @property {Function} load - Loads resources
 * @property {Function} component - Registers a component
 * @property {Function} instance - Creates an instance
 * @property {Function} start - Creates and starts an instance
 * @property {Function} store - Creates a datastore
 * @property {Function} get - Retrieves datasets
 * @property {Object} helper - Helper functions
 */

/**
 * @typedef {Object} ccm.types.instance
 * @description ccmjs component instance
 * @property {string} id - Instance ID (unique within the component)
 * @property {string} index - Unique instance identifier within the page
 * @property {ccm.types.framework} ccm - Used ccmjs framework
 * @property {ccm.types.component_obj} component - Associated component
 * @property {HTMLElement} host - Host DOM element
 * @property {HTMLElement} element - Content element
 * @property {ShadowRoot} [root] - Shadow DOM root (if enabled)
 * @property {Object.<string,ccm.types.instance>} children - Child instances
 * @property {ccm.types.instance} [parent] - Parent instance
 * @property {Function} start - Starts or re-runs the instance
 */

/**
 * @typedef {Object} ccm.types.resource_obj
 * @description
 * Resource configuration object for {@link ccm.load}.
 *
 * Instead of a URL, a resource object can be provided to control loading behavior.
 *
 * @property {string} url - Resource URL
 * @property {Element|ccm.types.instance} [context] - DOM context for loading (default: <head>)
 * @property {string} [type] - Resource type ("css", "image", "js", "module", "json", "xml")
 * @property {Object} [attr] - Additional HTML attributes (e.g. integrity, crossorigin)
 * @property {string} [method] - HTTP method (default: "GET").
 * @property {Object} [params] - HTTP parameters
 */

/**
 * @typedef {Object} ccm.types.store
 * @description ccmjs datastore interface
 * @property {Function} get - Retrieves datasets
 * @property {Function} set - Stores a dataset
 * @property {Function} del - Deletes a dataset
 * @property {Function} count - Counts datasets
 * @property {Function} clear - Clears the datastore
 */

/**
 * @typedef {Object} ccm.types.store_config
 * @description
 * Configuration object for creating a datastore via {@link ccm.store}.
 *
 * The selected datastore implementation depends on the provided properties:
 *
 * - no `name` → InMemoryStore
 * - `name` only → OfflineStore (IndexedDB)
 * - `name` + `url` → RemoteStore
 *
 * @property {string} [name] - Datastore name (required for persistent stores)
 * @property {string} [url] - Server endpoint for remote datastore
 * @property {string} [db] - Optional database identifier (remote only)
 * @property {Object|ccm.types.dataset[]} [datasets] - Initial datasets (in-memory store)
 * @property {Object} [observe] - Query for observing dataset changes (remote only)
 * @property {Function} [onchange] - Callback for observed dataset changes
 * @property {ccm.types.instance} [user] - User instance for authentication (remote only)
 * @property {ccm.types.instance} [parent] - Parent instance (internal use)
 *
 * See {@link https://github.com/ccmjs/framework/wiki/Data-Management}
 * for detailed datastore configuration rules.
 */

/**
 * @typedef {string} ccm.types.version_nr
 * @description Semantic Versioning 2.0.0 compliant version string
 * @example "1.0.0"
 * @example "2.1.3"
 */
