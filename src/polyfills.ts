// Runtime shims for dependencies that expect Node-like globals in the browser.
(() => {
  const w = window as unknown as { global?: unknown; process?: { env: Record<string, string> } };
  if (!w.global) {
    w.global = window;
  }
  if (!w.process) {
    w.process = { env: {} };
  }
})();
