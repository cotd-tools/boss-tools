import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { optimizeImages } from "../scripts/optimize-images.mjs";

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), "cotd-image-test-"));
  try {
    await mkdir(join(directory, "original"));
    await run(directory);
  } finally {
    // Only the directory created by this test, never the real images directory.
    await rm(directory, { recursive: true });
  }
}
const quiet = { log: () => {} };
const sourceImage = () =>
  sharp({
    create: { width: 128, height: 64, channels: 3, background: "#164d36" },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();

test("image processing preserves originals and dimensions, replaces root copies and caches unchanged outputs", async () => {
  await fixture(async (directory) => {
    const original = await sourceImage();
    await writeFile(join(directory, "original", "thailand.png"), original);
    await writeFile(join(directory, "thailand.png"), original);
    const report = await optimizeImages(directory, quiet);
    assert.deepEqual(
      await readFile(join(directory, "original", "thailand.png")),
      original,
    );
    assert.deepEqual((await readdir(directory)).sort(), [
      "optimization-report.json",
      "original",
      "thailand.avif",
    ]);
    const output = await readFile(join(directory, "thailand.avif"));
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, 128);
    assert.equal(metadata.height, 64);
    assert.ok(output.length < original.length);
    assert.equal(metadata.exif, undefined);
    assert.deepEqual(await optimizeImages(directory, quiet), report);
    assert.deepEqual(await readFile(join(directory, "thailand.avif")), output);
    await optimizeImages(directory, { ...quiet, format: "webp" });
    assert.deepEqual((await readdir(directory)).sort(), [
      "optimization-report.json",
      "original",
      "thailand.webp",
    ]);
    assert.deepEqual(
      await readFile(join(directory, "original", "thailand.png")),
      original,
    );
  });
});

test("named base maps use the shared workflow and retired zero-suffix originals are ignored", async () => {
  await fixture(async (directory) => {
    const original = await sourceImage();
    await writeFile(join(directory, "original", "paradise.png"), original);
    await writeFile(join(directory, "original", "1-1-0.png"), original);
    const report = await optimizeImages(directory, quiet);
    assert.equal(report.images.length, 1);
    assert.equal(report.images[0].key, "paradise");
    assert.equal(report.images[0].quality, 70);
    assert.deepEqual(
      await readFile(join(directory, "original", "1-1-0.png")),
      original,
    );
    assert.ok(
      !(await readdir(directory)).some((name) => name.startsWith("1-1-0")),
    );
  });
});

test("image processing refuses conflicting website files and duplicate logical originals before replacing anything", async () => {
  await fixture(async (directory) => {
    const original = await sourceImage();
    await writeFile(join(directory, "original", "thailand.png"), original);
    await writeFile(join(directory, "thailand.png"), "user modification");
    await assert.rejects(optimizeImages(directory, quiet), /Unrecognized file/);
    assert.equal(
      await readFile(join(directory, "thailand.png"), "utf8"),
      "user modification",
    );
    await writeFile(join(directory, "thailand.png"), original);
    await writeFile(join(directory, "original", "thailand.PNG"), original);
    // Windows filenames are case-insensitive, so use another supported extension.
    await writeFile(join(directory, "original", "thailand.webp"), original);
    await assert.rejects(
      optimizeImages(directory, quiet),
      /Duplicate original/,
    );
    assert.deepEqual(await readFile(join(directory, "thailand.png")), original);
  });
});

test("orientation is normalized without cropping, and a failed batch leaves website copies intact", async () => {
  await fixture(async (directory) => {
    const original = await sharp(await sourceImage())
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    await writeFile(join(directory, "original", "7-1-1.jpg"), original);
    const report = await optimizeImages(directory, quiet);
    const image = report.images[0];
    const { info } = await sharp(await readFile(join(directory, image.output)))
      .autoOrient()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [64, 128]);
    assert.deepEqual(
      await readFile(join(directory, "original", "7-1-1.jpg")),
      original,
    );
    await writeFile(join(directory, "original", "7-1-2.png"), "invalid image");
    await writeFile(join(directory, "7-1-2.png"), "invalid image");
    const before = await readFile(join(directory, image.output));
    await assert.rejects(optimizeImages(directory, quiet));
    assert.deepEqual(await readFile(join(directory, image.output)), before);
    assert.equal(
      await readFile(join(directory, "7-1-2.png"), "utf8"),
      "invalid image",
    );
  });
});
