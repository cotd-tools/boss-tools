import { test } from "node:test";
import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { copyShareImage } from "../src/lib/share-image.ts";

function replaceGlobal(context: TestContext, name: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  context.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else Reflect.deleteProperty(globalThis, name);
  });
}

test("image copying starts during the click and waits for the rendered PNG", async (context) => {
  let resolveImage!: (image: Blob) => void;
  const rendering = new Promise<Blob>((resolve) => { resolveImage = resolve; });
  let started = false;
  let copied: Blob | undefined;
  class ClipboardItemMock {
    data: Record<string, Blob | Promise<Blob>>;
    constructor(data: Record<string, Blob | Promise<Blob>>) { this.data = data; }
  }
  replaceGlobal(context, "ClipboardItem", ClipboardItemMock);
  replaceGlobal(context, "navigator", {
    clipboard: {
      write: async (items: ClipboardItemMock[]) => {
        started = true;
        assert.equal(items.length, 1, "All maps must paste as one image");
        assert.deepEqual(Object.keys(items[0]!.data), ["image/png"]);
        copied = await items[0]!.data["image/png"];
      },
    },
  });
  const copying = copyShareImage(rendering);
  assert.equal(started, true, "Do not lose user activation while loading photos");
  assert.equal(copied, undefined);
  const png = new Blob(["rendered PNG"], { type: "image/png" });
  resolveImage(png);
  await copying;
  assert.equal(copied, png);
});

test("an unsupported image clipboard returns a failure for the preview fallback", async (context) => {
  const png = new Blob(["PNG"], { type: "image/png" });
  replaceGlobal(context, "ClipboardItem", undefined);
  await assert.rejects(copyShareImage(png), /Image clipboard unavailable/);
});

test("a denied clipboard write returns a failure for the preview fallback", async (context) => {
  const png = new Blob(["PNG"], { type: "image/png" });
  replaceGlobal(context, "ClipboardItem", class { constructor(_data: unknown) {} });
  replaceGlobal(context, "navigator", {
    clipboard: { write: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
  });
  await assert.rejects(copyShareImage(png), { name: "NotAllowedError" });
});
