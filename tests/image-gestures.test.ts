import { test } from "node:test";
import assert from "node:assert/strict";
import { imageSwipeDirection } from "../src/lib/image-gestures.ts";

test("horizontal swipes follow the photo browsing direction", () => {
  assert.equal(imageSwipeDirection(-100, 12, 1, 7), 1);
  assert.equal(imageSwipeDirection(100, -12, 1, 7), -1);
});

test("taps, short drags and predominantly vertical gestures do not change photos", () => {
  for (const [dx, dy] of [[0, 0], [12, 2], [-47, 0], [50, 100], [-60, -60]]) {
    assert.equal(imageSwipeDirection(dx!, dy!, 1, 7), 0);
  }
});

test("zoomed panning and single-photo viewing cannot trigger swipe navigation", () => {
  assert.equal(imageSwipeDirection(-200, 0, 2, 7), 0);
  assert.equal(imageSwipeDirection(200, 0, 1.5, 7), 0);
  assert.equal(imageSwipeDirection(-200, 0, 1, 1), 0);
  assert.equal(imageSwipeDirection(-200, 0, 1, 0), 0);
});
