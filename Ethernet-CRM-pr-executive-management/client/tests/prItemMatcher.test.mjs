import assert from "node:assert/strict";
import test from "node:test";
import { matchAgainstPrItems } from "../src/lib/prItemMatcher.js";

test("matchAgainstPrItems reads item_description and does not match empty descriptions", () => {
  const prItems = [
    { material_description: "First PR item" },
    { material_description: "Second PR item" },
  ];

  const first = matchAgainstPrItems({ item_description: "Second PR item" }, prItems);
  assert.equal(first.matchStatus, "matched");
  assert.equal(first.matchType, "exact");
  assert.equal(first.matchedPrItem?.material_description, "Second PR item");

  const empty = matchAgainstPrItems({ item_description: "" }, prItems);
  assert.equal(empty.matchStatus, "unmatched");
  assert.equal(empty.matchedPrItem, null);
  assert.equal(empty.matchType, null);
});
