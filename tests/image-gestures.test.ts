import { test } from "node:test";
import assert from "node:assert/strict";
import { createImageGestureTracker, imageSwipeDirection } from "../src/lib/image-gestures.ts";

test("horizontal swipes follow the photo browsing direction", () => {
  assert.equal(imageSwipeDirection(-100, 12, 1, 7), 1);
  assert.equal(imageSwipeDirection(100, -12, 1, 7), -1);
});

test("taps, short drags and predominantly vertical gestures do not change photos", () => {
  for (const [dx, dy] of [[0, 0], [12, 2], [-31, 0], [50, 100], [-60, -60]]) {
    assert.equal(imageSwipeDirection(dx!, dy!, 1, 7), 0);
  }
});

test("short thumb swipes and a modest diagonal are accepted on narrow screens", () => {
  assert.equal(imageSwipeDirection(-32, 10, 1, 7), 1);
  assert.equal(imageSwipeDirection(36, -28, 1, 7), -1);
  assert.equal(imageSwipeDirection(-50, 40, 1, 7), 1);
});

test("zoomed panning and single-photo viewing cannot trigger swipe navigation", () => {
  assert.equal(imageSwipeDirection(-200, 0, 2, 7), 0);
  assert.equal(imageSwipeDirection(200, 0, 1.5, 7), 0);
  assert.equal(imageSwipeDirection(-200, 0, 1, 1), 0);
  assert.equal(imageSwipeDirection(-200, 0, 1, 0), 0);
});

const pointer = { id: 1, x: 100, y: 100, left: 0, top: 0, pan: false };

test("a touch tap survives capture release after pointerup, including slight finger jitter", () => {
  const tracker = createImageGestureTracker();
  tracker.start(pointer);
  tracker.move(1, 106, 104);
  assert.ok(tracker.end(1, 106, 104));
  tracker.cancel(1);
  assert.equal(tracker.consumeClick(1), false);
});

test("a swipe starting on an arrow switches once and does not swallow the next tap", () => {
  const tracker = createImageGestureTracker();
  tracker.start(pointer);
  const movement = tracker.end(1, 55, 110)!;
  assert.equal(imageSwipeDirection(movement.dx, movement.dy, 1, 8), 1);
  tracker.reset(); // The image changed before the browser delivered its click.
  tracker.cancel(1);
  assert.equal(tracker.consumeClick(1), true);
  tracker.start(pointer);
  tracker.end(1, 100, 100);
  assert.equal(tracker.consumeClick(1), false);
});

test("canceled and multi-touch gestures cannot finish a swipe; keyboard activation still works", () => {
  const tracker = createImageGestureTracker();
  tracker.start(pointer);
  assert.equal(tracker.end(2, 20, 100), null);
  tracker.cancel(1);
  assert.equal(tracker.end(1, 20, 100), null);
  assert.equal(tracker.consumeClick(0), false);
  tracker.start(pointer);
  tracker.start(null); // A second finger cancels the first gesture.
  assert.equal(tracker.end(1, 20, 100), null);
  assert.equal(tracker.consumeClick(1), true);
});
