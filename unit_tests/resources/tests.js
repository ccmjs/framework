/**
 * @overview Unit tests for the ccmjs framework.
 * @author André Kless <andre.kless@web.de> (https://github.com/akless) 2023
 * @license The MIT License (MIT)
 */

(() => {
  let uut, expected, actual;
  ccm.files["tests.js"] = {
    setup: async (suite) => {
      await suite.ccm.load("./../ccm.js");
      uut = ccm;
      expected = actual = undefined;
    },
    tests: [
      function version(suite) {
        expected = "28.0.0";
        actual = uut.version();
        suite.assertEquals(expected, actual);
      },
    ],
    "ccm.load": {
      tests: [
        async function loadHTML(suite) {
          expected = "Hello, <b>World</b>!";
          actual = await uut.load("./dummy/hello.html");
          suite.assertEquals(expected, actual);

          actual = uut.helper.html(actual);
          suite.assertTrue(uut.helper.isElement(actual));

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
          actual = uut.helper.html2json(actual);
          suite.assertEquals(expected, actual);
        },
        async function loadHTMLTemplates(suite) {
          expected = {
            hello: "\n  Hello, <b>World</b>!\n",
            home: "\n  <h1>Welcome</h1>\n  <p>Hello, <b>World</b>!</p>\n",
          };
          actual = await uut.load("./dummy/templates.html");
          suite.assertEquals(expected, actual);

          actual = uut.helper.html(actual.hello);
          suite.assertTrue(uut.helper.isElement(actual));

          expected = "Hello, <b>World</b>!";
          actual = actual.innerHTML.trim();
          suite.assertEquals(expected, actual);
        },
        async function loadCSS(suite) {
          const url = "./dummy/style.css";
          expected = url;
          actual = await uut.load(url);
          suite.assertEquals(expected, actual);

          const query = `head > link[rel="stylesheet"][type="text/css"][href="${url}"]`;
          actual = document.querySelector(query);
          suite.assertTrue(uut.helper.isElement(actual));

          expected = "0px";
          actual = getComputedStyle(document.body).getPropertyValue("margin");
          suite.assertEquals(expected, actual);

          actual = "";
          expected = `loading of ${url} failed`;
          try {
            await uut.load({
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

          await uut.load({
            url,
            attr: {
              integrity:
                "sha384-RjoiwomcPuuT7xWNyE4qcAcC51FFmr1WTjKQviUZrZ5WNnfnQbKwnd3tKAGxzbSZ",
              crossorigin: "",
            },
          });
          suite.passed();

          expected = 3;
          actual = document.head.querySelectorAll(query).length;
          suite.assertEquals(expected, actual);
        },
        async function loadImage(suite) {
          const url = "./dummy/image.png";
          expected = url;
          actual = await uut.load(url);
          suite.assertEquals(expected, actual);
        },
        async function loadJS(suite) {
          const url = "./dummy/script.min.js";
          expected = { foo: "bar" };
          actual = await uut.load(url);
          suite.assertEquals(expected, actual);

          const query = `head > script[src="${url}"]`;
          expected = null;
          actual = document.querySelector(query);
          suite.assertEquals(expected, actual);

          actual = "";
          expected = `loading of ${url} failed`;
          try {
            await uut.load({
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

          await uut.load({
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
          actual = await uut.load(url);
          suite.assertEquals(expected, actual);

          expected = { foo: "bar" };
          actual = await uut.load(url + "#data");
          suite.assertEquals(expected, actual);

          expected = "bar";
          actual = await uut.load(url + "#data.foo");
          suite.assertEquals(expected, actual);

          expected = { data: { foo: "bar" }, name: "John" };
          actual = await uut.load(url + "#data#name");
          suite.assertEquals(expected, actual);
        },
        async function loadJSON(suite) {
          const url = "./dummy/data.json";
          const expected = { foo: "bar" };
          const actual = await uut.load(url);
          suite.assertEquals(expected, actual);
        },
        async function loadXML(suite) {
          const url = "./dummy/note.xml";
          let expected = XMLDocument;
          let actual = await uut.load(url);
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
          actual = await uut.load(
            "./dummy/hello.html",
            [
              "./dummy/style.css",
              ["./dummy/module.mjs#data", "./dummy/data.json"],
              "./dummy/script.min.js",
            ],
            "./dummy/image.png"
          );
          suite.assertEquals(expected, actual);
        },
        async function loadContext(suite) {
          const url = "./dummy/style.css";
          await uut.load({ url, context: document.body });
          suite.assertTrue(
            uut.helper.isElement(
              document.querySelector(
                `body > link[rel="stylesheet"][type="text/css"][href="${url}"]`
              )
            )
          );
        },
      ],
    },
    "ccm.helper": {
      tests: [
        function compareVersions(suite) {
          expected = 1;
          actual = uut.helper.compareVersions("3.0.0", "2.10.0");
          suite.assertEquals(expected, actual);

          expected = -1;
          actual = uut.helper.compareVersions("8.0.1", "8.0.10");
          suite.assertEquals(expected, actual);
        },
        function deepValue(suite) {
          const obj = { foo: { bar: [{ abc: "xyz" }] } };
          expected = "xyz";
          actual = uut.helper.deepValue(obj, "foo.bar.0.abc");
          suite.assertEquals(expected, actual);

          expected = { foo: { bar: "abc" } };
          actual = {};
          const result = uut.helper.deepValue(actual, "foo.bar", "abc");
          suite.assertEquals(expected, actual);

          expected = "abc";
          actual = result;
          suite.assertEquals(expected, actual);
        },
        function format(suite) {
          expected = "Hello, World!";
          actual = uut.helper.format("Hello, %name%!", { name: "World" });
          suite.assertEquals(expected, actual);

          const obj = { hello: "Hello, %name%!" };
          expected = { hello: "Hello, World!" };
          actual = uut.helper.format(obj, { name: "World" });
          suite.assertEquals(expected, actual);
        },
      ],
    },
  };
})();
