// Single import point for the cross-browser extension API. `webextension-polyfill`
// exposes a promise-based `browser` namespace that works identically on Chrome and
// Firefox. Import `browser` from here instead of touching the global `chrome`/`browser`
// directly, so portability stays in one place.
import browser from 'webextension-polyfill';

export { browser };
