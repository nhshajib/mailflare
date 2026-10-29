import assert from "node:assert/strict";
import test from "node:test";
import { createElement, StrictMode, act, useLayoutEffect } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { JSDOM } from "jsdom";
import { useResettableState } from "../src/hooks/use-resettable-state.ts";
import { useHydrated } from "../src/hooks/use-hydrated.ts";

function browser() {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://local.test" });
  const saved = { window: globalThis.window, document: globalThis.document, act: globalThis.IS_REACT_ACT_ENVIRONMENT };
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return { element: dom.window.document.getElementById("root"), cleanup() {
    globalThis.window = saved.window; globalThis.document = saved.document; globalThis.IS_REACT_ACT_ENVIRONMENT = saved.act; dom.window.close();
  } };
}

test("draft state resets before a different mailbox renders, preserves edits and keeps a stable functional setter", async () => {
  const dom = browser(); let setValue;
  const observed = [];
  function Form({ mailbox, saved }) {
    const [value, update] = useResettableState(`${mailbox}:${saved}`, saved);
    useLayoutEffect(() => { setValue = update; observed.push([mailbox, value]); }, [update, mailbox, value]);
    return createElement("span", null, value);
  }
  const root = createRoot(dom.element);
  try {
    await act(async () => root.render(createElement(StrictMode, null, createElement(Form, { mailbox: "alice", saved: "A" }))));
    await act(async () => setValue(value => `${value} edited`));
    assert.equal(dom.element.textContent, "A edited");
    await act(async () => root.render(createElement(StrictMode, null, createElement(Form, { mailbox: "alice", saved: "A" }))));
    assert.equal(dom.element.textContent, "A edited");
    await act(async () => setValue("alice draft"));
    await act(async () => root.render(createElement(StrictMode, null, createElement(Form, { mailbox: "bob", saved: "B" }))));
    assert.equal(dom.element.textContent, "B");
    assert.ok(observed.filter(([key]) => key === "bob").every(([, value]) => value === "B"));
    const stableSetter = setValue;
    await act(async () => root.render(createElement(StrictMode, null, createElement(Form, { mailbox: "bob", saved: "B" }))));
    assert.equal(setValue, stableSetter);
    await act(async () => setValue(value => value + "!"));
    assert.equal(dom.element.textContent, "B!");
  } finally { await act(async () => root.unmount()); dom.cleanup(); }
});

test("hydrated browser preferences agree with server markup before reading browser-only values", async () => {
  function Preference() { return createElement("span", null, useHydrated() ? window.localStorage.getItem("theme") : "server-default"); }
  const markup = renderToString(createElement(Preference));
  assert.match(markup, /server-default/);
  const dom = browser(); const errors = [];
  window.localStorage.setItem("theme", "dark"); dom.element.innerHTML = markup;
  let root;
  try {
    await act(async () => { root = hydrateRoot(dom.element, createElement(Preference), { onRecoverableError: error => errors.push(error) }); });
    assert.equal(dom.element.textContent, "dark"); assert.deepEqual(errors, []);
  } finally { await act(async () => root?.unmount()); dom.cleanup(); }
});
