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
      await suite.ccm.load("./../ccm.js");
      fut = ccm[fv];
      expected = actual = undefined;
    },
    tests: [
      function version(suite) {
        expected = fv;
        actual = fut.version();
        suite.assertEquals(expected, actual);
      },
    ],
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
          expected = end2 - start2 < (end1 - start1) * 0.1;
          expected
            ? suite.passed()
            : suite.failed("Image should be loaded from cache.");
        },
        async function loadJS(suite) {
          const url = "./dummy/script.js";
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
          console.log(actual);
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
