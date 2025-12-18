# ccmjs – Client-side Component Model

![version](https://img.shields.io/badge/version-28.0.0-blue)
![License](https://img.shields.io/github/license/ccmjs/framework)
![Wiki](https://img.shields.io/badge/docs-wiki-brightgreen)
![No Build](https://img.shields.io/badge/build-none-lightgrey)
![Runtime](https://img.shields.io/badge/runtime-browser-blue)
![Version Isolation](https://img.shields.io/badge/versioning-isolated-important)

The **Client-side Component Model (CCM)** defines a conceptual framework for developing modular and reusable web components.
The **ccmjs framework** provides a JavaScript reference implementation that enables dynamic component loading, configuration, and composition at runtime — without a build step.

---

## Key Characteristics

- Components embeddable via JavaScript or HTML
- Declarative configuration using JSON
- Runtime component discovery and instantiation
- Automatic dependency resolution at runtime
- No build step, bundler, or compilation required
- Versioned and isolated framework and component instances
- Safe coexistence of multiple framework and component versions on the same page

---

## Quick Example

```html
<!DOCTYPE html>
<meta charset="UTF-8">
<body>
<script src="https://ccmjs.github.io/framework/ccm.js"></script>
<script>
  const component = "https://ccmjs.github.io/quiz/ccm.quiz.js";
  const config = {
    feedback: true,
    questions: [
      {
        text: "Does this example work?",
        input: "radio",
        answers: [
          {text: "Yes", correct: true},
          {text: "No"}
        ]
      }
    ]
  };
  const area = document.body;
  ccm.start(component, config, area);
</script>
```

This embeds a quiz component with a specific configuration into the web page.

---

## Why CCM?

Unlike traditional component frameworks (e.g. Angular, React, Vue), ccmjs does not rely on a single global runtime, build tooling, or static dependency graphs.

Components are:
* loaded on demand,
* configured declaratively,
* instantiated dynamically,
* and isolated by version.

This enables highly dynamic applications, long-term compatibility, and safe integration of independently evolving components.

---

## Documentation

📘 **Full documentation is available in the Wiki:**  
👉 https://github.com/ccmjs/framework/wiki

---

### License

ccmjs is released under the MIT License.
