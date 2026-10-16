import assert from "node:assert/strict";
import test from "node:test";
import { lockBodyScroll } from "./body-scroll-lock";

class Style {
  values = new Map<string, [string, string]>();
  getPropertyValue(key: string) { return this.values.get(key)?.[0] ?? ""; }
  getPropertyPriority(key: string) { return this.values.get(key)?.[1] ?? ""; }
  setProperty(key: string, value: string, priority = "") { this.values.set(key, [value, priority]); }
  removeProperty(key: string) { this.values.delete(key); }
}

function setup(scrollbarWidth = 16) {
  const body = { style: new Style() };
  const html = { style: new Style(), clientWidth: 1000 - scrollbarWidth };
  const scrolls: unknown[] = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: { body, documentElement: html } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    scrollX: 8, scrollY: 420, innerWidth: 1000,
    getComputedStyle: () => ({ paddingRight: "12px" }),
    scrollTo: (position: unknown) => scrolls.push(position),
  } });
  return { body, html, scrolls };
}

test("stacked modals restore original styles and position only after the last closes", () => {
  const { body, html, scrolls } = setup();
  body.style.setProperty("overflow", "auto", "important");
  body.style.setProperty("padding-right", "12px");
  html.style.setProperty("overflow", "scroll");
  const closeParent = lockBodyScroll();
  const closeChild = lockBodyScroll();
  assert.equal(body.style.getPropertyValue("position"), "fixed");
  assert.equal(body.style.getPropertyValue("top"), "-420px");
  assert.equal(body.style.getPropertyValue("padding-right"), "28px");
  closeParent();
  closeParent(); // Cleanup is idempotent, including out-of-order unmounts.
  assert.equal(html.style.getPropertyValue("overflow"), "hidden");
  assert.equal(scrolls.length, 0);
  closeChild();
  assert.equal(body.style.getPropertyValue("position"), "");
  assert.equal(body.style.getPropertyValue("overflow"), "auto");
  assert.equal(body.style.getPropertyPriority("overflow"), "important");
  assert.equal(body.style.getPropertyValue("padding-right"), "12px");
  assert.equal(html.style.getPropertyValue("overflow"), "scroll");
  assert.deepEqual(scrolls, [{ left: 8, top: 420, behavior: "instant" }]);
});

test("repeated mount/cleanup cycles release the lock without adding mobile padding", () => {
  const { body, html, scrolls } = setup(0);
  for (let i = 0; i < 3; i++) {
    const close = lockBodyScroll();
    assert.equal(body.style.getPropertyValue("overflow"), "hidden");
    assert.equal(body.style.getPropertyValue("padding-right"), "");
    close();
    assert.equal(body.style.getPropertyValue("overflow"), "");
    assert.equal(html.style.getPropertyValue("overflow"), "");
  }
  assert.equal(scrolls.length, 3);
});
