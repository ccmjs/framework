"use strict";

/**
 * @overview
 * Defines the global namespace [window.ccm]{@link ccm} for accessing ccmjs services.
 *
 * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki}
 * to learn everything about ccmjs.
 *
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
   * Encapsulates everything related to ccmjs.
   *
   * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki}
   * to learn everything about ccmjs.
   *
   * @global
   * @namespace
   */
  const ccm = {
    /**
     * @summary Retrieves the current version of the ccmjs.
     * @description
     * Returns the version number of ccmjs as a string following Semantic Versioning 2.0.0.
     * Use this as a synchronous, stable accessor for the ccmjs version.
     *
     * @returns {ccm.types.version_nr} version number of ccmjs
     */
    version: () => "28.0.0",

    /**
     * @summary Asynchronous Loading of Resources
     * @description
     * Loads resources such as HTML, CSS, images, JavaScript, modules, JSON, or XML asynchronously.
     * Supports sequential and parallel loading of resources.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Loading-Resources}
     * to learn everything about loading resources in ccmjs.
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

          // By default, a resource is loaded in the <head> of the webpage.
          if (!resource.context) resource.context = document.head;

          // Handle loading in the Shadow DOM of a ccmjs instance.
          if (ccm.helper.isInstance(resource.context))
            resource.context = resource.context.element.parentNode;

          // Determine and call the operation to load the resource based on its type or file extension.
          getOperation()();

          /**
           * @summary Recursively loads a resource one after the other.
           * @description
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

            // Infer the type from the file extension of the resource URL when no type is given.
            const file_extension = resource.url
              .split(/[#?]/)[0] // Remove query parameters and hash from URL.
              .split(".") // Split the URL by dots to get the file extension.
              .at(-1) // Get the last part as the file extension.
              .trim(); // Remove any surrounding whitespace.

            // Match the file extension to the corresponding loading operation.
            switch (file_extension) {
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

          /**
           * @summary Loads HTML via Fetch API as an HTML string.
           * @description
           * Sets the resource type to `html` and delegates the loading process to the `loadJSON` function.
           * The loaded HTML content will be treated as a JSON string and processed accordingly.
           */
          function loadHTML() {
            resource.type = "html";
            loadJSON(); // Delegate the loading process to the loadJSON function.
          }

          /**
           * @summary Loads a CSS file via a `<link>` tag.
           * @description
           * Creates a `<link>` element to load the CSS file. Additional attributes can be set via the `resource.attr` property.
           * The CSS file is loaded in the specified context, and success or error callbacks are triggered accordingly.
           */
          function loadCSS() {
            /** @type {ccm.types.html|Element} */
            let element = {
              tag: "link",
              rel: "stylesheet",
              type: "text/css",
              href: resource.url,
            };

            // Set up individual HTML attributes for <link> tag.
            if (resource.attr) element = Object.assign(element, resource.attr);

            element = ccm.helper.html(element); // Convert to DOM element.
            element.onload = () => success(resource.url);
            element.onerror = error;
            resource.context.appendChild(element);
          }

          /**
           * @summary Preloads an image.
           * @description
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
           * @summary Loads JavaScript via a <script> tag.
           * @description
           * Creates a <script> element to load the JavaScript file. The filename is extracted and used to handle result data.
           * The script is loaded asynchronously, and success or error callbacks are triggered accordingly.
           */
          function loadJS() {
            /** @type {ccm.types.html|Element} */
            let element = { tag: "script", src: resource.url, async: true };

            // Set up individual HTML attributes for <script> tag.
            if (resource.attr) element = Object.assign(element, resource.attr);

            element = ccm.helper.html(element); // Convert to DOM element.
            element.onload = () => {
              element.parentNode.removeChild(element); // Remove no more necessary script element from the DOM.
              success(resource.url);
            };
            element.onerror = () => {
              element.parentNode.removeChild(element);
              error();
            };
            resource.context.appendChild(element);
          }

          /**
           * @summary Loads a JavaScript module via dynamic import.
           * @description
           * This function dynamically imports an ES module from a given URL. It supports Subresource Integrity (SRI) checks
           * to ensure the module's integrity. If specific properties of the module are requested (indicated by hash signs in the URL),
           * only those properties are included in the result. The function also clones the imported module to avoid caching issues.
           */
          async function loadModule() {
            // Use hash signs at the end of URL if only specific properties should be included in the result data.
            let [url, ...keys] = resource.url.split("#");

            // Convert relative URL to absolute URL (dynamic imports don't work with relative URL's).
            if (url.startsWith("./"))
              url = url.replace(
                "./",
                location.href.substring(0, location.href.lastIndexOf("/") + 1),
              );

            // If SRI is given, fetch the module, verify integrity and create a blob URL for dynamic import.
            let result;
            if (resource.attr?.integrity) {
              // Fetch the module.
              const text = await (await fetch(url)).text();

              // Calculate SRI hash.
              const prefix = resource.attr.integrity.slice(
                0,
                resource.attr.integrity.indexOf("-"),
              );
              let algorithm = prefix.replace("sha", "SHA-");
              const data = new TextEncoder().encode(text);
              const hash = await crypto.subtle.digest(algorithm, data);
              const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
              const sri = `${prefix}-${base64}`;

              // Verify integrity.
              if (sri !== resource.attr.integrity) return error();

              // .Create a blob for dynamic import.
              const blob = new Blob([text], { type: "text/javascript" });
              const blobUrl = URL.createObjectURL(blob);

              result = await import(blobUrl);
            } else result = await import(url);

            // If only one specific deeper value has to be the result.
            if (keys.length === 1)
              result = ccm.helper.deepValue(result, keys[0]);

            // If more than one specific property has to be included.
            if (keys.length > 1) {
              const obj = {};
              keys.forEach((key) => (obj[key] = result[key]));
              result = obj;
            }

            // A dynamic import caches the module by reference, so we have to clone the result.
            success(ccm.helper.clone(result));
          }

          /**
           * @summary Loads JSON data via Fetch API.
           * @description
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
           * @summary Builds a URL with query parameters.
           * @description
           * Appends the provided query parameters to the base URL.
           * Supports nested objects and arrays for complex query structures.
           *
           * @param {string} url - The base URL.
           * @param {Object} data - The query parameters to append.
           * @returns {string} - The URL with appended query parameters.
           */
          function buildURL(url, data) {
            // Append query parameters to the URL.
            return data ? url + "?" + params(data).slice(0, -1) : url;

            /**
             * @summary Converts an object to query string parameters.
             * @description
             * Recursively processes nested objects and arrays to generate query strings.
             *
             * @param {Object} obj - The object to convert.
             * @param {string} [prefix] - The prefix for nested keys.
             * @returns {string} - The generated query string.
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
           * @summary Loads XML via Fetch API as an XML document.
           * @description
           * Sets the resource type to `xml` and delegates the loading process to the `loadJSON` function.
           * The loaded XML content is parsed into an XML document.
           */
          function loadXML() {
            resource.type = "xml";
            loadJSON();
          }

          /**
           * @summary Callback when loading of a resource was successful.
           * @description
           * Processes the loaded data based on its type (e.g., HTML, XML) and updates the results array.
           * Triggers the next step in the loading process.
           * @param {*} data - Loaded resource data.
           */
          function success(data) {
            // If the data is not defined, then treat the loading of this resource as complete.
            if (data === undefined) return check();

            // Attempt to parse the data as JSON if it is not already an object.
            try {
              if (typeof data !== "object") data = JSON.parse(data);
            } catch (e) {}

            // Process HTML resources by extracting templates defined with <ccm-template> tags.
            if (resource.type === "html") {
              const regex =
                /<ccm-template key="(\w*?)">([^]*?)<\/ccm-template>/g; // Regex to match <ccm-template> tags.
              const result = {}; // Object to store extracted templates.
              let array;
              while ((array = regex.exec(data))) result[array[1]] = array[2]; // Extract templates and store them in the result object.
              if (Object.keys(result).length) data = result; // If templates were found, replace the data with the result object.
            }

            // Process XML resources by parsing the data into an XML document.
            if (resource.type === "xml")
              data = new window.DOMParser().parseFromString(data, "text/xml");

            // Update the result array with the processed data.
            results[i] = data;

            // Treat the loading of this resource as complete and check if all resources have been loaded.
            check();
          }

          /**
           * @summary Callback when loading of a resource failed.
           * @description
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
         * @summary Callback function to handle the completion of resource loading.
         * @description
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
     * @summary Registers a component.
     * @description
     * This method registers a component, ensuring compatibility with different ccmjs versions.
     * It retrieves the component object, validates it, adjusts the ccmjs version, and registers the component.
     * If the component uses a different ccmjs version, it handles backwards compatibility.
     * The method also prepares the default instance configuration and adds methods for creating and starting instances out of the component.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Embedding-Components}
     * to learn everything about embedding components with ccmjs.
     *
     * @param {ccm.types.component_obj|string} component - The component object, index, or URL of the component to register.
     * @param {ccm.types.config} [config={}] - Priority data for the component's default instance configuration.
     * @returns {Promise<ccm.types.component_obj>} A clone of the registered component object.
     * @throws {Error} If the provided component is not valid.
     */
    component: async (component, config = {}) => {
      // Retrieve the component object via index, URL or directly as JavaScript object.
      component = await getComponentObject();

      // If the component is not a valid object, throw an error.
      if (!ccm.helper.isComponent(component))
        throw new Error("invalid component: " + component);

      // Adjust the framework version used by the component via config.
      if (config.ccm) component.ccm = config.ccm;
      delete config.ccm;

      // Determine the framework version the component must use.
      let version;
      if (ccm.helper.isCore(component.ccm)) version = component.ccm.version();
      else {
        // Extract the version from the framework URL.
        const [url] = component.ccm.split("#");
        if (url.includes("-"))
          version = url.split("-").at(-1).split(".").slice(0, 3).join(".");
      }

      // Load the required framework version if not already present in the web page.
      if (!window.ccm[version]) {
        // The framework version is loaded with SRI when the SRI hash is appended to the URL with “#”.
        const [url, sri] = component.ccm.split("#");
        await ccm.load(
          sri
            ? { url, attr: { integrity: sri, crossorigin: "anonymous" } }
            : url,
        );
      }

      // If the component uses a different framework version, handle backwards compatibility.
      if (version && version !== ccm.version())
        return backwardsCompatibility(version, "component", component, config);

      // Set the component index based on its name and version.
      component.index =
        component.name +
        (component.version ? "-" + component.version.join("-") : "");

      // Register the component if it is not already registered.
      if (!_components[component.index]) {
        _components[component.index] = component; // Register component: Store the component object encapsulated in the framework.
        ccm.components[component.index] = {}; // Create global component namespaces.
        component.instances = 0; // Add a counter for component instances.
        component.ready && (await component.ready.call(component)); // Execute the "ready" callback if defined.
        delete component.ready; // Remove the "ready" callback after execution.
        await defineCustomElement(component.index); // Define a custom HTML tag for the component.
      }

      // Clone the registered component object to avoid direct modifications.
      component = ccm.helper.clone(_components[component.index]);

      // Set the reference to the used framework version.
      component.ccm = window.ccm[version] || ccm;

      // Prepare the default instance configuration.
      component.config = await prepareConfig(config, component.config);

      // Add methods for creating and starting instances of the component.
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
       * @summary Retrieves the component object via index, URL or directly as JavaScript object.
       * @returns {Promise<ccm.types.component_obj>} The component object.
       */
      async function getComponentObject() {
        // Return the component directly if it is not a string.
        if (typeof component !== "string") return component;

        /**
         * @summary Extracts metadata from the component URL.
         * @type {{name: string, index: string, version: string, filename: string, url: string, minified: boolean, sri: string}}
         */
        const url_data = component.includes(".js")
          ? ccm.helper.convertComponentURL(component)
          : null;

        /**
         * @summary The index of the component.
         * @type {ccm.types.component_index}
         */
        const index = url_data?.index || component;

        // Return a clone of the registered component object if already registered.
        if (_components[index]) return ccm.helper.clone(_components[index]);

        // Abort if the component URL is not provided.
        if (!url_data) return component;

        // Load the component from the URL.
        const result = (
          await ccm.load({
            url: url_data.url,
            type: "module",
            // If the SRI hash is provided, load the component with SRI.
            attr: url_data.sri && {
              integrity: url_data.sri,
              crossorigin: "anonymous",
            },
          })
        ).component;

        result.url = url_data.url; // A component remembers its URL.
        return result;
      }
    },

    /**
     * @summary Registers a _ccm_ component and creates an instance out of it.
     * @description
     * This function registers a _ccm_ component and creates an instance from it. It handles the registration process,
     * prepares the instance configuration, and initializes the created instance. The function also resolves dependencies
     * and sets up the instance's DOM structure.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Embedding-Components}
     * to learn everything about embedding components in _ccm_. There are also examples how to use this method.
     *
     * @param {ccm.types.component_obj|string} component - The component object, index, or URL of the component to register.
     * @param {ccm.types.config} [config={}] - Priority data for the instance configuration.
     * @param {Element} [element=document.createElement("div")] - The webpage area where the component instance will be embedded (default: on-the-fly `<div>`).
     * @returns {Promise<ccm.types.instance>} A promise that resolves to the created instance.
     * @throws {Error} If the provided component is not valid.
     */
    instance: async (
      component,
      config = {},
      element = document.createElement("div"),
    ) => {
      // Register the component.
      component = await ccm.component(component, { ccm: config?.ccm });

      // Abort if the component is not valid.
      if (!ccm.helper.isComponent(component)) return component;

      // Handle backwards compatibility if the component uses another framework version.
      const version = component.ccm.version();
      if (version && version !== ccm.version())
        return backwardsCompatibility(
          version,
          "instance",
          component,
          config,
          element,
        );

      // Render a loading icon in the webpage area.
      element.innerHTML = "";
      const loading = ccm.helper.loading();
      element.appendChild(loading);

      // Prepare the instance configuration.
      config = await prepareConfig(config, component.config);

      /**
       * @summary Creates a new instance from the component.
       * @type {ccm.types.instance}
       */
      const instance = new component.Instance();

      // Set _ccm_-specific properties for the instance.
      instance.ccm = component.ccm; // Reference to the used framework version.
      instance.component = component; // The component the instance is created from.
      instance.id = ++_components[component.index].instances; // Instance ID. Unique within the component.
      instance.index = component.index + "-" + instance.id; // Instance index. Unqiue within the webpage.
      if (!instance.init) instance.init = async () => {}; // Ensure the instance has an init method.
      instance.children = {}; // Store child instances used by this instance.
      instance.parent = config.parent; // Reference to the parent instance.
      delete config.parent; // Prevent cyclic recursion when resolving dependencies.
      instance.config = ccm.helper.stringify(config); // Store the original configuration.

      // Convert Light DOM to an Element Node.
      if (config.inner)
        config.inner = ccm.helper.html(config.inner, undefined, {
          ignore_apps: true,
        });

      // Add the instance as a child to its parent instance.
      if (instance.parent) instance.parent.children[instance.index] = instance;

      // Set the root element of the created instance.
      instance.root = ccm.helper.html({ id: instance.index });

      // Create a Shadow DOM in the root element if specified.
      if (config.shadow !== "none")
        instance.shadow = instance.root.attachShadow({
          mode: config.shadow || "closed",
        });
      delete config.shadow;

      // Set the content element of the created instance.
      (instance.shadow || instance.root).appendChild(
        (instance.element = ccm.helper.html({ id: "element" })),
      );

      // Temporarily move the root element to `<head>` for resolving dependencies.
      document.head.appendChild(instance.root); // move root element temporary to <head> (resolving dependencies requires DOM contact)
      config = await ccm.helper.solveDependencies(config, instance); // resolve all dependencies in config
      element.appendChild(instance.root); // move the root element back to the webpage area
      instance.element.appendChild(loading); // move loading icon to content element

      // Integrate the configuration into the created instance.
      Object.assign(instance, config);

      // Initialize the created and dependent instances if necessary.
      if (!instance.parent?.init) await initialize();

      return instance;

      /**
       * @summary Initializes the created instance and all dependent _ccm_ instances.
       * @returns {Promise<void>} A promise that resolves when initialization is complete.
       */
      function initialize() {
        return new Promise((resolve) => {
          /**
           * @summary Stores all found _ccm_ instances.
           * @type {ccm.types.instance[]}
           */
          const instances = [instance];

          // Find all sub-instances dependent on the created instance.
          find(instance);

          // Call init methods of all found _ccm_ instances.
          let i = 0;
          init();

          /**
           * @summary Finds all dependent _ccm_ instances (breadth-first-order, recursive).
           * @param {Array|Object} obj - The array or object to search.
           */
          function find(obj) {
            /**
             * @summary Stores relevant inner objects/arrays for breadth-first-order.
             * @type {Array.<Array|Object>}
             */
            const relevant = [];

            // Search the object/array.
            for (const key in obj)
              if (Object.hasOwn(obj, key)) {
                const value = obj[key];

                // Add _ccm_ instances to the list of found instances.
                if (ccm.helper.isInstance(value) && key !== "parent") {
                  instances.push(value);
                  relevant.push(value);
                }
                // Add relevant inner arrays/objects for further searching.
                else if (Array.isArray(value) || ccm.helper.isObject(value)) {
                  // relevant object type? => add to relevant inner arrays/objects
                  if (!ccm.helper.isSpecialObject(value)) relevant.push(value);
                }
              }

            // Recursively search relevant inner arrays/objects.
            relevant.forEach(find);
          }

          /**
           * @summary Calls init methods (forward) of all found _ccm_ instances (recursive, asynchronous).
           */
          function init() {
            // If all init methods are called, proceed to ready methods.
            if (i === instances.length) return ready();

            /**
             * @summary The next _ccm_ instance to call the init method.
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
           * @summary Calls ready methods (backward) of all found _ccm_ instances (recursive, asynchronous).
           */
          function ready() {
            // If all ready methods are called, resolve the promise.
            if (!instances.length) return resolve();

            /**
             * @summary The next _ccm_ instance to call the ready method.
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
             */
            function proceed() {
              // Start the app directly if required, otherwise continue with the next instance.
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
     * @summary Registers a _ccm_ component, creates an instance out of it, and starts the instance.
     * @description
     * This function handles the registration of a _ccm_ component, creates an instance from it, and starts the instance.
     * It ensures compatibility with different framework versions and initializes the instance if required.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Embedding-Components}
     * to learn everything about embedding components in _ccm_. There are also examples how to use this method.
     *
     * @param {ccm.types.component_obj|string} component - The component object, index, or URL of the component to register.
     * @param {ccm.types.config} [config={}] - Priority data for the instance configuration.
     * @param {Element} [element=document.createElement("div")] - The webpage area where the component instance will be embedded (default: on-the-fly `<div>`).
     * @returns {Promise<ccm.types.instance>} A promise that resolves to the created and started instance.
     * @throws {Error} If the provided component is not valid.
     */
    start: async (component, config, element) => {
      // Register the component.
      component = await ccm.component(component, { ccm: config?.ccm });

      // Abort if the component is not valid.
      if (!ccm.helper.isComponent(component)) return component;

      // Handle backwards compatibility if the component uses another framework version.
      const version = component.ccm.version();
      if (version && version !== ccm.version())
        return backwardsCompatibility(
          version,
          "start",
          component,
          config,
          element,
        );

      // Create an instance out of the component.
      const instance = await ccm.instance(component, config, element);

      // Abort if the instance is not valid.
      if (!ccm.helper.isInstance(instance)) return instance;

      // Start the instance directly (is standalone) or mark it for starting after initialization (is child instance).
      instance.init ? (instance._start = true) : await instance.start();

      // Return the created and started instance.
      return instance;
    },

    /**
     * Provides access to a datastore.
     *
     * Supports three data levels:
     * 1. **InMemoryStore** – Volatile, stored only in a JS object.
     * 2. **OfflineStore** – Persistent in the browser storage IndexedDB.
     * 3. **RemoteStore** – Persistent on a remote server via API.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Data-Management}
     * to learn more about data management in _ccm_. The page also includes usage examples.
     *
     * @param {Object} [config={}] - Datastore configuration.
     * @returns {Promise<Datastore>} Resolves to the initialized datastore accessor.
     */
    store: async (config = {}) => {
      const store = new (
        config.name ? (config.url ? RemoteStore : OfflineStore) : InMemoryStore
      )();
      config = await ccm.helper.solveDependency(config);
      Object.assign(store, config); // sets local, name and url properties
      await store.init();
      return store;
    },

    /**
     * @summary Reads one or more datasets from a datastore.
     * @description
     * This method works similarly to {@link ccm.store}, with the difference that one or more [dataset(s)]{@link ccm.types.dataset} are directly read from the accessed datastore.
     * Use this method if you only need to read data once and do not require further access to the datastore.
     *
     * This method can be used to define dependencies to other datasets in [instance configurations]{@link ccm.types.instance_config}.
     *
     * See [this wiki page]{@link https://github.com/ccmjs/framework/wiki/Data-Management}
     * to learn everything about data management in _ccm_. There are also examples of how to use this method.
     *
     * @param {Object} [config={}] - Configuration for the datastore accessor.
     * @param {ccm.types.key|Object} [key_or_query={}] - Either a dataset key or a query to read multiple datasets. Default: Read all datasets.
     * @param {Object} [projection] - Specifies the fields to return in the dataset(s). Default: Return all fields.
     * @param {Object} [options] - Specifies additional options to modify query behavior and how results are returned.
     * @returns {Promise<ccm.types.dataset|ccm.types.dataset[]>} A promise that resolves to the read dataset or multiple datasets.
     */
    get: (config = {}, key_or_query = {}, projection, options) =>
      ccm.store(config).then((store) => store.get(key_or_query)),

    /**
     * @summary Contains framework-relevant helper functions.
     * @description These are also useful for component developers.
     * @namespace
     */
    helper: {
      /**
       * @summary converts an array of datasets to a collection of _ccmjs_ datasets
       * @param {ccm.types.dataset[]} arr - array of datasets
       * @returns {ccm.types.datasets} collection of _ccmjs_ datasets
       */
      arrToStore: (arr) => {
        if (!Array.isArray(arr)) return arr;

        const obj = {};
        arr.forEach((value) => {
          if (ccm.helper.isDataset(value)) obj[value.key] = value;
        });

        return obj;
      },

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

      findInAncestors: (instance, prop) => {
        let current = instance;
        while (current) {
          if (prop in current && current[prop] !== undefined)
            return current[prop];
          current = current.parent;
        }
        return null;
      },

      findRoot: (instance) => {
        while (instance.parent) instance = instance.parent;
        return instance;
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
      generateKey: () => {
        let key = crypto.randomUUID().replaceAll("-", ""); // 32 Characters, 0-9a-f
        if (/^\d/.test(key)) key = "_" + key.slice(1);
        return key;
      },

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
       * With no given priority data, the result is a clone of the given dataset.
       * With no given dataset, the result is a clone of the given priority data.
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
      isKey: (value) => {
        const regex = ccm.helper.regex("key");
        const check = (v) => typeof v === "string" && regex.test(v);
        return Array.isArray(value) ? value.every(check) : check(value);
      },

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
      regex: (index) => {
        switch (index) {
          case "filename":
            return /^ccm\.([a-z][a-z_0-9]*)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.js)$/;
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
         * The resources are automatically loaded in the shadow DOM of the associated ccm instance.
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

    // define Custom Element <ccm-app>
    defineCustomElement("app");
  }

  // is this the first time this specific ccm framework version is loaded on this webpage?
  if (!window.ccm[ccm.version()]) {
    window.ccm[ccm.version()] = ccm; // set version specific namespace
    ccm.components = {}; // set namespace for loaded components
  }

  /**
   * When the requested component uses another framework version.
   * This function performs the method call in the other framework version.
   * @param {number} version - major number of the necessary framework version
   * @param {string} method - name of the method to be called ('component', 'instance' or 'start')
   * @param {ccm.types.component_obj|string} component - object, index or URL of component
   * @param {ccm.types.config} config - priority data for instance configuration
   * @param {Element} element - webpage area where the component instance will be embedded (default: on-the-fly <div>)
   * @returns {Promise<ccm.types.component|ccm.types.instance>}
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
   * defines a ccm-specific Custom Element
   * @param {string} name - element name (without 'ccm-' prefix)
   * @returns {Promise<void>}
   */
  async function defineCustomElement(name) {
    // no support of Custom Elements in current webbrowser? => abort
    if (!("customElements" in window)) return;

    // Custom Element already exists in the current webpage? => abort
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
    // config is given as a dependency? => solve it
    config = await ccm.helper.solveDependency(config);

    // instance configuration contains a base configuration?
    while (config.config) {
      let base = config.config;
      delete config.config;
      // base configuration is given as a dependency? => solve it
      base = await ccm.helper.solveDependency(base);
      // integrate instance configuration into base configuration
      config = await ccm.helper.integrate(config, base);
    }

    // integrate instance configuration into default configuration
    const result = await ccm.helper.integrate(config, defaults);

    // delete reserved properties
    delete result.ccm;

    return result;
  }

  class Datastore {
    init() {
      this.init = undefined;
    }

    async clear() {
      const datasets = await this.get();
      const results = await Promise.allSettled(
        datasets.map((dataset) => this.del(dataset)),
      );
      results.forEach((res, i) => {
        if (res.status === "rejected") {
          console.error("Failed to delete dataset", datasets[i], res.reason);
        }
      });
    }

    source() {
      return { name: this.name, url: this.url, db: this.db };
    }

    _checkKey(key) {
      if (!ccm.helper.isKey(key))
        throw new Error(`Invalid dataset key: ${JSON.stringify(key_or_query)}`);
    }
  }

  class InMemoryStore extends Datastore {
    datasets;

    async init() {
      super.init();
      if (!this.datasets) this.datasets = {};
      this.datasets = await ccm.helper.solveDependency(this.datasets);
      this.datasets = ccm.helper.arrToStore(this.datasets);
    }

    async get(key_or_query) {
      let result;
      if (ccm.helper.isObject(key_or_query))
        result = ccm.helper.runQuery(key_or_query, this.datasets);
      else {
        this._checkKey(key_or_query);
        result = this.datasets[key_or_query] || null;
      }

      return ccm.helper.clone(result);
    }

    async set(priodata) {
      if (!priodata.key) priodata.key = ccm.helper.generateKey();

      this._checkKey(priodata.key);

      if (this.datasets[priodata.key])
        this.datasets[priodata.key] = await ccm.helper.integrate(
          priodata,
          this.datasets[priodata.key],
        );
      else this.datasets[priodata.key] = priodata;

      return ccm.helper.clone(this.datasets[priodata.key]);
    }

    async del(key) {
      this._checkKey(key);
      const dataset = this.datasets[key];
      delete this.datasets[key];
      return ccm.helper.clone(dataset) || null;
    }

    async clear() {
      this.datasets = {};
    }

    async count(query) {
      return ccm.helper.runQuery(query, this.datasets).length;
    }
  }

  class OfflineStore extends Datastore {
    dbName = "ccm";
    database;

    async init() {
      super.init();

      const existingDB = await this.#pReq(indexedDB.open(this.dbName));
      if (existingDB.objectStoreNames.contains(this.name)) {
        this.#setupDatabase(existingDB);
        return;
      }

      const newVersion = existingDB.version + 1;
      existingDB.close();

      const request = indexedDB.open(this.dbName, newVersion);
      request.onupgradeneeded = (event) =>
        event.target.result.createObjectStore(this.name, { keyPath: "key" });

      this.#setupDatabase(await this.#pReq(request));
    }

    async get(key_or_query) {
      if (ccm.helper.isObject(key_or_query))
        return ccm.helper.runQuery(
          key_or_query,
          await this.#pReq(this.#getStore().getAll()),
        );

      this._checkKey(key_or_query);
      return this.#pReq(this.#getStore().get(key_or_query));
    }

    async set(priodata) {
      if (!priodata.key) priodata.key = ccm.helper.generateKey();

      this._checkKey(priodata.key);

      let dataset = await this.get(priodata.key);
      if (dataset) dataset = await ccm.helper.integrate(priodata, dataset);
      else dataset = priodata;

      await this.#pReq(this.#getStore("readwrite").put(dataset));
      return dataset;
    }

    async del(key) {
      this._checkKey(key);

      const dataset = await this.get(key);
      await this.#pReq(this.#getStore("readwrite").delete(key));
      return dataset || null;
    }

    async clear() {
      await super.clear();

      if (!(await this.count())) {
        const newVersion = this.database.version + 1;
        this.database.close();

        const request = indexedDB.open(this.dbName, newVersion);
        request.onupgradeneeded = (event) =>
          event.target.result.deleteObjectStore(this.name);

        this.#setupDatabase(await this.#pReq(request));
      }
    }

    async names() {
      return Array.from(this.database.objectStoreNames);
    }

    #getStore(mode = "readonly") {
      const tx = this.database.transaction(this.name, mode);
      return tx.objectStore(this.name);
    }

    #pReq(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
        request.onblocked = () => {
          console.error(
            `[IndexedDB] Open request blocked for '${this.dbName}'. Please close all other tabs that use this database.`,
          );
        };
      });
    }

    #setupDatabase(db) {
      db.onversionchange = () => {
        console.warn(
          `[IndexedDB] Database '${this.dbName}' version change detected. Closing connection.`,
        );
        console.log(
          "The local database was updated by another app. Please reload!",
        );
        db.close();
      };

      db.onclose = () => {
        console.log(`[IndexedDB] Database '${this.dbName}' connection closed.`);
      };

      this.database = db;
    }
  }

  class RemoteStore extends Datastore {
    user;

    async init() {
      super.init();

      this.user = ccm.helper.findInAncestors(this, "user");

      if (this.observe) {
        if (!this.onchange && this.parent) this.onchange = this.parent.start;
        this.connect();
      }
    }

    async get(key_or_query) {
      if (!ccm.helper.isObject(key_or_query)) this._checkKey(key_or_query);
      return this._send({ get: key_or_query });
    }

    async set(priodata) {
      if (!priodata.key) priodata.key = ccm.helper.generateKey();
      this._checkKey(priodata.key);
      return this._send({ set: priodata });
    }

    async del(key) {
      this._checkKey(key);
      return this._send({ del: key });
    }

    async names() {
      return this._send({ names: this.db });
    }

    async dbs() {
      return this._send({ names: "dbs" });
    }

    async _send(params = {}) {
      params.db = this.db || "";
      params.store = this.name;

      if (this.user?.isLoggedIn()) params.token = this.user.getState().token;
      if (this.token) params.token = this.token;

      try {
        return await ccm.load({ url: this.url, params });
      } catch (e) {
        if (this.user && (e.status === 401 || e.status === 403)) {
          try {
            await this.user.logout();
            await this.user.login();
            params.token = this.user.getState().token;
            return await ccm.load({ url: this.url, params });
          } catch (e) {
            if (this.parent) await ccm.helper.findRoot(this).start();
            else throw e;
          }
        } else throw e;
      }
    }

    connect() {
      this.socket = new WebSocket(this.url.replace("http", "ws"));
      this.socket.onopen = () => {
        this.socket.send(
          JSON.stringify({
            db: this.db,
            store: this.name,
            observe: this.observe,
          }),
        );
      };
      this.socket.onmessage = (message) => {
        try {
          this.onchange && this.onchange(JSON.parse(message.data));
        } catch (e) {
          console.error("Failed to parse WebSocket message:", message.data, e);
        }
      };
      this.socket.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      this.socket.onclose = (event) => {
        console.warn(
          `WebSocket closed, code=${event.code}, reason=${event.reason}`,
        );
        if (!this._manualClose && !this._reconnect) {
          this._reconnect = true;
          this.connect();
          delete this._reconnect;
        }
      };
    }

    close() {
      if (this.socket) {
        this._manualClose = true;
        this.socket.close();
        delete this._manualClose;
        this.socket = null;
      }
    }
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
