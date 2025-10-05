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
        async function loadCSS(suite) {
          const url = "./dummy/style.css";
          expected = url;
          actual = await fut.load(url);
          suite.assertEquals(expected, actual);

          const query = `head > link[rel="stylesheet"][type="text/css"][href="${url}"]`;
          actual = document.querySelector(query);
          suite.assertTrue(fut.helper.isElement(actual));

          expected = "0px";
          actual = getComputedStyle(document.body).getPropertyValue("margin");
          suite.assertEquals(expected, actual);

          expected = `loading of ${url} failed`;
          actual = "";
          try {
            await fut.load({
              url,
              attr: {
                integrity: "sha384-x",
                crossorigin: "",
              },
            });
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          expected = url;
          actual = await fut.load({
            url,
            attr: {
              integrity:
                "sha384-RjoiwomcPuuT7xWNyE4qcAcC51FFmr1WTjKQviUZrZ5WNnfnQbKwnd3tKAGxzbSZ",
              crossorigin: "",
            },
          });
          suite.assertEquals(expected, actual);

          expected = 3;
          actual = document.head.querySelectorAll(query).length;
          suite.assertEquals(expected, actual);
        },
        async function loadImage(suite) {
          const url = "./dummy/image.png";

          expected = url;
          const start1 = performance.now();
          actual = await fut.load(url);
          const end1 = performance.now();
          suite.assertEquals(expected, actual);

          const start2 = performance.now();
          actual = await fut.load(url);
          const end2 = performance.now();
          end2 - start2 < end1 - start1
            ? suite.passed()
            : suite.failed("Image should be loaded from cache.");
        },
        async function loadJS(suite) {
          let url = "./dummy/dummy.js";
          expected = url;
          actual = await fut.load(url);
          suite.assertEquals(expected, actual);

          url = "./dummy/script.js";
          expected = { foo: "bar" };
          actual = await fut.load(url);
          suite.assertEquals(expected, actual);

          const query = `head > script[src="${url}"]`;
          expected = null;
          actual = document.querySelector(query);
          suite.assertEquals(expected, actual);

          actual = "";
          expected = `loading of ${url} failed`;
          try {
            await fut.load({
              url,
              attr: {
                integrity: "sha384-x",
                crossorigin: "",
              },
            });
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          await fut.load({
            url,
            attr: {
              integrity:
                "sha384-6wt5L34ia4nMOnVRL++defJ1AQii2ChOENX3oLFIT3pUDLmaA1U3RwPFBgjGPulG",
              crossorigin: "",
            },
          });
          suite.passed();

          expected = {};
          actual = window.ccm.files;
          suite.assertEquals(expected, actual);
        },
        async function loadModule(suite) {
          const url = "./dummy/module.mjs";
          expected = { data: { foo: "bar" }, name: "John", valid: true };
          actual = await fut.load(url);
          suite.assertEquals(expected, actual);

          expected = { foo: "bar" };
          actual = await fut.load(url + "#data");
          suite.assertEquals(expected, actual);

          expected = "bar";
          actual = await fut.load(url + "#data.foo");
          suite.assertEquals(expected, actual);

          expected = { data: { foo: "bar" }, name: "John" };
          actual = await fut.load(url + "#data#name");
          suite.assertEquals(expected, actual);
        },
        async function loadJSON(suite) {
          const url = "./dummy/data.json";
          const expected = { foo: "bar" };
          const actual = await fut.load(url);
          suite.assertEquals(expected, actual);
        },
        async function loadXML(suite) {
          const url = "./dummy/note.xml";
          let expected = XMLDocument;
          let actual = await fut.load(url);
          suite.assertTrue(actual instanceof expected);

          expected = "bar";
          actual = actual.querySelector("foo").textContent;
          suite.assertEquals(expected, actual);
        },
        async function loadMultiple(suite) {
          expected = [
            "Hello, <b>World</b>!",
            [
              "./dummy/style.css",
              [{ foo: "bar" }, { foo: "bar" }],
              { foo: "bar" },
            ],
            "./dummy/image.png",
          ];
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
        async function loadContext(suite) {
          let context;
          const url = "./dummy/style.css";
          const query = `link[rel="stylesheet"][type="text/css"][href="${url}"]`;

          context = document.body;
          await fut.load({ url, context });
          suite.assertTrue(
            fut.helper.isElement(document.querySelector(`body > ${query}`)),
          );

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
        async function registerByObject(suite) {
          let component;

          // using a minimal component object
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

          // Once a component is registered, it cannot be manipulated.
          component.hack = true;
          component = await fut.component(component);
          suite.assertTrue(fut.helper.isComponent(component));
          suite.assertFalse(component.hack);
        },
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
        },
        async function invalidComponentCheck(suite) {
          // When registering a component via the URL, the filename is checked for the correct format.
          expected = "invalid component filename: ccm_dummy.js";
          actual = "";
          try {
            await fut.component("./dummy/ccm_dummy.js");
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // Registration checks whether it is a valid component object.
          expected = "invalid component: [object Object]";
          actual = "";
          try {
            await fut.component({});
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // When the component is loaded with SRI, it checks whether the hashes match.
          expected = "loading of ./dummy/ccm.dummy.js failed";
          actual = "";
          try {
            await fut.component("./dummy/ccm.dummy.js#sha384-wrong-hash");
          } catch (error) {
            actual = error.message;
          }
          suite.assertEquals(expected, actual);

          // SRI can also be used to load the framework version used by the component.
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
          suite.assertTrue(ready); // ready callback has been called
          suite.assertFalse(component.ready); // ready callback has been deleted
        },
        async function adjustedDefaultConfiguration(suite) {
          const component = await fut.component(
            {
              name: "component",
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
          // check if priority data for default configuration was integrated correctly
          suite.assertEquals(
            { val: true, arr: [1, 2, 4], obj: { foo: "baz" } },
            component.config,
          );
        },
        async function adjustedViaDataDependency(suite) {
          // Using a data dependency to reference the priority data for the default configuration.
          const component = await fut.component(
            {
              name: "component",
              ccm: "./../ccm.js",
              config: { foo: "bar" },
              Instance: function () {},
            },
            ["ccm.load", "./dummy/configs.mjs#config"],
          );
          suite.assertEquals({ foo: "baz", val: true }, component.config);
        },
        async function backwardCompatibility(suite) {
          // tests backward compatibility for all compatible major versions of ccm.js
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

          async function testVersion(version) {
            const component = await fut.component(
              {
                name: "dummy",
                ccm: "https://ccmjs.github.io/ccm/ccm.js",
                config: {},
                Instance: function () {},
              },
              {
                ccm: `https://ccmjs.github.io/ccm/versions/ccm-${version}.js`,
              },
            );
            suite.assertTrue(suite.ccm.helper.isComponent(component));
            suite.assertEquals(
              version,
              suite.ccm.helper.isObject(component.ccm)
                ? component.ccm.version()
                : ccm[version].version(),
            );
          }
        },
      ],
    },
    instance: {
      tests: [
        async function createByObject(suite) {
          const instance = await fut.instance({
            name: "component",
            ccm: "./../ccm.js",
            config: {},
            Instance: function () {
              this.start = async () => {};
            },
          });
          suite.assertTrue(fut.helper.isInstance(instance)); // is a valid component instance
          suite.assertTrue(fut.helper.isComponent(instance.component)); // has a valid component reference
          suite.assertTrue(fut.helper.isCore(instance.ccm)); // has a valid framework reference
          suite.assertEquals(fv, instance.ccm.version()); // uses the correct framework version
          suite.assertEquals(1, instance.id); // has the correct instance id
          suite.assertEquals("component-1", instance.index); // has the correct instance index
          suite.assertEquals(undefined, instance.parent); // has no parent
          suite.assertEquals({}, instance.children); // has zero children
          suite.assertEquals("{}", instance.config); // knows her own config as JSON string
          suite.assertEquals(undefined, instance.inner); // has no light DOM
          suite.assertTrue(fut.helper.isElement(instance.root)); // has root element reference
          suite.assertTrue(fut.helper.isElement(instance.shadow)); // has Shadow DOM reference
          suite.assertTrue(fut.helper.isElement(instance.element)); // has content element reference
          suite.assertSame("closed", instance.shadow.mode); // Shadow DOM is closed
          suite.assertSame(null, instance.root.shadowRoot); // the root element has no access to the closed Shadow DOM
          suite.assertSame(null, instance.shadow.parentNode); // the closed Shadow DOM has no access to the root element
          suite.assertSame(instance.shadow, instance.element.parentNode); // the Shadow DOM contains the content element
          suite.assertEquals(
            '<div><div id="component-1"></div></div>',
            instance.root.parentElement.outerHTML,
          ); // the webpage area is an empty div element that contains an empty root element with the instance index as HTML ID
          suite.assertTrue(
            document.head.querySelector(":scope > #ccm_keyframe"),
          ); // keyframe animation for the loading placeholder is in the Shadow DOM
          suite.assertTrue(
            instance.element.querySelector(":scope > .ccm_loading"),
          ); // loading placeholder is shown in the content element
          suite.assertTrue(typeof instance.start === "function"); // has own start method
        },
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

          // Creation of an instance via the URL.
          const url = "./dummy/ccm.dummy.js";
          const instance = await fut.instance(url);
          suite.assertTrue(fut.helper.isInstance(instance));
        },
        async function createWithConfig(suite) {
          const instance = await fut.instance(
            {
              name: "component",
              ccm: "./../ccm.js",
              config: {
                val: false,
                arr: [1, 2, 3],
                obj: { foo: "bar" },
                shadow: "open",
                css: ["ccm.load", "./dummy/style.css"], // not working when root is not moved temporary into <head>
                comp: ["ccm.component", "./dummy/ccm.dummy.js"],
                inst: [
                  "ccm.instance",
                  "./dummy/ccm.dummy2.js",
                  {
                    ccm: null,
                    config: {
                      ccm: null,
                      config: ["ccm.load", "./dummy/configs.mjs#config"],
                      obj: null,
                    },
                    arr: [1, 2, 3],
                    obj: { foo: "bar" },
                    data: ["ccm.load", "./dummy/data.json"],
                    ignore: ["ccm.load", "./dummy/data.json"],
                    shadow: "none",
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
              ccm: null,
              val: true,
              "arr.2": 4,
              "obj.foo": "baz",
            },
          );
          suite.assertTrue(instance.val);
          suite.assertEquals([1, 2, 4], instance.arr);
          suite.assertEquals({ foo: "baz" }, instance.obj);
          suite.assertTrue(fut.helper.isComponent(instance.comp));
          suite.assertTrue(fut.helper.isInstance(instance.inst));
          suite.assertTrue(fut.helper.isInstance(instance.other));
          suite.assertTrue(instance.other.started);
          suite.assertEquals(
            ["ccm.load", "./dummy/data.json"],
            instance.ignore.data,
          );
          suite.assertEquals(
            '{"foo":"baz","val":true,"obj":{"foo":"bar"},"arr":[1,2,3],"data":["ccm.load","./dummy/data.json"],"ignore":["ccm.load","./dummy/data.json"],"shadow":"none"}',
            instance.inst.config,
          );
          suite.assertEquals({ foo: "bar" }, instance.inst.data);
          suite.assertEquals(
            ["ccm.load", "./dummy/data.json"],
            instance.inst.ignore,
          );
          suite.assertTrue(fut.helper.isCore(instance.ccm));
          suite.assertTrue(fut.helper.isCore(instance.inst.ccm));
          suite.assertSame("open", instance.shadow.mode); // Shadow DOM is open
          suite.assertSame(instance.shadow, instance.root.shadowRoot); // the root element has access to the opened Shadow DOM
          suite.assertSame(null, instance.shadow.parentNode); // the opened Shadow DOM has no access to the root element
          suite.assertFalse(instance.inst.shadow); // inner instance has no shadow DOM
          suite.assertSame(
            instance.inst.root,
            instance.inst.element.parentNode,
          ); // the root element contains directly the content element
        },
        async function initReady(suite) {
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
        async function backwardCompatibility(suite) {
          // tests backward compatibility for all compatible major versions of ccm.js
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

          async function testVersion(version) {
            const instance = await fut.instance(
              {
                name: "dummy",
                ccm: "https://ccmjs.github.io/ccm/ccm.js",
                config: {},
                Instance: function () {},
              },
              {
                ccm: `https://ccmjs.github.io/ccm/versions/ccm-${version}.js`,
              },
            );
            suite.assertTrue(suite.ccm.helper.isInstance(instance));
            suite.assertEquals(
              version,
              suite.ccm.helper.isObject(instance.ccm)
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
          let flag = false;
          const instance = await fut.start({
            name: "component",
            ccm: "./../ccm.js",
            config: {},
            Instance: function () {
              this.start = async () => {
                flag = true;
                suite.assertEquals("component-1", this.index);
              };
            },
          });
          suite.assertTrue(fut.helper.isInstance(instance)); // is a valid component instance
        },
        async function backwardCompatibility(suite) {
          // tests backward compatibility for all compatible major versions of ccm.js
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

          async function testVersion(version) {
            const major = parseInt(version.split(".")[0]);
            let flag = false;
            const instance = await fut.start(
              {
                name: "backwards",
                ccm: "https://ccmjs.github.io/ccm/ccm.js",
                config: {},
                Instance: function () {
                  this.start =
                    major < 18 // before version 18, callbacks were used instead of promises
                      ? (callback) => {
                          flag = true;
                          callback();
                        }
                      : async () => (flag = true);
                },
              },
              {
                ccm: `https://ccmjs.github.io/ccm/versions/ccm-${version}.js`,
              },
            );
            suite.assertTrue(suite.ccm.helper.isInstance(instance));
            suite.assertTrue(flag);
            suite.assertEquals(
              version,
              suite.ccm.helper.isObject(instance.ccm)
                ? instance.ccm.version()
                : ccm[version].version(),
            );
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
