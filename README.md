# ccmjs Framework

![version](https://img.shields.io/badge/version-28.0.0-blue)
![License](https://img.shields.io/github/license/ccmjs/framework)
![Wiki](https://img.shields.io/badge/docs-wiki-brightgreen)
![No Build](https://img.shields.io/badge/build-none-lightgrey)
![Runtime](https://img.shields.io/badge/runtime-browser-blue)
![Version Isolation](https://img.shields.io/badge/versioning-isolated-important)

**ccmjs** is a lightweight JavaScript framework that implements the **Client-side Component Model (CCM)** — an architecture for building modular, reusable, and dynamically composed web applications.

Unlike typical frontend frameworks, **ccmjs operates entirely at runtime** and does not require build tools, bundlers, or compilation.

Components can be loaded, configured, and composed dynamically at runtime — even across different framework versions.

> No installation. No build. Just include and start.

# 🚀 Quick Start

Include ccmjs:

```html
<script src="https://ccmjs.github.io/framework/ccm.js"></script>
```

Start a component:

```js
ccm.start(component, config, document.body);
```

# What is CCM?

The **Client-side Component Model (CCM)** is an architectural approach for building web applications from independent, reusable components that are composed at runtime.

Each component

- defines its own configuration schema
- declares dependencies declaratively
- can be loaded dynamically
- runs in an isolated runtime environment

This allows applications to be composed from independently evolving components while maintaining compatibility across versions.

**ccmjs** provides the reference implementation of this model in JavaScript.

# Key Features

- Runtime component loading
- Declarative configuration (JSON-based)
- Automatic dependency resolution
- Version isolation (framework + components)
- Multiple versions can coexist
- No build step required
- Fully client-side execution
- Instance-level DOM isolation (Shadow DOM)

# Quick Example

```html
<!DOCTYPE html>
<meta charset="UTF-8">
<body>

<script src="https://ccmjs.github.io/framework/ccm.js"></script>

<script>
const component = "https://ccmjs.github.io/quiz/ccm.quiz.mjs";

const config = {
  feedback: true,
  questions: [
    {
      text: "Does this example work?",
      input: "radio",
      answers: [
        { text: "Yes", correct: true },
        { text: "No" }
      ]
    }
  ]
};

ccm.start(component, config, document.body);
</script>
```

This loads the quiz component dynamically, instantiates it, and renders it into the page.

# Core API

| Function | Purpose |
|--------|--------|
| `ccm.load()` | Load resources dynamically |
| `ccm.component()` | Register or load components |
| `ccm.instance()` | Create component instances |
| `ccm.start()` | Create and start component instances |
| `ccm.store()` | Create datastore accessors |
| `ccm.get()` | One-time data retrieval |

# First Steps

1. Include the framework in your page

```html
<script src="https://ccmjs.github.io/framework/ccm.js"></script>
```

2. Start a component

```js
ccm.start(componentURL, config, element);
```

That's it — the framework performs the full lifecycle automatically:

- load the component
- resolve dependencies
- create an instance
- render it.

# Why CCM?

Most frontend frameworks assume

- a single global runtime
- a static dependency graph
- a build pipeline
- no shared global runtime state

ccmjs instead focuses on **runtime composition**.

Components can be

- loaded on demand
- configured declaratively
- instantiated dynamically
- isolated by version

This enables

- long-term compatibility
- integration of independently developed components
- dynamic applications that evolve over time

# Documentation

Full documentation is available in the [ccmjs Wiki](https://github.com/ccmjs/framework/wiki).

# License

ccmjs is released under the **MIT License**.
