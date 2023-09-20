/**
 * @overview Unit tests for the ccmjs framework.
 * @author André Kless <andre.kless@web.de> (https://github.com/akless) 2023
 * @license The MIT License (MIT)
 */

ccm.files["tests.js"] = {
  "ccm.load": {
    setup: async (suite) => {
      await suite.ccm.load("./../ccm.js");
      suite.uut = ccm;
    },
    tests: [
      async function loadHTML(suite) {
        let expected = "Hello, <b>World</b>!";
        let actual = await suite.uut.load("./dummy/hello.html");
        suite.assertEquals(expected, actual);

        actual = suite.uut.helper.html(actual);
        suite.assertTrue(suite.uut.helper.isElement(actual));

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
        actual = suite.uut.helper.html2json(actual);
        suite.assertEquals(expected, actual);
      },
      async function loadHTMLTemplates(suite) {
        let expected = {
          hello: "\n  Hello, <b>World</b>!\n",
          home: "\n  <h1>Welcome</h1>\n  <p>Hello, <b>World</b>!</p>\n",
        };
        let actual = await suite.uut.load("./dummy/templates.html");
        suite.assertEquals(expected, actual);

        actual = suite.uut.helper.html(actual.hello);
        suite.assertTrue(suite.uut.helper.isElement(actual));
        expected = "Hello, <b>World</b>!";
        actual = actual.innerHTML.trim();
        suite.assertEquals(expected, actual);
      },
    ],
  },
};
