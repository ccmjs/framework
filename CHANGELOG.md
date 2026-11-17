# Changelog

Notable changes to the ccmjs framework are documented here, newest first.

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
