"use strict";
/**
 * @version 28.0.0
 * @changes
 * Version 28.0.0
 * - ccm.load: resource data is no longer cloned
 * - ccm.load: removed timeout for loading resources
 * - ccm.load: JSON is loaded either via fetch API or JSONP (no longer via XMLHttpRequest)
 * - ccm.load: used HTTP method must be in upper case
 * - ccm.load: simplified error messages
 * - ccm.helper.html: dynamic parameters must be passed via an object
 */
(() => {
  const ccm = {
    version: () => "28.0.0",
    load: async (...resources) => {
      let results = [];
      let counter = 1;
      let failed = false;
      return new Promise((resolve, reject) => {
        resources.forEach((resource, i) => {
          counter++;
          if (Array.isArray(resource)) {
            results[i] = [];
            serial(null);
            return;
          }
          if (typeof resource === "string") resource = { url: resource };
          if (!resource.context) resource.context = document.head;
          if (ccm.helper.isInstance(resource.context))
            resource.context = resource.context.element.parentNode;
          getOperation()();

          function serial(result) {
            if (result !== null) results[i].push(result);
            if (!resource.length) return check();
            let next = resource.shift();
            if (!Array.isArray(next)) next = [next];
            ccm.load.apply(null, next).then(serial).catch(serial);
          }

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
            const suffix = resource.url
              .split(".")
              .pop()
              .split("?")
              .shift()
              .split("#")
              .shift()
              .toLowerCase();
            switch (suffix) {
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

          function loadHTML() {
            resource.type = "html";
            resource.method = "GET";
            loadJSON();
          }

          function loadCSS() {
            let element = {
              tag: "link",
              rel: "stylesheet",
              type: "text/css",
              href: resource.url,
            };
            if (resource.attr) element = Object.assign(element, resource.attr);
            element = ccm.helper.html(element);
            element.onload = () => success(resource.url);
            element.onerror = error;
            resource.context.appendChild(element);
          }

          function loadImage() {
            const image = new Image();
            image.src = resource.url;
            image.onload = success;
            image.onerror = error;
          }

          function loadJS() {
            const filename = resource.url
              .split("/")
              .pop()
              .split("?")
              .shift()
              .replace(".min.", ".");
            window.ccm.files[filename] = null;
            window.ccm.files["#" + filename] = window.ccm.files["#" + filename]
              ? window.ccm.files["#" + filename] + 1
              : 1;
            let element = { tag: "script", src: resource.url, async: true };
            if (resource.attr) element = Object.assign(element, resource.attr);
            element = ccm.helper.html(element);
            element.onload = () => {
              const data = window.ccm.files[filename];
              if (!--window.ccm.files["#" + filename]) {
                delete window.ccm.files[filename];
                delete window.ccm.files["#" + filename];
              }
              element.parentNode.removeChild(element);
              success(data);
            };
            element.onerror = () => {
              element.parentNode.removeChild(element);
              error();
            };
            resource.context.appendChild(element);
          }

          function loadModule() {
            let [url, ...keys] = resource.url.split("#");
            if (url.startsWith("./"))
              url = url.replace(
                "./",
                location.href.substring(0, location.href.lastIndexOf("/") + 1)
              );
            import(url).then((result) => {
              if (keys.length === 1) result = result[keys[0]];
              if (keys.length > 1) {
                const obj = {};
                keys.forEach((key) => (obj[key] = result[key]));
                result = obj;
              }
              success(result);
            });
          }

          function loadJSON() {
            (resource.method === "JSONP" ? jsonp : fetchAPI)();

            function jsonp() {
              const callback = "callback" + ccm.helper.generateKey();
              if (!resource.params) resource.params = {};
              resource.params.callback = "window.ccm.callbacks." + callback;
              let element = {
                tag: "script",
                src: buildURL(resource.url, resource.params),
              };
              if (resource.attr)
                element = Object.assign(element, resource.attr);
              element = ccm.helper.html(element);
              element.onerror = () => {
                element.parentNode.removeChild(element);
                error();
              };
              window.ccm.callbacks[callback] = (data) => {
                element.parentNode.removeChild(element);
                delete window.ccm.callbacks[callback];
                success(data);
              };
              resource.context.appendChild(script);
            }

            function fetchAPI() {
              if (resource.params)
                resource.method === "GET"
                  ? (resource.url = buildURL(resource.url, resource.params))
                  : (resource.body = ccm.helper.stringify(resource.params));
              fetch(resource.url, { ...resource })
                .then((response) => response.text())
                .then(success)
                .catch(error);
            }

            function buildURL(url, data) {
              if (ccm.helper.isObject(data.json))
                data.json = ccm.helper.stringify(data.json);
              return data ? url + "?" + params(data).slice(0, -1) : url;
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
          }

          function success(data) {
            if (data === undefined) return check();
            try {
              if (typeof data !== "object") data = ccm.helper.parse(data);
            } catch (e) {}
            if (resource.type === "html") {
              const regex =
                /<ccm-template key="(\w*?)">([^]*?)<\/ccm-template>/g;
              const result = {};
              let array;
              while ((array = regex.exec(data))) result[array[1]] = array[2];
              if (Object.keys(result).length) data = result;
            }
            results[i] = data;
            check();
          }

          function error() {
            failed = true;
            results[i] = Error(`loading of ${resource.url} failed`);
            check();
          }
        });
        check();

        function check() {
          if (--counter) return;
          if (results.length <= 1) results = results[0];
          (failed ? reject : resolve)(results);
        }
      });
    },
    helper: {
      compareVersions: (a, b) => {
        if (a === b) return 0;
        const a_arr = a.split(".");
        const b_arr = b.split(".");
        for (let i = 0; i < 3; i++) {
          const x = parseInt(a_arr[i]);
          const y = parseInt(b_arr[i]);
          if (x < y) return -1;
          else if (x > y) return 1;
        }
        return 0;
      },
      format: (data, values) => {
        const temp = [[], [], {}];
        const obj_mode = ccm.helper.isObject(data);
        data = ccm.helper.stringify(data, (key, val) => {
          if (typeof val === "function") {
            temp[0].push(val);
            return "%$0%";
          }
          return val;
        });
        for (let i = 0; i < values.length; i++) {
          if (typeof values[i] === "object") {
            for (const key in values[i])
              if (values[i].hasOwnProperty(key)) {
                if (typeof values[i][key] !== "string" && obj_mode) {
                  temp[2][key] = values[i][key];
                  values[i][key] = `%$2%${key}%`;
                }
                if (typeof values[i][key] !== "string") continue;
                data = data.replace(
                  new RegExp(`%${key}%`, "g"),
                  values[i][key].replace(/"/g, '\\"')
                );
              }
          } else {
            if (typeof values[i] !== "string" && obj_mode) {
              temp[1].push(values[i]);
              values[i] = "%$1%";
            }
            data = data.replace(/%%/, values[i].replace(/"/g, '\\"'));
          }
        }
        return ccm.helper.parse(data, (key, val) => {
          if (val === "%$0%") return temp[0].shift();
          if (val === "%$1%") return temp[1].shift();
          if (typeof val === "string") {
            if (val.indexOf("%$2%") === 0 && val.split("%")[3] === "")
              return temp[2][val.split("%")[2]];
            else
              for (const key in temp[2])
                val = val.replace(
                  new RegExp(`%\\$2%${key}%`, "g"),
                  temp[2][key]
                );
          }
          return val;
        });
      },
      html: (html, values, settings = {}) => {
        html = ccm.helper.html2json(html);
        if (!ccm.helper.isObject(html)) return document.createTextNode(html);
        if (values) html = ccm.helper.format(html, values);
        if (html.tag === "svg")
          settings.namespace_uri = "http://www.w3.org/2000/svg";
        const element = settings.namespace_uri
          ? document.createElementNS(settings.namespace_uri, html.tag || "div")
          : document.createElement(html.tag || "div");
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
                    ccm.helper.html(child, undefined, settings)
                  )
                );
              }
              break;
            default:
              if (key.indexOf("on") === 0 && typeof value === "function")
                element.addEventListener(key.substring(2), value);
              else element.setAttribute(key, value);
          }
        }
        if (element.tagName.startsWith("CCM-") && !settings.no_evaluation)
          ccm.start(
            element.tagName === "CCM-APP"
              ? element.getAttribute("component")
              : element.tagName.substring(4).toLowerCase(),
            ccm.helper.generateConfig(element),
            element
          );
        return element;
      },
      html2json: (html) => {
        const json = { inner: [] };
        if (typeof html === "string") {
          const template = document.createElement("template");
          template.innerHTML = html;
          html = template.content;
        }
        if (ccm.helper.isJQuery(html)) {
          html = html.get();
          const fragment = document.createDocumentFragment();
          html.forEach((elem) => fragment.appendChild(elem));
          html = fragment;
        }
        if (html instanceof DocumentFragment) {
          if (!html.children.length) return html.textContent;
          [...html.childNodes].forEach((child) => {
            if (child.nodeValue) {
              if (!child.nodeValue || child.nodeType === Node.COMMENT_NODE)
                child.parentNode.removeChild(child);
            }
          });
          if (html.childNodes.length === 1) html = html.firstChild;
        }
        if (!ccm.helper.isElement(html)) return html;
        if (html.tagName) json.tag = html.tagName.toLowerCase();
        if (json.tag === "div") delete json.tag;
        if (html.attributes)
          [...html.attributes].forEach(
            (attr) =>
              (json[attr.name] =
                attr.value === "" && attr.name !== "value" ? true : attr.value)
          );
        [...html.childNodes].forEach((child) => {
          if (child.nodeType === Node.COMMENT_NODE)
            return child.parentNode.removeChild(child);
          if (child.nodeValue && !child.parentElement?.closest("pre"))
            child.nodeValue = child.nodeValue.replace(/\s+/g, " ");
          if (ccm.helper.isElement(child) || child.nodeValue)
            json.inner.push(
              ccm.helper.isElement(child)
                ? ccm.helper.html2json(child)
                : child.textContent
            );
        });
        if (!json.inner.length) delete json.inner;
        else if (json.inner.length === 1) json.inner = json.inner[0];
        return json;
      },
      isComponent: (value) => value?.Instance && value.ccm && true,
      isCore: (value) => value?.components && value.version && true,
      isDatastore: (value) => value?.get && value.local && value.source && true,
      isElement: (value) => {
        return value instanceof Element || value instanceof DocumentFragment;
      },
      isInstance: (value) => ccm.helper.isComponent(value?.component),
      isJQuery: (value) => window.jQuery && value instanceof jQuery,
      isNode: (value) => value instanceof Node,
      isObject: (value) => {
        return value && typeof value === "object" && !Array.isArray(value);
      },
      isSpecialObject: (value) => {
        return !!(
          value === window ||
          ccm.helper.isNode(value) ||
          ccm.helper.isCore(value) ||
          ccm.helper.isInstance(value) ||
          ccm.helper.isComponent(value) ||
          ccm.helper.isDatastore(value) ||
          ccm.helper.isJQuery(value)
        );
      },
      parse: (string, reviver) => {
        return JSON.parse(
          string
            .replace(/\\n/g, "\\n")
            .replace(/\\'/g, "\\'")
            .replace(/\\"/g, '\\"')
            .replace(/\\&/g, "\\&")
            .replace(/\\r/g, "\\r")
            .replace(/\\t/g, "\\t")
            .replace(/\\b/g, "\\b")
            .replace(/\\f/g, "\\f")
            .replace(/[\u0000-\u0019]+/g, ""),
          reviver
        );
      },
      regex: (index) => {
        switch (index) {
          case "filename":
            return /^ccm\.([a-z][a-z_0-9]*)(-(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))?(\.min)?(\.js)$/;
          case "key":
            return /^[a-zA-Z0-9_-]+$/;
          case "json":
            return /^(({(.|\n)*})|(\[(.|\n)*])|true|false|null)$/;
        }
      },
      stringify: (value, replacer, space) => {
        return JSON.stringify(
          value,
          (key, value) => {
            if (
              typeof value === "function" ||
              ccm.helper.isSpecialObject(value)
            )
              value = null;
            return replacer ? replacer(key, value) : value;
          },
          space
        );
      },
    },
  };
  if (!window.ccm) window.ccm = { callbacks: {}, files: {} };
  if (!window.ccm[ccm.version()]) window.ccm[ccm.version()] = ccm;
  if (
    !window.ccm.version ||
    ccm.helper.compareVersions(ccm.version(), window.ccm.version()) > 0
  )
    Object.assign(window.ccm, ccm);
})();
