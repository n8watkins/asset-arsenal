/**
 * Drag payload contract for Asset Arsenal gallery.
 * Sources can be dragged onto the upload zone to trigger a re-run.
 */

export const SOURCE_DRAG_MIME = "application/x-asset-arsenal-source";

/**
 * Mark a drag event as carrying an Asset Arsenal source ID.
 * Call this in onDragStart on a source thumbnail.
 */
export function setSourceDrag(e: React.DragEvent, sourceId: string): void {
  e.dataTransfer.setData(SOURCE_DRAG_MIME, sourceId);
  e.dataTransfer.effectAllowed = "copy";
}

/**
 * Extract the source ID from a drag event that was initiated by setSourceDrag.
 * Returns null if the event does not carry our payload.
 */
export function getDraggedSourceId(
  e: React.DragEvent | DragEvent
): string | null {
  const id = e.dataTransfer?.getData(SOURCE_DRAG_MIME);
  return id && id.length > 0 ? id : null;
}
