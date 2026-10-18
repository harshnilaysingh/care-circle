import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleAccountAge } from "../src/lib/age-policy.mjs";

test("eligible ages are integer account ages from 13 through 120", () => {
  assert.equal(isEligibleAccountAge(13), true);
  assert.equal(isEligibleAccountAge("25"), true);
  assert.equal(isEligibleAccountAge(120), true);
});

test("missing, underage, fractional, and out-of-range ages are rejected", () => {
  for (const value of [undefined, null, "", 12, "12", 13.5, 121, "not an age"]) {
    assert.equal(isEligibleAccountAge(value), false, `reject ${String(value)}`);
  }
});

