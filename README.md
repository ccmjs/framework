# ccmjs Framework

![version](https://img.shields.io/badge/version-28.0.0-blue)
![License](https://img.shields.io/github/license/ccmjs/framework)
![Docs](https://img.shields.io/badge/docs-wiki-brightgreen)
![Build](https://img.shields.io/badge/build-none-lightgrey)
![Runtime](https://img.shields.io/badge/runtime-browser-blue)
![Declarative](https://img.shields.io/badge/config-declarative-blueviolet)
![Versioning](https://img.shields.io/badge/versioning-isolated-important)

> **Buildless. Composable. Runtime.**  
> No installation. No build. Just include and start.

**ccmjs** is a lightweight JavaScript framework that implements the **Client-side Component Model (CCM)** — an architecture for building modular, reusable, and dynamically composed web applications.

Components are loaded, configured, and instantiated dynamically at runtime — even across different framework and component versions.

## 🚀 Quick Start

Include ccmjs:

```html
<script src="https://ccmjs.github.io/framework/ccm.js"></script>
```

Start a component:

```js
ccm.start(component, config, area);
```

## 💡 Quick Example

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

## ✨ Beyond the Basics

ccmjs also provides:

- 🔍 Full code transparency (inspect original source at runtime)
- 🗄️ Flexible data management (in-memory, local, or remote)
- 🔐 Security by design (isolation, SRI, encapsulation)
- 🧩 Dynamic composition of complex applications
- 🌐 Integration of independently developed components

On top of that, ccmjs can be used to build:

- 🧱 Digital Makerspaces (for non-developers)
- 💾 Data-sovereign applications
- 🖥️ Modular web-based environments (e.g. web desktops)

## 📚 Documentation

Full documentation is available in the [ccmjs Wiki](https://github.com/ccmjs/framework/wiki).

## 📄 License

ccmjs is released under the **MIT License**.
