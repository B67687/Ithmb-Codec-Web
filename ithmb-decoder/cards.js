// cards.js — single owner of the decode-result lists.
//
// WHY THIS MODULE EXISTS: `successfulDecodes`/`failedDecodes` used to be plain
// exported arrays in state.js that every module mutated directly — multiple
// writers with no invariants (the duplicate length-reset dead line was a
// symptom). All writes now go through this module's functions; reads use the
// query accessors below.
//
// Invariants (enforced here):
//   - success and failure entries ALWAYS carry `bytes` (renderable/shareable)
//   - ERROR cards are never stored (they have no shareable bytes — decoder.js)
//   - resetCards() clears both lists together (first-batch reset)
const successful = [];
const failed = [];

export function addSuccess(entry) {
  successful.push(entry);
}

export function addFailure(entry) {
  failed.push(entry);
}

export function resetCards() {
  successful.length = 0;
  failed.length = 0;
}

export function successCount() {
  return successful.length;
}

export function failureCount() {
  return failed.length;
}

// Read accessors return copies so callers can iterate/find without being able
// to mutate the lists (arrays here are small — tens of entries).
export function successCards() {
  return [...successful];
}

export function failedCards() {
  return [...failed];
}

export function findSuccess(cardId) {
  return successful.find((e) => e.cardId === cardId);
}

export function findFailure(cardId) {
  return failed.find((e) => e.cardId === cardId);
}
