import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFamilyJoin } from "../src/lib/family-join-policy.mjs";

const baseline = {
  inviteExists: true,
  inviteStatus: "pending",
  redeemedBy: null,
  userId: "user-1",
  expiresAt: "2026-10-20T00:00:00.000Z",
  inviteeEmailHash: "email-hash",
  userEmailHash: "email-hash",
  familyStatus: "active",
  subscriptionStatus: "ACTIVE",
  inviteFamilyId: "family-1",
  memberFamilyId: null,
  memberStatus: null,
  usedSeats: 4,
  seatLimit: 5,
};

test("eligible invited member can use an available paid seat", () => {
  assert.deepEqual(evaluateFamilyJoin(baseline, Date.parse("2026-10-18T00:00:00.000Z")), { ok: true, alreadyJoined: false });
});

test("expired, canceled, and already-used invitations are rejected", () => {
  assert.equal(evaluateFamilyJoin({ ...baseline, expiresAt: "2026-10-17T00:00:00.000Z" }, Date.parse("2026-10-18T00:00:00Z")).reason, "INVITE_INVALID");
  assert.equal(evaluateFamilyJoin({ ...baseline, inviteStatus: "cancelled" }).reason, "INVITE_INVALID");
  assert.equal(evaluateFamilyJoin({ ...baseline, inviteStatus: "accepted", redeemedBy: "another-user" }).reason, "INVITE_INVALID");
});

test("only the invited email may redeem a code", () => {
  assert.equal(evaluateFamilyJoin({ ...baseline, userEmailHash: "different-hash" }).reason, "INVITE_EMAIL_MISMATCH");
});

test("inactive subscriptions and full families block joins", () => {
  assert.equal(evaluateFamilyJoin({ ...baseline, familyStatus: "inactive" }).reason, "FAMILY_INACTIVE");
  assert.equal(evaluateFamilyJoin({ ...baseline, usedSeats: 5 }).reason, "NO_SEATS");
});

test("a user cannot belong to another family; accepted redemption is idempotent", () => {
  assert.equal(evaluateFamilyJoin({ ...baseline, memberFamilyId: "family-2" }).reason, "USER_ALREADY_IN_FAMILY");
  assert.deepEqual(evaluateFamilyJoin({ ...baseline, inviteStatus: "accepted", redeemedBy: "user-1" }), { ok: true, alreadyJoined: true });
});

