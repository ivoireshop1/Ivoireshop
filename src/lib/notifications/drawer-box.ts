export const NOTIFICATION_DRAWER_WIDTH = 320;
export const NOTIFICATION_DRAWER_MARGIN = 12;

export function notificationDrawerBox(
  anchor: { left: number; right: number; bottom: number },
  viewportWidth: number,
  viewportHeight: number,
) {
  const width = Math.min(NOTIFICATION_DRAWER_WIDTH, Math.max(220, viewportWidth - NOTIFICATION_DRAWER_MARGIN * 2));
  let left = anchor.right - width;
  if (left < NOTIFICATION_DRAWER_MARGIN) left = NOTIFICATION_DRAWER_MARGIN;
  if (left + width > viewportWidth - NOTIFICATION_DRAWER_MARGIN) {
    left = Math.max(NOTIFICATION_DRAWER_MARGIN, viewportWidth - NOTIFICATION_DRAWER_MARGIN - width);
  }
  const maxHeight = Math.min(viewportHeight * 0.7, 32 * 16);
  let top = anchor.bottom + 8;
  if (top + 120 > viewportHeight) top = Math.max(NOTIFICATION_DRAWER_MARGIN, viewportHeight - 160);
  return { left, top, width, maxHeight };
}
