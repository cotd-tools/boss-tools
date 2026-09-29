/** Horizontal intent only: taps, page scrolling and zoomed panning never change photos. */
export function imageSwipeDirection(
  dx: number,
  dy: number,
  zoom: number,
  imageCount: number,
): -1 | 0 | 1 {
  if (zoom !== 1 || imageCount < 2 || Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}
