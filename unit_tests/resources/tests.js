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
        console.log(suite.uut.version());
        const expected = await suite.uut.load("./dummy/hello.html");
        suite.assertEquals("Hello, <b>World</b>!", expected);
      },
    ],
  },
};
