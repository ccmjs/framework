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
    "ccm.version": {
      tests: [
        async function call(suite) {
          expected = fv;
          actual = fut.version();
          suite.assertEquals(expected, actual);
        },
      ],
    },
    "ccm.load": {
      tests: [
        async function loadHTML(suite) {
          expected = "Hello, <b>World</b>!";
          actual = await fut.load("./dummy/hello.html");
          suite.assertEquals(expected, actual);

          actual = fut.helper.html(actual);
          suite.assertTrue(fut.helper.isElement(actual));

          actual = actual.innerHTML;
          suite.assertEquals(expected, actual);

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

          expected = {
            hello: "\n  Hello, <b>World</b>!\n",
            home: "\n  <h1>Welcome</h1>\n  <p>Hello, <b>World</b>!</p>\n",
          };
          actual = await fut.load("./dummy/templates.html");
          suite.assertEquals(expected, actual);

          actual = fut.helper.html(actual.hello);
          suite.assertTrue(fut.helper.isElement(actual));

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
            Instance: function () {
              this.start = async () => {};
            },
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
    "ccm.component": {
      tests: [
        async function registerByObject(suite) {
          let component;

          // using a minimal component object
          component = await fut.component({
            name: "component",
            ccm: "./../ccm.js",
            config: {},
            Instance: function () {
              this.start = async () => {};
            },
          });
          suite.assertTrue(fut.helper.isComponent(component)); // is a valid component
          suite.assertTrue(fut.helper.isCore(component.ccm)); // has framework object
          suite.assertEquals(fv, component.ccm.version()); // uses correct framework version
          suite.assertEquals("component", component.index); // has component index
          suite.assertEquals({}, component.ccm.components.component); // created global component namespace
          suite.assertTrue(typeof component.instances === "number"); // created instance counter
          suite.assertTrue(typeof component.instance === "function"); // has own instance method
          suite.assertTrue(typeof component.start === "function"); // has own start method

          // Once a component is registered, it cannot be manipulated.
          component.hack = true;
          component = await fut.component(component);
          suite.assertTrue(fut.helper.isComponent(component));
          suite.assertTrue(!component.hack);
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
              Instance: function () {
                this.start = async () => {};
              },
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
            Instance: function () {
              this.start = async () => {};
            },
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
              Instance: function () {
                this.start = async () => {};
              },
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
              Instance: function () {
                this.start = async () => {};
              },
            },
            ["ccm.load", "./dummy/configs.mjs#config"],
          );
          suite.assertEquals({ foo: "baz", val: true }, component.config);
        },
      ],
    },
    "ccm.instance": {
      tests: [
        async function create(suite) {
          suite.passed();
        },
      ],
    },
    "ccm.helper": {
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

          // Content without HTML tag
          html = "Hello, World!";
          expected = Text;
          actual = fut.helper.html(html);
          suite.assertTrue(actual instanceof expected);

          expected = "Hello, World!";
          actual = actual.textContent;
          suite.assertEquals(expected, actual);

          // Content with HTML tag
          html = "Hello, <b>World</b>!";
          expected = HTMLElement;
          actual = fut.helper.html(html);
          suite.assertTrue(actual instanceof expected);

          expected = "Hello, <b>World</b>!";
          actual = actual.innerHTML;
          suite.assertEquals(expected, actual);

          // Content with HTML tag and placeholder
          html = "Hello, <b>%name%</b>!";
          html = fut.helper.html(html, { name: "World" });
          actual = html.innerHTML;
          expected = "Hello, <b>World</b>!";
          suite.assertEquals(expected, actual);

          // Content with HTML tags, placeholder and click event
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

          // content without HTML tag
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
            Instance: function () {
              this.start = async () => {};
            },
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
            Instance: function () {
              this.start = async () => {};
            },
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
