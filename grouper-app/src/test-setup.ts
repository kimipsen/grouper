// Node 25+ ships a built-in Web Storage global that is `undefined` unless
// `--localstorage-file` is set, and it shadows jsdom's implementation.
// Re-point the storage globals at jsdom so specs behave like a browser.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;

if (jsdomWindow) {
  for (const key of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(globalThis, key, {
      value: jsdomWindow[key],
      configurable: true,
      writable: true,
    });
  }
}
