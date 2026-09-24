import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
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
const sourceImage = () => sharp({ create: { width: 128, height: 64, channels: 3, background: "#164d36" } })
  .png({ compressionLevel: 0 }).toBuffer();

test("image processing preserves originals and dimensions, replaces root copies and caches unchanged outputs", async () => {
  await fixture(async (directory) => {
    const original = await sourceImage();
    await writeFile(join(directory, "original", "7-1-0.png"), original);
    await writeFile(join(directory, "7-1-0.png"), original);
    const report = await optimizeImages(directory, quiet);
    assert.deepEqual(await readFile(join(directory, "original", "7-1-0.png")), original);
    assert.deepEqual((await readdir(directory)).sort(), ["7-1-0.avif", "optimization-report.json", "original"]);
    const output = await readFile(join(directory, "7-1-0.avif"));
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.width, 128);
    assert.equal(metadata.height, 64);
    assert.ok(output.length < original.length);
    assert.equal(metadata.exif, undefined);
    assert.deepEqual(await optimizeImages(directory, quiet), report);
    assert.deepEqual(await readFile(join(directory, "7-1-0.avif")), output);
    await optimizeImages(directory, { ...quiet, format: "webp" });
    assert.deepEqual((await readdir(directory)).sort(), ["7-1-0.webp", "optimization-report.json", "original"]);
    assert.deepEqual(await readFile(join(directory, "original", "7-1-0.png")), original);
  });
});

test("image processing refuses conflicting website files and duplicate logical originals before replacing anything", async () => {
  await fixture(async (directory) => {
    const original = await sourceImage();
    await writeFile(join(directory, "original", "7-1-0.png"), original);
    await writeFile(join(directory, "7-1-0.png"), "user modification");
    await assert.rejects(optimizeImages(directory, quiet), /Unrecognized file/);
    assert.equal(await readFile(join(directory, "7-1-0.png"), "utf8"), "user modification");
    await writeFile(join(directory, "7-1-0.png"), original);
    await writeFile(join(directory, "original", "7-1-0.PNG"), original);
    // Windows filenames are case-insensitive, so use another supported extension.
    await writeFile(join(directory, "original", "7-1-0.webp"), original);
    await assert.rejects(optimizeImages(directory, quiet), /Duplicate original/);
    assert.deepEqual(await readFile(join(directory, "7-1-0.png")), original);
  });
});

test("orientation is normalized without cropping, and a failed batch leaves website copies intact", async () => {
  await fixture(async (directory) => {
    const original = await sharp(await sourceImage()).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    await writeFile(join(directory, "original", "7-1-1.jpg"), original);
    const report = await optimizeImages(directory, quiet);
    const image = report.images[0];
    const { info } = await sharp(await readFile(join(directory, image.output))).autoOrient().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [64, 128]);
    assert.deepEqual(await readFile(join(directory, "original", "7-1-1.jpg")), original);
    await writeFile(join(directory, "original", "7-1-2.png"), "invalid image");
    await writeFile(join(directory, "7-1-2.png"), "invalid image");
    const before = await readFile(join(directory, image.output));
    await assert.rejects(optimizeImages(directory, quiet));
    assert.deepEqual(await readFile(join(directory, image.output)), before);
    assert.equal(await readFile(join(directory, "7-1-2.png"), "utf8"), "invalid image");
  });
});
