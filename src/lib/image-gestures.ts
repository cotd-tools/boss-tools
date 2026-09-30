/** Horizontal intent only: taps, page scrolling and zoomed panning never change photos. */
export function imageSwipeDirection(
  dx: number,
  dy: number,
  zoom: number,
  imageCount: number,
): -1 | 0 | 1 {
  if (zoom !== 1 || imageCount < 2 || Math.abs(dx) < 32 || Math.abs(dx) < Math.abs(dy) * 1.2) return 0;
  return dx < 0 ? 1 : -1;
}

type ImagePointerGesture = {
  id: number;
  x: number;
  y: number;
  left: number;
  top: number;
  pan: boolean;
};

/** Track one pointer, keeping the following click separate from capture release. */
export function createImageGestureTracker() {
  let active: ImagePointerGesture | null = null;
  let dragged = false;

  function move(id: number, x: number, y: number) {
    if (!active || active.id !== id) return null;
    const dx = x - active.x;
    const dy = y - active.y;
    if (Math.hypot(dx, dy) > 12) dragged = true;
    return { gesture: active, dx, dy };
  }

  return {
    start(gesture: ImagePointerGesture | null) {
      active = gesture;
      dragged = gesture === null;
    },
    move,
    end(id: number, x: number, y: number) {
      const movement = move(id, x, y);
      if (movement) active = null;
      return movement;
    },
    cancel(id: number) {
      // Touch releases capture after pointerup and before click on some browsers.
      if (!active || active.id !== id) return;
      active = null;
      dragged = true;
    },
    reset() {
      active = null;
    },
    consumeClick(detail: number) {
      const prevent = dragged && detail !== 0;
      dragged = false;
      return prevent;
    },
  };
}
