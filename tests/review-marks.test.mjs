import test from "node:test";
import assert from "node:assert/strict";
import {
  REVIEW_MARKS_KEY,
  readReviewMarks,
  saveReviewMarks,
  reconcileReviewMarks,
} from "../web/review-marks.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}
const mark = { id: "bid-a", fullAuction: "1♣ – (Pass) – 1♦", seenShared: false };

test("Quick marks survive a reload and do not change earlier saved data", () => {
  const saved = storage();
  saved.setItem("bridge.scanian.unresolved.v1", "earlier data");
  assert.equal(readReviewMarks(saved).size, 0);
  saveReviewMarks(saved, new Map([[mark.id, mark]]));
  assert.deepEqual(readReviewMarks(saved).get(mark.id), mark);
  assert.equal(saved.getItem("bridge.scanian.unresolved.v1"), "earlier data");
  const next = readReviewMarks(saved);
  next.delete(mark.id);
  saveReviewMarks(saved, next);
  assert.equal(readReviewMarks(saved).size, 0);
});

test("An unshared mark stays while the published discussion flag is off", () => {
  const marks = new Map([[mark.id, mark]]);
  const nodes = [{ id: mark.id, needsDiscussion: false }];
  assert.deepEqual(reconcileReviewMarks(marks, nodes), marks);
  assert.equal(marks.get(mark.id).seenShared, false);
});

test("A mark follows the shared flag and clears after CMS resolution", () => {
  const marks = new Map([[mark.id, mark]]);
  const shared = reconcileReviewMarks(marks, [{ id: mark.id, needsDiscussion: true }]);
  assert.equal(shared.get(mark.id).seenShared, true);
  assert.equal(marks.get(mark.id).seenShared, false);
  const resolved = reconcileReviewMarks(shared, [{ id: mark.id, needsDiscussion: false }]);
  assert.equal(resolved.size, 0);
});

test("A missing sequence does not erase its browser mark", () => {
  const marks = new Map([[mark.id, { ...mark, seenShared: true }]]);
  assert.deepEqual(reconcileReviewMarks(marks, []), marks);
});

test("Invalid saved marks are reported without replacing saved data", () => {
  const saved = storage();
  for (const raw of ["broken JSON", "null", '{"version":1,"entries":[{"id":"a"}]}']) {
    saved.setItem(REVIEW_MARKS_KEY, raw);
    assert.throws(() => readReviewMarks(saved));
    assert.equal(saved.getItem(REVIEW_MARKS_KEY), raw);
  }
});
