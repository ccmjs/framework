/**
 * @overview Unit tests for the ccm framework.
 * @author André Kless <andre.kless@web.de> (https://github.com/akless) 2023
 * @license The MIT License (MIT)
 */

(() => {
  let fut, expected, actual; // fut: framework under test
  const fv = "28.0.0"; // fv: framework version
  ccm.files["tests.js"] = {
    setup: async (suite) => {
      delete ccm[fv];
      await suite.ccm.load("./../ccm.js");
      fut = ccm[fv];
      expected = actual = undefined;
    },
    version: {
      tests: [
        async function call(suite) {
          expected = fv;
          actual = fut.version();
          suite.assertEquals(expected, actual);
        },
      ],
    },
    load: {
      tests: [
        /**
         * Tests the functionality of loading HTML files, converting them to DOM elements,
         * and serializing them to JSON. Also verifies the loading of template files and their conversion.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function loadHTML(suite) {
          // Load a single HTML file and verify its string content
          expected = "Hello, <b>World</b>!";
          actual = await fut.load("./dummy/hello.html");
          suite.assertEquals(expected, actual);

          // Convert the loaded string to a DOM element and verify its type
          actual = fut.helper.html(actual);
          suite.assertTrue(fut.helper.isElement(actual));

          // Extract and compare the innerHTML of the DOM element with the expected string
          actual = actual.innerHTML;
          suite.assertEquals(expected, actual);

          // Convert the HTML content to JSON and validate the structure
          expected = {
            inner: [
              "Hello, ",
              {
                inner: "World",
                tag: "b",
              },
              "!",
            ],
          };
          actual = fut.helper.html2json(actual);
          suite.assertEquals(expected, actual);

          // Load a template HTML file and verify the returned map of named templates
          expected = {
            hello: "\n  Hello, <b>World</b>!\n",
            home: "\n  <h1>Welcome</h1>\n  <p>Hello, <b>World</b>!</p>\n",
          };
          actual = await fut.load("./dummy/templates.html");
          suite.assertEquals(expected, actual);

          // Convert the "hello" template to a DOM node and verify its type
          actual = fut.helper.html(actual.hello);
          suite.assertTrue(fut.helper.isElement(actual));

          // Extract and compare the innerHTML of the "hello" template with the expected string
          expected = "Hello, <b>World</b>!";
          actual = actual.innerHTML.trim();
          suite.assertEquals(expected, actual);
        },

        /**
         * @summary Tests the functionality of loading CSS files and verifies their application.
         * @description
         * This test ensures that a CSS file can be loaded successfully, checks the presence of the corresponding
         * `<link>` element in the document, verifies the applied styles, and tests the handling of Subresource Integrity (SRI) checks.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function loadCSS(suite) {
          const url = "./dummy/style.css";

          // Verify that the URL of the loaded CSS file is returned as the result
          expected = url;
          actual = await fut.load(url);
          suite.assertEquals(expected, actual);

          // Check if the <link> element for the CSS file exists in the document head
          const query = `head > link[rel="stylesheet"][type="text/css"][href="${url}"]`;
          actual = document.querySelector(query);
          suite.assertTrue(fut.helper.isElement(actual));

          // Verify that the CSS file has been applied by checking the computed style
          expected = "0px";
          actual = getComputedStyle(document.body).getPropertyValue("margin");
          suite.assertEquals(expected, actual);

          // Test loading the CSS file with an invalid SRI hash and verify the error message
          expected = "error";
          actual = "";
          try {
            await fut.load({
              url,
              attr: {
                integrity: "sha256-wrong-hash",
                crossorigin: "",
              },
            });
          } catch (error) {
            actual = error.type;
          }
          suite.assertEquals(expected, actual);

          // Test loading the CSS file with a valid SRI hash and verify the result
          expected = url;
          actual = await fut.load({
            url,
            attr: {
              integrity: "sha256-Pme0qVBbJGACcvHOa2d2xK4uveiPdlWdSipR9gLYAMQ=",
              crossorigin: "",
            },
          });
          suite.assertEquals(expected, actual);
        },

        /**
         * @summary Tests the functionality of loading an image and verifies caching behavior.
         * @description
         * This test ensures that an image can be loaded successfully and checks if subsequent loads
         * are faster due to caching. The test compares the time taken for the first and second loads
         * to determine if the image is retrieved from the cache.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function loadImage(suite) {
          const url = "./dummy/image.png";

          // Verify that the URL of the loaded image is returned as the result
          expected = url;
          const start1 = performance.now();
          actual = await fut.load(url);
          const end1 = performance.now();
          suite.assertEquals(expected, actual);

          // Measure the time taken for the second load
          const start2 = performance.now();
          actual = await fut.load(url);
          const end2 = performance.now();

          // Compare the load times to verify caching behavior
          end2 - start2 < end1 - start1
            ? suite.passed()
            : suite.failed("Image should be loaded from cache.");
        },

        /**
         * @summary Tests the functionality of loading JavaScript files and verifies their behavior.
         * @description
         * This test ensures that JavaScript files can be loaded successfully, checks for proper handling
         * of Subresource Integrity (SRI) checks, and verifies that the script tag is removed after loading.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function loadJS(suite) {
          // Load a JavaScript file and verify the returned URL
          let url = "./dummy/script.js";
          expected = url;
          actual = await fut.load(url);
          suite.assertEquals(expected, actual);

          // Verify that the <script> tag has then been removed from the <head>
          const query = `head > script[src="${url}"]`;
          expected = null;
          actual = document.querySelector(query);
          suite.assertEquals(expected, actual);

          // Test loading the JavaScript file with an invalid SRI hash and verify the error message
          actual = "";
          expected = `loading of ${url} failed`;
          try {
            await fut.load({
              url,
              attr: {
                integrity: "sha256-wrong-hash",
                crossorigin: "",
              },
            });
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // Test loading the JavaScript file with a valid SRI hash and verify successful loading
          expected = url;
          actual = await fut.load({
            url,
            attr: {
              integrity: "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
              crossorigin: "",
            },
          });
          suite.assertEquals(expected, actual);

          // Verify that the <script> element is removed from the <head> after loading fails
          expected = null;
          actual = document.querySelector(`head > script[src="${url}"]`);
          suite.assertEquals(expected, actual);
        },

        /**
         * @summary Tests the functionality of loading an ES module and verifies its exported values.
         * @description
         * This test ensures that an ES module can be loaded successfully, checks for proper handling
         * of Subresource Integrity (SRI) checks, and verifies its exports. It also validates the module's
         * named exports, nested properties, and combinations of exports.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function loadModule(suite) {
          const url = "./dummy/module.mjs";

          // Verify the named exports of the module
          expected = { data: { foo: "bar" }, name: "John", valid: true };
          actual = await fut.load(url);
          suite.assertEquals(expected, actual);

          // Verify a specific named export from the module
          expected = { foo: "bar" };
          actual = await fut.load(url + "#data");
          suite.assertEquals(expected, actual);

          // Verify a nested property within a named export
          expected = "bar";
          actual = await fut.load(url + "#data.foo");
          suite.assertEquals(expected, actual);

          // Verify a combination of named exports
          expected = { data: { foo: "bar" }, name: "John" };
          actual = await fut.load(url + "#data#name");
          suite.assertEquals(expected, actual);

          // Test loading the module with an invalid SRI hash and verify the error message
          actual = "";
          expected = `loading of ${url} failed`;
          try {
            await fut.load({
              url,
              attr: {
                integrity: "sha256-wrong-hash",
                crossorigin: "",
              },
            });
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // Test loading the module with a valid SRI hash with SHA-256 and verify successful loading
          expected = { data: { foo: "bar" }, name: "John", valid: true };
          actual = await fut.load({
            url,
            attr: {
              integrity: "sha256-UbYrXTwEWM3+HFWnf22XZhN8zRUHbFzJlE6Fs6q9fV8=",
              crossorigin: "",
            },
          });
          suite.assertEquals(expected, actual);

          // Test loading the module with a valid SRI hash with SHA-384 and verify successful loading
          actual = await fut.load({
            url,
            attr: {
              integrity:
                "sha384-HUXdHqTt4miSLn4X4gaWsM8XlJuzTYeaIeI23MDnpjnUW2vRxWiDnG4XZBM49Vs9",
              crossorigin: "",
            },
          });
          suite.assertEquals(expected, actual);

          // Test loading the module with a valid SRI hash with SHA-512 and verify successful loading
          actual = await fut.load({
            url,
            attr: {
              integrity:
                "sha512-Ulhf2S10+YRZflRHtYHA8a5akIMAZds8CM60s3IqI17qqZZlUpQXgQjiTdtJy+WqAFEL5XotrHRQiTMUP0xEqw==",
              crossorigin: "",
            },
          });
          suite.assertEquals(expected, actual);
        },

        /**
         * @summary Tests the functionality of loading a JSON file and verifies its content.
         * @description
         * This test ensures that a JSON file can be loaded successfully and its content matches
         * the expected structure and values.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function loadJSON(suite) {
          const url = "./dummy/data.json";

          // Load the JSON file and verify its content
          const expected = { foo: "bar" };
          const actual = await fut.load(url);
          suite.assertEquals(expected, actual);
        },

        /**
         * @summary Tests the functionality of loading an XML file and verifies its content.
         * @description
         * This test ensures that an XML file can be loaded successfully and its content matches
         * the expected structure and values. It verifies the type of the loaded document and
         * checks the text content of a specific XML element.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function loadXML(suite) {
          const url = "./dummy/note.xml";

          // Load the XML file and verify that the result is an instance of XMLDocument
          let expected = XMLDocument;
          let actual = await fut.load(url);
          suite.assertTrue(actual instanceof expected);

          // Verify the text content of the <foo> element in the test XML file
          expected = "bar";
          actual = actual.querySelector("foo").textContent;
          suite.assertEquals(expected, actual);
        },

        /**
         * @summary Tests the functionality of loading multiple resources and verifies their results.
         * @description
         * This test ensures that multiple resources (HTML, CSS, JavaScript, JSON, etc.) can be loaded
         * simultaneously and their results match the expected values. It also verifies error handling
         * for failed resource loading and ensures the correct order of execution.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function loadMultiple(suite) {
          // Define the expected result for loading multiple resources
          expected = [
            "Hello, <b>World</b>!",
            [
              "./dummy/style.css",
              [{ foo: "bar" }, { foo: "bar" }],
              "./dummy/script.js",
            ],
            "./dummy/image.png",
          ];

          // Load multiple resources and verify the result
          actual = await fut.load(
            "./dummy/hello.html",
            [
              "./dummy/style.css",
              ["./dummy/module.mjs#data", "./dummy/data.json"],
              "./dummy/script.js",
            ],
            "./dummy/image.png",
          );
          suite.assertEquals(expected, actual);

          // Test error handling for a failed resource load
          actual = "";
          expected = `loading of ./dummy/script.min.js failed`;
          try {
            await fut.load(
              "./dummy/hello.html",
              [
                "./dummy/style.css",
                ["./dummy/module.mjs#data", "./dummy/data.json"],
                "./dummy/script.min.js",
              ],
              "./dummy/image.png",
            );
          } catch (results) {
            actual = results[1][2].message;
          }
          suite.assertEquals(expected, actual);

          // Verify the correct order of execution for nested resource loading
          window.actual = [0];
          expected = "./dummy/script5.min.js";
          actual = await fut.load(
            "./dummy/script1.min.js",
            [
              "./dummy/script2.min.js",
              ["./dummy/script3.min.js", "./dummy/script4.min.js"],
              "./dummy/script5.min.js",
            ],
            "./dummy/script6.min.js",
          );
          suite.assertEquals(expected, actual[1][2]);
          suite.assertEquals([3, 9, 5], window.actual);
        },

        /**
         * @summary Tests the functionality of loading a CSS file into different contexts.
         * @description
         * This test ensures that a CSS file can be loaded in the context of a DOM element and in the context of a ccmjs instance.
         * It verifies the presence of the corresponding `<link>` element in the specified context.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function loadContext(suite) {
          let context;
          const url = "./dummy/style.css";
          const query = `link[rel="stylesheet"][type="text/css"][href="${url}"]`;

          // Load the CSS file in the context of the <body> and verify the <link> element
          context = document.body;
          await fut.load({ url, context });
          suite.assertTrue(
            fut.helper.isElement(document.querySelector(`body > ${query}`)),
          );

          // Load the CSS file in the context of a ccmjs instance and verify the <link> element
          context = await fut.instance({
            name: "component",
            ccm: "./../ccm.js",
            config: {},
            Instance: function () {},
          });
          document.head.appendChild(context.root);
          await fut.load({ url, context });
          suite.assertTrue(
            fut.helper.isElement(
              context.element.parentNode.querySelector(query),
            ),
          );
        },
      ],
    },
    component: {
      tests: [
        /**
         * @summary Tests registration of a ccmjs component using a minimal component object.
         * @description
         * This function tests the registration of a ccmjs component by providing a minimal component object.
         * It verifies the validity of the registered component, its framework reference, version, index,
         * and other properties. Additionally, it ensures that once a component is registered, it cannot
         * be manipulated.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} - Resolves when the test completes.
         */
        async function registerByObject(suite) {
          let component;

          // Register a minimal component object.
          component = await fut.component({
            name: "component",
            ccm: "./../ccm.js",
            config: {},
            Instance: function () {},
          });
          suite.assertTrue(fut.helper.isComponent(component)); // is a valid component
          suite.assertTrue(fut.helper.isCore(component.ccm)); // has a valid framework reference
          suite.assertEquals(fv, component.ccm.version()); // uses the correct framework version
          suite.assertEquals("component", component.index); // has the correct component index
          suite.assertEquals({}, component.ccm.components.component); // created global component namespace
          suite.assertEquals(0, component.instances); // created instance counter starts with 0
          suite.assertTrue(typeof component.instance === "function"); // has own instance method
          suite.assertTrue(typeof component.start === "function"); // has own start method

          // Ensure that registered component cannot be manipulated externally.
          component.hack = true;
          component = await fut.component(component);
          suite.assertTrue(fut.helper.isComponent(component));
          suite.assertFalse(component.hack);
        },

        /**
         * @summary Tests registration of a ccmjs component via URL and verifies related behaviors.
         * @description
         * This function tests the registration of a ccmjs component via its URL. It ensures that:
         * - Only already registered components can be used via their index.
         * - Components can be registered using a valid URL.
         * - Registered components retain their URL information.
         * - Components can be accessed via their index after registration.
         * - Re-registering a component via its URL uses the index instead of the URL.
         * - Components can be loaded with valid Subresource Integrity (SRI) hashes.
         * - Loading of the ccmjs version referenced by the component with a valid SRI hash.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function registerByURL(suite) {
          let component;

          // Only an already registered component can be used via its component index.
          expected = "invalid component: dummy";
          actual = "";
          try {
            await fut.component("dummy");
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // Registration of a component via the URL.
          const url = "./dummy/ccm.dummy.js";
          component = await fut.component(url);
          suite.assertTrue(fut.helper.isComponent(component));

          // A component knows the URL from which it was loaded.
          suite.assertEquals(url, component.url);

          // After registration, the component can also be used via its index.
          component = await fut.component("dummy");
          suite.assertTrue(fut.helper.isComponent(component));

          // If an already registered component is used via its URL, the URL is ignored and the component index is extracted from the URL instead.
          component = await fut.component("./not_exist/ccm.dummy.js");
          suite.assertTrue(fut.helper.isComponent(component));

          // Load component with valid SRI hash
          component = await fut.component(
            "./dummy/ccm.dummy.js#sha256-JqPRGv730LFBWHeLAxarXc4W5rI3djioGnx6Z9hEyiQ=",
          );
          suite.assertTrue(fut.helper.isComponent(component));

          // Load the ccmjs version used by the component with a valid SRI hash.
          component = await fut.component({
            name: "component",
            ccm: "./libs/ccm/ccm.js#sha256-qVMXqL/Zq1w9z0bA/N007k6/MzVDSjNEu0IJAv3onac=",
            config: {},
            Instance: function () {},
          });
          suite.assertTrue(fut.helper.isComponent(component));
        },

        /**
         * @summary Tests the handling of invalid component registrations and verifies error messages.
         * @description
         * This function tests the handling of various invalid component registrations. It ensures that:
         * - Invalid component filenames are correctly detected.
         * - Invalid component definitions are correctly detected.
         * - Components with invalid Subresource Integrity (SRI) hashes are correctly detected.
         * - Components referencing ccmjs versions with invalid SRI hashes are correctly detected.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function invalidComponentCheck(suite) {
          // Invalid component filenames are correctly detected.
          expected = "invalid component filename: ccm_dummy.js";
          actual = "";
          try {
            await fut.component("./dummy/ccm_dummy.js");
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // Invalid component definitions are correctly detected.
          expected = "invalid component: [object Object]";
          actual = "";
          try {
            await fut.component({});
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // Components with invalid SRI hashes are correctly detected.
          expected = "loading of ./dummy/ccm.dummy.js failed";
          actual = "";
          try {
            await fut.component("./dummy/ccm.dummy.js#sha384-wrong-hash");
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // Components referencing ccmjs versions with invalid SRI hashes are correctly detected.
          expected = "loading of ./libs/ccm/ccm.js failed";
          actual = "";
          try {
            await fut.component({
              name: "component",
              ccm: "./libs/ccm/ccm.js#sha384-wrong-hash",
              config: {},
              Instance: function () {},
            });
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);
        },

        /**
         * @summary Tests the execution of the 'ready' callback during component registration.
         * @description
         * This function tests the execution of the 'ready' callback function provided in the component definition.
         * It ensures that:
         * - The 'ready' callback is called during component registration.
         * - The 'ready' callback is removed from the component definition after execution.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function withReadyCallback(suite) {
          let ready = false;
          const component = await fut.component({
            name: "component",
            ccm: "./../ccm.js",
            config: {},
            ready: async () => {
              ready = true;
            },
            Instance: function () {},
          });
          suite.assertTrue(ready);
          suite.assertFalse(component.ready);
        },

        /**
         * @summary Tests the integration of priority data into the default configuration of a component.
         * @description
         * This function tests the integration of priority data into the default configuration of a component.
         * It ensures that:
         * - Priority data provided during component registration correctly overrides the default configuration.
         * - Priority data provided via a data dependency correctly overrides the default configuration.
         * - A base configuration correctly integrates with priority data.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function adjustedDefaultConfiguration(suite) {
          const expected = { val: true, arr: [1, 2, 4], obj: { foo: "baz" } };
          let component;

          // Directly providing priority data that overrides the default configuration.
          component = await fut.component(
            {
              name: "component1",
              ccm: "./../ccm.js",
              config: {
                val: false,
                arr: [1, 2, 3],
                obj: { foo: "bar" },
              },
              Instance: function () {},
            },
            {
              val: true,
              "arr.2": 4,
              "obj.foo": "baz",
            },
          );
          suite.assertEquals(expected, component.config);

          // Providing priority data via a data dependency that overrides the default configuration.
          component.name = "component2";
          component.config.arr = [1, 2];
          component = await fut.component(component, [
            "ccm.load",
            "./dummy/configs.mjs#config", // contains also a base config
          ]);
          suite.assertEquals(
            { val: true, arr: [1, 2, 4], obj: { foo: "baz" } },
            component.config,
          );
        },

        /**
         * Tests backward compatibility of registration and loading of components with various ccmjs versions.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function backwardCompatibility(suite) {
          // Test compatibility with various major ccmjs versions.
          await testVersion("27.5.0");
          await testVersion("26.4.4");
          await testVersion("25.5.3");
          await testVersion("24.2.0");
          await testVersion("23.0.2");
          await testVersion("22.7.2");
          await testVersion("21.2.0");
          await testVersion("20.9.1");
          await testVersion("19.0.0");
          await testVersion("18.6.8");
          await testVersion("17.0.0");
          await testVersion("16.7.0");
          await testVersion("15.0.2");
          await testVersion("14.3.0");
          await testVersion("13.1.0");
          await testVersion("12.12.0");
          await testVersion("11.5.0");
          await testVersion("10.2.0");
          await testVersion("9.2.0");
          await testVersion("8.1.0");

          /**
           * Test a specific ccmjs version for component compatibility.
           *
           * @param {string} version - The ccmjs version to test.
           * @returns {Promise<void>} - Resolves when the test completes.
           */
          async function testVersion(version) {
            if (parseInt(version.split(".").at(0)) >= 28) {
              await useComponent("./dummy/ccm.dummy.js", version);
            } else {
              await useComponent("./dummy/ccm.dummy3.js", version);
              await useComponent("./dummy/ccm.dummy4.js", version);
            }
          }

          /**
           * Load and verify a component with a specific ccmjs version.
           *
           * @param {string} component - The component URL to load.
           * @param {string} version - The ccmjs version to use.
           * @returns {Promise<void>} - Resolves when the test completes.
           */
          async function useComponent(component, version) {
            component = await fut.component(component, {
              ccm: `https://ccmjs.github.io/ccm/versions/ccm-${version}.js`,
            });
            suite.assertTrue(suite.ccm.helper.isComponent(component));
            suite.assertEquals(
              version,
              suite.ccm.helper.isCore(component.ccm)
                ? component.ccm.version()
                : ccm[version].version(),
            );
          }
        },
      ],
    },
    instance: {
      tests: [
        /**
         * @summary Tests creation of a ccmjs instance using a minimal component object.
         * @description
         * This function verifies the validity of the created instance, its component reference, framework reference,
         * instance ID, index, parent-child relationships, configuration, DOM elements, and methods.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function createByObject(suite) {
          // Creation of an instance via a minimal component object.
          const instance = await fut.instance({
            name: "component",
            ccm: "./../ccm.js",
            config: {},
            Instance: function () {
              this.start = async () => {};
            },
          });

          // Verify instance properties and methods.
          suite.assertTrue(fut.helper.isInstance(instance)); // is a valid ccmjs instance
          suite.assertTrue(fut.helper.isComponent(instance.component)); // has a valid component reference
          suite.assertTrue(fut.helper.isCore(instance.ccm)); // has a valid ccmjs reference
          suite.assertEquals(fv, instance.ccm.version()); // uses the correct ccmjs version
          suite.assertEquals(1, instance.id); // has the correct instance id
          suite.assertEquals("component-1", instance.index); // has the correct instance index
          suite.assertEquals(undefined, instance.parent); // has no parent
          suite.assertEquals({}, instance.children); // has zero children
          suite.assertEquals("{}", instance.config); // knows her own config as JSON string
          suite.assertEquals(undefined, instance.inner); // has no Light DOM
          suite.assertTrue(fut.helper.isElement(instance.host)); // has host element reference
          suite.assertTrue(fut.helper.isElement(instance.root)); // has shadow root reference
          suite.assertTrue(fut.helper.isElement(instance.element)); // has content element reference
          suite.assertSame("open", instance.root.mode); // the shadow root is open by default
          suite.assertSame(instance.root, instance.host.shadowRoot); // the root element has access to the open shadow root
          suite.assertSame(instance.root, instance.element.parentNode); // the shadow root contains the content element
          suite.assertTrue(
            document.head.querySelector(":scope > #ccm_keyframe"),
          ); // keyframe animation for the loading placeholder is in the Shadow DOM
          suite.assertTrue(
            instance.element.querySelector(":scope > .ccm_loading"),
          ); // loading placeholder is shown in the content element
          suite.assertTrue(typeof instance.start === "function"); // has own start method
        },

        /**
         * @summary Tests creation of a ccmjs instance via URL and verifies related behaviors.
         * @description
         * This function tests the creation of a ccmjs instance via its URL. It ensures that:
         * - Only already registered components can be used via their index.
         * - Instances can be created using a valid component URL.
         * - Created instances are valid ccmjs instances.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function createByURL(suite) {
          // Only an already registered component can be used via its component index.
          expected = "invalid component: dummy";
          actual = "";
          try {
            await fut.instance("dummy");
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // Creation of an instance via the component URL.
          const url = "./dummy/ccm.dummy.js";
          const instance = await fut.instance(url);
          suite.assertTrue(fut.helper.isInstance(instance));
          // Only an already registered component can be used via its component index.

          // Creation of a registered component instance via the index.
          suite.assertTrue(fut.helper.isInstance(await fut.instance("dummy")));
        },

        /**
         * @summary Tests creation of a ccmjs instance with adjusted configuration.
         * @description
         * This function verifies that the instance's configuration properties are correctly set based on
         * the provided adjustments, and checks various aspects of the instance's structure and behavior.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function createWithConfig(suite) {
          // Creation of an instance with adjusted configuration.
          const instance = await fut.instance(
            {
              name: "component",
              ccm: "./../ccm.js",
              config: {
                val: false,
                arr: [1, 2, 3],
                obj: { foo: "bar" },
                root: "closed",
                css: ["ccm.load", "./dummy/style.css"],
                comp: ["ccm.component", "./dummy/ccm.dummy.js"],
                inst: [
                  "ccm.instance",
                  "./dummy/ccm.dummy2.js",
                  {
                    config: {
                      config: ["ccm.load", "./dummy/configs.mjs#config"],
                      "arr.1": 3,
                    },
                    "arr.0": 2,
                    ignore: ["ccm.load", "./dummy/data.json"],
                    root: "none",
                  },
                ],
                other: ["ccm.start", "./dummy/ccm.dummy2.js"],
                //store: ["ccm.store", "./dummy/data.json"], // TODO: test ccm.store
                //get: ["ccm.get", "./dummy/data.json"], // TODO: test ccm.get
                ignore: {
                  data: ["ccm.load", "./dummy/data.json"],
                },
              },
              Instance: function () {},
            },
            {
              val: true,
              "arr.2": 4,
              "obj.foo": "baz",
            },
          );
          suite.assertTrue(instance.val); // val has changed to true
          suite.assertEquals([1, 2, 4], instance.arr); // arr[2] has changed to 4
          suite.assertEquals({ foo: "baz" }, instance.obj); // obj.foo has changed to "baz"
          suite.assertTrue(fut.helper.isCore(instance.ccm)); // has a valid ccmjs reference
          suite.assertSame("closed", instance.root.mode); // shadow root is closed
          suite.assertNotSame(instance.root, instance.host.shadowRoot); // the root element has no access to the closed shadow root
          suite.assertSame(instance.root, instance.element.parentNode); // the shadow root contains the content element
          suite.assertEquals(instance.css, "./dummy/style.css"); // ccm.load returns URL of loaded CSS file
          suite.assertTrue(fut.helper.isComponent(instance.comp)); // comp is a valid component
          suite.assertTrue(fut.helper.isInstance(instance.inst)); // inst is a valid instance
          suite.assertFalse(instance.inst.started); // inner instance is not started yet
          suite.assertTrue(instance.other.started); // other instance is already started
          suite.assertEquals(
            ["ccm.load", "./dummy/data.json"],
            instance.ignore.data,
          ); // everything in ignore remains unchanged
          suite.assertEquals([2, 3, 4], instance.inst.arr); // inner properties are adjusted correctly over multiple levels
          suite.assertEquals(
            ["ccm.load", "./dummy/data.json"],
            instance.inst.ignore,
          ); // a dependency in ignore remains unchanged
          suite.assertFalse(instance.inst.root); // inner instance has no shadow root
          suite.assertSame(
            instance.inst.host,
            instance.inst.element.parentNode,
          ); // the host element contains directly the content element
          suite.assertEquals(
            '{"val":true,"arr":[1,2,4],"obj":{"foo":"baz"},"root":"closed","css":["ccm.load","./dummy/style.css"],"comp":["ccm.component","./dummy/ccm.dummy.js"],"inst":["ccm.instance","./dummy/ccm.dummy2.js",{"config":{"config":["ccm.load","./dummy/configs.mjs#config"],"arr.1":3},"arr.0":2,"ignore":["ccm.load","./dummy/data.json"],"root":"none"}],"other":["ccm.start","./dummy/ccm.dummy2.js"],"ignore":{"data":["ccm.load","./dummy/data.json"]}}',
            instance.config,
          ); // knows her own config as JSON string
        },

        /**
         * @summary Tests the execution order of `init` and `ready` callbacks in nested ccmjs instances.
         * @description
         * This function creates a hierarchy of nested ccmjs instances to verify the execution order
         * of `init` and `ready` callbacks. It ensures that the callbacks are executed in the correct
         * sequence and validates the parent-child relationships between the instances.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function initReady(suite) {
          // Creation of nested instances to test init and ready callbacks.
          const actual = [];
          const instance = await fut.instance({
            name: "component1",
            ccm: "./../ccm.js",
            config: {
              inst: [
                "ccm.instance",
                {
                  name: "component2",
                  ccm: "./../ccm.js",
                  config: {
                    inst: [
                      "ccm.instance",
                      {
                        name: "component3",
                        ccm: "./../ccm.js",
                        config: {},
                        Instance: function () {
                          this.init = async () =>
                            actual.push("C-" + this.index);
                          this.ready = async () =>
                            actual.push("D-" + this.index);
                        },
                      },
                    ],
                    other: [
                      "ccm.instance",
                      {
                        name: "component4",
                        ccm: "./../ccm.js",
                        config: {},
                        Instance: function () {},
                      },
                    ],
                  },
                  Instance: function () {
                    this.init = async () => actual.push("B-" + this.index);
                    this.ready = async () => actual.push("E-" + this.index);
                  },
                },
              ],
            },
            Instance: function () {
              this.init = async () => actual.push("A-" + this.index);
              this.ready = async () => actual.push("F-" + this.index);
            },
          });

          // Verify the execution order of init and ready callbacks.
          suite.assertEquals(
            [
              "A-component1-1",
              "B-component2-1",
              "C-component3-1",
              "D-component3-1",
              "E-component2-1",
              "F-component1-1",
            ],
            actual,
          );

          // Verify parent-child relationships.
          suite.assertEquals(1, Object.keys(instance.children).length);
          suite.assertTrue(
            instance.children[instance.inst.index] === instance.inst,
          );
          suite.assertTrue(instance.inst.parent === instance);
          suite.assertEquals(2, Object.keys(instance.inst.children).length);
          instance.inst.children[instance.inst.inst.index] ===
            instance.inst.inst;
          instance.inst.children[instance.inst.other.index] ===
            instance.inst.other;
          suite.assertTrue(!Object.keys(instance.inst.inst.children).length);
          suite.assertTrue(instance.inst.inst.parent === instance.inst);
          suite.assertTrue(!Object.keys(instance.inst.other.children).length);
          suite.assertTrue(instance.inst.other.parent === instance.inst);
        },

        /**
         * Tests backward compatibility of creation of instances with various ccmjs versions.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function backwardCompatibility(suite) {
          // Test compatibility with various major ccmjs versions.
          await testVersion("27.5.0");
          await testVersion("26.4.4");
          await testVersion("25.5.3");
          await testVersion("24.2.0");
          await testVersion("23.0.2");
          await testVersion("22.7.2");
          await testVersion("21.2.0");
          await testVersion("20.9.1");
          await testVersion("19.0.0");
          await testVersion("18.6.8");
          await testVersion("17.0.0");
          await testVersion("16.7.0");
          await testVersion("15.0.2");
          await testVersion("14.3.0");
          await testVersion("13.1.0");
          await testVersion("12.12.0");
          await testVersion("11.5.0");
          await testVersion("10.2.0");
          await testVersion("9.2.0");

          /**
           * Test a specific ccmjs version for compatibility.
           *
           * @param {string} version - The ccmjs version to test.
           * @returns {Promise<void>} - Resolves when the test completes.
           */
          async function testVersion(version) {
            if (parseInt(version.split(".").at(0)) >= 28) {
              await useComponent("./dummy/ccm.dummy.js", version);
            } else {
              await useComponent("./dummy/ccm.dummy3.js", version);
              await useComponent("./dummy/ccm.dummy4.js", version);
            }
          }

          /**
           * Create and verify a ccmjs instance with a component of a specific ccmjs version.
           *
           * @param {string} component - The component URL to load.
           * @param {string} version - The ccmjs version to use.
           * @returns {Promise<void>} - Resolves when the test completes.
           */
          async function useComponent(component, version) {
            const instance = await fut.instance(component, {
              ccm: `https://ccmjs.github.io/ccm/versions/ccm-${version}.js`,
            });
            suite.assertTrue(suite.ccm.helper.isInstance(instance));
            suite.assertEquals(
              version,
              suite.ccm.helper.isCore(instance.ccm)
                ? instance.ccm.version()
                : ccm[version].version(),
            );
          }
        },
      ],
    },
    start: {
      tests: [
        async function createAndStart(suite) {
          const instance = await fut.start("./dummy/ccm.dummy2.js"); // create and start instance
          suite.assertTrue(fut.helper.isInstance(instance)); // is a valid ccmjs instance
          suite.assertTrue(instance.started); // instance is started
        },

        /**
         * Tests backward compatibility of creation and starting of instances with various ccmjs versions.
         *
         * @param {Object} suite - The test suite object providing assertion methods.
         * @returns {Promise<void>} Resolves when the test completes.
         */
        async function backwardCompatibility(suite) {
          // Test compatibility with various major ccmjs versions.
          await testVersion("27.5.0");
          await testVersion("26.4.4");
          await testVersion("25.5.3");
          await testVersion("24.2.0");
          await testVersion("23.0.2");
          await testVersion("22.7.2");
          await testVersion("21.2.0");
          await testVersion("20.9.1");
          await testVersion("19.0.0");
          await testVersion("18.6.8");
          await testVersion("17.0.0");
          await testVersion("16.7.0");
          await testVersion("15.0.2");
          await testVersion("14.3.0");
          await testVersion("13.1.0");
          await testVersion("12.12.0");
          await testVersion("11.5.0");
          await testVersion("10.2.0");
          await testVersion("9.2.0");

          /**
           * Test a specific ccmjs version for compatibility.
           *
           * @param {string} version - The ccmjs version to test.
           * @returns {Promise<void>} - Resolves when the test completes.
           */
          async function testVersion(version) {
            if (parseInt(version.split(".").at(0)) >= 28) {
              await useComponent("./dummy/ccm.dummy2.js", version);
            } else if (parseInt(version.split(".").at(0)) >= 18) {
              await useComponent("./dummy/ccm.dummy3.js", version);
              await useComponent("./dummy/ccm.dummy4.js", version);
            } else {
              await useComponent("./dummy/ccm.dummy5.js", version);
              await useComponent("./dummy/ccm.dummy6.js", version);
            }
          }

          /**
           * Create and start a ccmjs instance with a component of a specific ccmjs version.
           *
           * @param {string} component - The component URL to load.
           * @param {string} version - The ccmjs version to use.
           * @returns {Promise<void>} - Resolves when the test completes.
           */
          async function useComponent(component, version) {
            const instance = await fut.start(component, {
              ccm: `https://ccmjs.github.io/ccm/versions/ccm-${version}.js`,
            });
            suite.assertTrue(suite.ccm.helper.isInstance(instance));
            suite.assertEquals(
              version,
              suite.ccm.helper.isCore(instance.ccm)
                ? instance.ccm.version()
                : ccm[version].version(),
            );
            suite.assertTrue(instance.started);
          }
        },
      ],
    },
    helper: {
      tests: [
        function clone(suite) {
          let obj = {
            foo: "bar",
            arr: [window, ccm],
            valid: () => true,
            func: function () {},
          };
          obj.self = obj;
          expected = obj;
          actual = fut.helper.clone(obj);
          suite.assertNotSame(expected, actual);
        },
        function deepValue(suite) {
          const obj = { foo: { bar: [{ abc: "xyz" }] } };
          expected = "xyz";
          actual = fut.helper.deepValue(obj, "foo.bar.0.abc");
          suite.assertEquals(expected, actual);

          expected = { foo: { bar: "abc" } };
          actual = {};
          const result = fut.helper.deepValue(actual, "foo.bar", "abc");
          suite.assertEquals(expected, actual);

          expected = "abc";
          actual = result;
          suite.assertEquals(expected, actual);
        },
        function format(suite) {
          expected = "Hello, World!";
          actual = fut.helper.format("Hello, %name%!", { name: "World" });
          suite.assertEquals(expected, actual);

          expected = ["Hello", "World"];
          actual = fut.helper.format(["Hello", "%name%"], { name: "World" });
          suite.assertEquals(expected, actual);

          const onclick = () => console.log("click!");
          const obj = {
            hello: "Hello, %name%!",
            onclick: "%onclick%",
          };
          expected = { hello: "Hello, World!", onclick };
          actual = fut.helper.format(obj, { name: "World", onclick });
          suite.assertEquals(expected, actual);
          suite.assertTrue(typeof actual.onclick === "function");
        },
        function generateKey(suite) {
          actual = fut.helper.generateKey();
          suite.assertTrue(fut.helper.isKey(actual));
        },
        function html(suite) {
          let html;

          // content without an HTML tag
          html = "Hello, World!";
          expected = Text;
          actual = fut.helper.html(html);
          suite.assertTrue(actual instanceof expected);

          expected = "Hello, World!";
          actual = actual.textContent;
          suite.assertEquals(expected, actual);

          // content with HTML tag
          html = "Hello, <b>World</b>!";
          expected = HTMLElement;
          actual = fut.helper.html(html);
          suite.assertTrue(actual instanceof expected);

          expected = "Hello, <b>World</b>!";
          actual = actual.innerHTML;
          suite.assertEquals(expected, actual);

          // content with HTML tag and placeholder
          html = "Hello, <b>%name%</b>!";
          html = fut.helper.html(html, { name: "World" });
          actual = html.innerHTML;
          expected = "Hello, <b>World</b>!";
          suite.assertEquals(expected, actual);

          // content with HTML tags, placeholder and click event
          html =
            '<p>Hello, <b>%name%</b>! <button onclick="%click%"></button></p>';
          html = fut.helper.html(html, {
            name: "World",
            click: () => (actual = "World"),
          });
          expected = "Hello, <b>World</b>! <button></button>";
          actual = html.innerHTML;
          suite.assertEquals(expected, actual);

          expected = "World";
          actual = "";
          html.querySelector("button").click();
          suite.assertEquals(expected, actual);
        },
        function html2json(suite) {
          let html;

          // content without an HTML tag
          html = "Hello, World!";
          expected = "Hello, World!";
          actual = fut.helper.html2json(html);
          suite.assertEquals(expected, actual);

          // content with HTML tag
          html = "<p>Hello, <b>World</b>!</p>";
          expected = {
            inner: ["Hello, ", { inner: "World", tag: "b" }, "!"],
            tag: "p",
          };
          actual = fut.helper.html2json(html);
          suite.assertEquals(expected, actual);
        },
        async function isComponent(suite) {
          let value;

          value = await fut.component({
            name: "component",
            ccm: "./../ccm.js",
            config: {},
            Instance: function () {},
          });
          actual = fut.helper.isComponent(value);
          suite.assertTrue(actual);

          value = await fut.instance(value);
          actual = fut.helper.isComponent(value);
          suite.assertFalse(actual);
        },
        async function isDatastore(suite) {
          const value = await fut.store();
          actual = fut.helper.isDatastore(value);
          suite.assertTrue(actual);
        },
        function isElement(suite) {
          let value;

          value = document.body;
          actual = fut.helper.isElement(value);
          suite.assertTrue(actual);

          value = document.createElement("div");
          actual = fut.helper.isElement(value);
          suite.assertTrue(actual);

          value = document.createDocumentFragment();
          actual = fut.helper.isElement(value);
          suite.assertTrue(actual);
        },
        function isFramework(suite) {
          const value = window.ccm;
          actual = fut.helper.isFramework(value);
          suite.assertTrue(actual);
        },
        async function isInstance(suite) {
          let value;

          value = await fut.component({
            name: "component",
            ccm: "./../ccm.js",
            config: {},
            Instance: function () {},
          });
          actual = fut.helper.isInstance(value);
          suite.assertFalse(actual);

          value = await fut.instance(value);
          actual = fut.helper.isInstance(value);
          suite.assertTrue(actual);
        },
        function isKey(suite) {
          actual = fut.helper.generateKey();
          suite.assertTrue(fut.helper.isKey(actual));
        },
        function isNode(suite) {
          let value;

          value = document.body;
          actual = fut.helper.isNode(value);
          suite.assertTrue(actual);

          value = document.createElement("div");
          actual = fut.helper.isNode(value);
          suite.assertTrue(actual);

          value = document.createDocumentFragment();
          actual = fut.helper.isNode(value);
          suite.assertTrue(actual);

          value = document.createTextNode("Hello, World!");
          actual = fut.helper.isNode(value);
          suite.assertTrue(actual);

          value = document.createAttribute("disabled");
          actual = fut.helper.isNode(value);
          suite.assertTrue(actual);

          value = document.createComment("Hello, World!");
          actual = fut.helper.isNode(value);
          suite.assertTrue(actual);
        },
        function isObject(suite) {
          let value;

          value = null;
          actual = fut.helper.isObject(value);
          suite.assertFalse(actual);

          value = [];
          actual = fut.helper.isObject(value);
          suite.assertFalse(actual);

          value = {};
          actual = fut.helper.isObject(value);
          suite.assertTrue(actual);
        },
        function isPlainObject(suite) {
          let value;

          value = {};
          actual = fut.helper.isPlainObject(value);
          suite.assertTrue(actual);

          class Test {}
          value = new Test();
          actual = fut.helper.isPlainObject(value);
          suite.assertFalse(actual);

          value = function () {};
          actual = fut.helper.isPlainObject(value);
          suite.assertFalse(actual);
        },
      ],
    },
  };
})();
