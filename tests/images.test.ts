import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { indexImages } from "../src/lib/image-index.ts";
import { CYCLE } from "../src/lib/schedule.ts";

test("classifies map image 0 separately and sorts added references numerically", () => {
  const result = indexImages({
    "/images/7-3-10.jpeg": "ten",
    "/images/7-3-2.webp": "two",
    "/images/7-3-0.jpg": "map",
    "/images/7-3-1.PNG": "one",
    "/images/8-4-1.jpeg": "amazon",
    "/images/notes.txt": "invalid",
    "/images/9-1-0.jpg": "invalid",
    "/images/7-0-1.jpg": "invalid",
  });
  assert.deepEqual(
    result.filter((image) => image.map === 7).map((image) => image.index),
    [0, 1, 2, 10],
  );
  assert.equal(result[0]?.url, "map");
  assert.equal(result.length, 5);
});

test("all scheduled map/point combinations have a black-water reference", () => {
  const filenames = readdirSync(new URL("../images/", import.meta.url));
  const images = indexImages(
    Object.fromEntries(filenames.map((name) => [name, name])),
  );
  for (const code of CYCLE) {
    for (let i = 0; i < code.length; i++) {
      assert.ok(
        images.some(
          (image) =>
            image.map === i + 1 &&
            image.point === Number(code[i]) &&
            image.index > 0,
        ),
        `missing map ${i + 1}, point ${code[i]}`,
      );
    }
  }
  assert.ok(
    images.find((image) => image.filename === "7-3-0.jpg" && image.index === 0),
  );
});
