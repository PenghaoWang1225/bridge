export const REVIEW_MARKS_KEY = "bridge.scanian.review-marks.v1";

export function readReviewMarks(storage) {
  const raw = storage.getItem(REVIEW_MARKS_KEY);
  if (raw === null) return new Map();
  const saved = JSON.parse(raw);
  if (!saved || saved.version !== 1 || !Array.isArray(saved.entries) ||
      saved.entries.some((mark) => !mark || typeof mark.id !== "string" ||
        !mark.id || typeof mark.fullAuction !== "string" ||
        typeof mark.seenShared !== "boolean"))
    throw Error("The saved marks have an invalid format.");
  return new Map(saved.entries.map((mark) => [mark.id, mark]));
}

export function saveReviewMarks(storage, marks) {
  storage.setItem(REVIEW_MARKS_KEY, JSON.stringify({
    version: 1,
    entries: [...marks.values()],
  }));
}

export function reconcileReviewMarks(marks, nodes) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const next = new Map(marks);
  for (const [id, mark] of marks) {
    const n = byId.get(id);
    if (!n) continue;
    if (n.needsDiscussion && !mark.seenShared)
      next.set(id, { ...mark, seenShared: true });
    else if (!n.needsDiscussion && mark.seenShared)
      next.delete(id);
  }
  return next;
}
