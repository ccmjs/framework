"use strict";

/**
 * @overview ccmjs-based web component for unit testing
 * @author André Kless <andre.kless@web.de> (https://github.com/akless) 2016-2017, 2019-2020, 2022-2023
 * @license The MIT License (MIT)
 * @version 4.0.0
 * @domain https://ccmjs.github.io/testsuite/
 * @changes
 * version 4.0.0 (18.09.2023)
 * - uses ccm.js v27.5.0 as default
 * - uses helper.mjs v8.4.2 as default
 * - uses unit tests from tests.js as default
 * - more than one assert call in one unit test
 */

(() => {
  const component = {
    name: "testsuite",
    ccm: "././libs/ccm/ccm.js",
    config: {
      css: ["ccm.load", "././resources/styles.css"],
      helper: ["ccm.load", { url: "././libs/ccm/helper.js", type: "module" }],
      html: ["ccm.load", "././resources/templates.html"],
      onfinish: { log: true },
      // "package": "subpackage",
      tests: ["ccm.load", "././resources/tests.js"],
    },
    Instance: function () {
      /**
       * shortcut to helper functions
       * @private
       * @type {Object.<string,function>}
       */
      let $;

      /**
       * higher collected setup functions that have to be performed before each test
       * @type {Function[]}
       */
      const setups = [];

      /**
       * higher collected finalize functions that have to be performed after each test
       * @type {Function[]}
       */
      const finallies = [];

      /**
       * current result data
       * @type {Object}
       */
      let results;

      this.ready = async () => {
        // set shortcut to help functions
        $ = Object.assign({}, this.ccm.helper, this.helper);
        $.use(this.ccm);

        // no package path? => abort
        if (!this.package) return;

        // navigate to the relevant test package and collect setup and finally functions along the way
        const array = this.package.split(".");
        while (array.length > 0) {
          if (this.tests.setup) setups.push(this.tests.setup); // collect founded setup function
          if (this.tests.finally) finallies.unshift(this.tests.finally); // collect founded finalize function
          this.tests = this.tests[array.shift()];
        }
      };

      this.start = async () => {
        /**
         * own reference for inner functions
         * @type {Instance}
         */
        const self = this;

        // set initial result data
        results = {
          executed: 0, // number of executed tests
          passed: 0, // number of passed tests
          failed: 0, // number of failed tests
          details: {}, // detailed test results
        };

        let main_elem, packages_elem, test_elem, table_elem, result_elem;

        // has website area? => render main HTML structure
        if (self.element) {
          main_elem = $.html(self.html.main);
          packages_elem = main_elem.querySelector("#packages");
          $.setContent(self.element, main_elem);
        }

        // process relevant test package (including all subpackages)
        await processPackage(self.package, self.tests, setups, finallies);

        // perform finish actions
        await $.onFinish(self);

        /**
         * processes the current unit test package (recursive)
         * @param {string} package_path - path to current test package
         * @param {Object} package_obj - current test package
         * @param {Function[]} setups - setup functions that have to be performed before each test
         * @param {Function[]} finallies - finalize functions that have to be performed after each test
         * @returns {Promise<void>}
         */
        async function processPackage(
          package_path = "",
          package_obj = {},
          setups,
          finallies,
        ) {
          // has setup function? => add her to (cloned) setup functions
          if (package_obj.setup) {
            setups = setups.slice();
            setups.push(package_obj.setup);
          }

          // has finalize function? => add her to (cloned) finallies functions
          if (package_obj.finally) {
            finallies = finallies.slice();
            finallies.unshift(package_obj.finally);
          }

          // perform all tests of the current package
          package_obj.tests && (await runPackageTests(package_obj.tests));

          // remove no more needed properties (only package properties remain)
          delete package_obj.setup;
          delete package_obj.tests;
          delete package_obj.finally;

          // process the unit tests subpackages
          for (const key in package_obj) {
            const subpackage = package_obj[key];
            delete package_obj[key];
            await processPackage(
              (package_path ? package_path + "." : "") + key,
              subpackage,
              setups,
              finallies,
            );
          }

          /**
           * performs all directly contained unit tests of the current package
           * @param {Function[]} tests - unit tests
           * @returns {Promise<void>}
           */
          async function runPackageTests(tests) {
            // has website area? => render (empty) test package
            if (self.element) {
              const package_elem = $.html(self.html.package, package_path);
              table_elem = package_elem.querySelector(".table");
              packages_elem.appendChild(package_elem);
            }

            // run unit tests
            await $.asyncForEach(
              Object.keys(tests).map((key) => tests[key]),
              async (test) => {
                // has website area? => add table row with loading icon
                if (self.element) {
                  // show with a loading icon that another test will be executed
                  main_elem
                    .querySelector("#executed")
                    .appendChild($.loading(self));

                  // render table row for current test
                  test_elem = $.html(self.html.test, test.name);
                  table_elem.appendChild(test_elem);

                  // show loading icon until unit test is finished
                  result_elem = test_elem.querySelector(".result");
                  result_elem.appendChild($.loading(self));
                }

                /**
                 * test suite object for the current unit test
                 * @type {Object}
                 */
                const suite = {
                  ccm: self.ccm, // provide reference to ccm framework

                  /**
                   * finishes current test with a positive result
                   * @function passed
                   */
                  passed: () => setResult(true),

                  /**
                   * finishes current test with a negative result
                   * @function failed
                   * @param {string} [message] - message that explains why the test has failed
                   */
                  failed: (message) => {
                    setResult(false, message);
                  },

                  /**
                   * finishes current test with positive result if the given condition is true
                   * @function assertTrue
                   * @param {boolean} condition
                   */
                  assertTrue: (condition) => setResult(!!condition),

                  /**
                   * finishes current test with negative result if the given condition is true
                   * @function assertFalse
                   * @param {boolean} condition
                   */
                  assertFalse: (condition) => setResult(!condition),

                  /**
                   * finishes current test with positive result if given expected and actual value contains same data (compare by reference)
                   * @function assertSame
                   * @param {*} expected - expected value
                   * @param {*} actual - actual value
                   */
                  assertSame: (expected, actual) => {
                    setResult(expected == actual, { expected, actual });
                  },

                  /**
                   * finishes current test with positive result if given expected value equals given actual value (compare by content)
                   * @function assertEquals
                   * @param {*} expected - expected value
                   * @param {*} actual - actual value
                   * @param {*} [delta] - difference allowed when comparing floats
                   */
                  assertEquals: (expected, actual, delta) => {
                    if (typeof expected === "object")
                      expected = JSON.stringify(expected);
                    if (typeof actual === "object")
                      actual = JSON.stringify(actual);
                    setResult(
                      delta
                        ? Math.abs(expected - actual) < delta
                        : expected === actual,
                      { expected, actual },
                    );
                  },

                  /**
                   * finishes current test with positive result if given expected and actual value NOT contains same data (compare by reference)
                   * @function assertNotSame
                   * @param {*} expected - expected value
                   * @param {*} actual - actual value
                   */
                  assertNotSame: (expected, actual) =>
                    setResult(expected !== actual),

                  /**
                   * finishes current test with positive result if given expected value NOT equals given actual value (compare by content)
                   * @function assertNotEquals
                   * @param {*} expected - expected value
                   * @param {*} actual - actual value
                   */
                  assertNotEquals: (expected, actual) =>
                    suite.assertNotSame(
                      JSON.stringify(expected),
                      JSON.stringify(actual),
                    ),
                };

                await $.asyncForEach(setups, async (setup) => setup(suite)); // run setup functions
                results.executed++; // increase counters for executed tests

                // run current unit test (with error handling)
                try {
                  await test(suite);
                } catch (e) {
                  suite.abort
                    ? console.error(e)
                    : setResult(
                        false,
                        e.name + (e.message ? ": " + e.message : ""),
                      );
                }

                // show test result
                showResult();

                // has website area? => update summary section
                if (self.element) {
                  main_elem.querySelector("#executed").innerHTML =
                    results.executed.toString();
                  main_elem.querySelector("#passed").innerHTML =
                    results.passed.toString();
                  main_elem.querySelector("#failed").innerHTML =
                    results.failed.toString();
                }

                // run all relevant finally functions
                await $.asyncForEach(finallies, (final) => final(suite));

                /**
                 * sets the test result
                 * @param {boolean} result - test result
                 * @param {string|{expected,actual}} message - message or expected and actual value when test is failed
                 */
                function setResult(result, message) {
                  if (suite.abort) return;
                  suite.result = result;
                  if (result) return;
                  suite.abort = true;
                  if (!message) return;
                  if (typeof message === "string") suite.message = message;
                  else {
                    suite.expected = message.expected;
                    suite.actual = message.actual;
                  }
                }

                /** replaces loading icon with test result and increases passed or failed counter */
                function showResult() {
                  // show result
                  const value = suite.result ? "passed" : "failed";
                  suite.result ? results.passed++ : results.failed++;
                  self.element &&
                    $.setContent(
                      result_elem,
                      $.html(self.html.result, { value: value }),
                    );
                  results.details[package_path + "." + test.name] =
                    suite.result;

                  // show optional message when test has failed
                  if (suite.message) {
                    if (self.element)
                      test_elem.appendChild(
                        $.html(self.html.message, suite.message),
                      );
                    results.details[package_path + "." + test.name] =
                      suite.message;
                  }

                  // show expected and actual value when test has failed
                  if (
                    !suite.result &&
                    suite.expected !== undefined &&
                    suite.actual !== undefined
                  ) {
                    if (self.element) {
                      if (typeof suite.expected === "object")
                        suite.expected = $.stringify(suite.expected);
                      suite.expected = $.escapeHTML(suite.expected);
                      if (typeof suite.actual === "object")
                        suite.actual = $.stringify(suite.actual);
                      suite.actual = $.escapeHTML(suite.actual);
                      test_elem.appendChild(
                        $.html(
                          self.html.comparison,
                          suite.expected,
                          suite.actual,
                        ),
                      );
                    }
                    results.details[package_path + "." + test.name] = {
                      expected: suite.expected,
                      actual: suite.actual,
                    };
                  }
                }
              },
            );
          }
        }
      };

      /** @returns {Object} current result data */
      this.getValue = () => $.clone(results);
    },
  };

  // File was loaded via ccm.load? => Set the component as the result.
  const filename =
    "ccm." +
    component.name +
    (component.version ? "-" + component.version.join(".") : "") +
    ".js";
  if (window.ccm?.files[filename] === null)
    return (window.ccm.files[filename] = component);

  // Automatic reloading of the required ccmjs framework version if necessary.
  let [url, ...integrity] = component.ccm.split("#");
  const version = url.match(/(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/)?.[0];
  if (!window.ccm?.[version]) {
    const element = document.createElement("script");
    element.src = url;
    integrity = integrity.join("#");
    if (integrity) {
      element.setAttribute("integrity", component.ccm.integrity);
      element.setAttribute("crossorigin", "");
    }
    element.onload = () => {
      proceed();
      document.head.removeChild(element);
    };
    document.head.appendChild(element);
  } else proceed();
  function proceed() {
    (window.ccm[version] || window.ccm).component(component);
  }
})();
