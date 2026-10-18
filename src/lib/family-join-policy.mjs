export function evaluateFamilyJoin(input, now = Date.now()) {
  if (!input.inviteExists) return { ok: false, reason: "INVITE_INVALID" };
  if (input.inviteStatus === "accepted" && input.redeemedBy === input.userId) return { ok: true, alreadyJoined: true };
  const expiresAt = new Date(input.expiresAt ?? "").getTime();
  if (input.inviteStatus !== "pending" || !Number.isFinite(expiresAt) || expiresAt <= now) return { ok: false, reason: "INVITE_INVALID" };
  if (!input.inviteeEmailHash || input.inviteeEmailHash !== input.userEmailHash) return { ok: false, reason: "INVITE_EMAIL_MISMATCH" };
  if (input.familyStatus !== "active" || !["ACTIVE", "APPROVED"].includes(input.subscriptionStatus)) return { ok: false, reason: "FAMILY_INACTIVE" };
  if (input.memberFamilyId && input.memberFamilyId !== input.inviteFamilyId) return { ok: false, reason: "USER_ALREADY_IN_FAMILY" };
  if (input.memberStatus === "active") return { ok: true, alreadyJoined: true };
  if (input.usedSeats >= input.seatLimit) return { ok: false, reason: "NO_SEATS" };
  return { ok: true, alreadyJoined: false };
}

