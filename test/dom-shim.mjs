/* Minimaler Ersatz fuer die Browser-Globals, die das Card-Bundle beim Import
 * anfasst (customElements.define, window.customCards). Bewusst ohne jsdom -
 * die Tests pruefen reine Logik, kein Rendering im echten DOM. */
class HTMLElementShim {}
const registry = new Map();
globalThis.HTMLElement = HTMLElementShim;
globalThis.customElements = {
  define: (name, cls) => registry.set(name, cls),
  get: (name) => registry.get(name),
  whenDefined: () => Promise.resolve(),
};
globalThis.document = {
  createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} }),
  head: { appendChild() {} },
  createTextNode: () => ({}),
  createComment: () => ({}),
  createTreeWalker: () => ({}),
  adoptedStyleSheets: [],
};
globalThis.window = globalThis;
