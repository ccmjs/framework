# Changelog

Notable changes to the ccmjs framework are documented here, newest first.

## 29.1.0

### Added

- Each instance host exposes its component name in the `data-ccm-component`
  attribute. For example, `data-ccm-component="teambuild"` identifies a
  Teambuild host in browser DevTools, including when its shadow root is closed
  or Shadow DOM is disabled with `root: false`.

## 29.0.0

### Breaking changes

- `ccm.version` is a function again. Update code written for 28.x to call
  `ccm.version()` wherever it needs the version string. When working with
  multiple framework versions, use
  `typeof ccm.version === "function" ? ccm.version() : ccm.version`.
- Component registration, instantiation and startup now expect a callable
  version accessor on framework objects. Framework objects from 28.0.0 and
  28.1.0 expose a string and are incompatible with those calls.

### Fixed

- Set the loading marker in `window.ccm.files` before a legacy component script
  first executes, so it can detect that the framework is loading it.
- Initialize `window.ccm.callbacks` when delegating to framework versions
  before 28 that rely on the shared callback registry.

## 28.1.0

### Added

- Remote datastores expose their observation state through
  `getConnectionState()`: `connecting`, `connected`, or `disconnected`.
- The optional `onconnectionchange` callback reports observation state changes.
- `connected` indicates that the server has acknowledged the subscription,
  rather than merely that the WebSocket is open.
- Observation state is tracked separately for each datastore, including
  datastores sharing a WebSocket connection.

### Fixed

- Calling `connect()` without WebSocket support no longer throws.
- Synchronous and asynchronous errors in `onconnectionchange` callbacks
  are caught and logged without interrupting observation.
