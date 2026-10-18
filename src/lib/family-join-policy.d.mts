export type FamilyJoinFailure = "INVITE_INVALID" | "INVITE_EMAIL_MISMATCH" | "FAMILY_INACTIVE" | "USER_ALREADY_IN_FAMILY" | "NO_SEATS";
export type FamilyJoinDecision = { ok: true; alreadyJoined: boolean } | { ok: false; reason: FamilyJoinFailure };
export declare function evaluateFamilyJoin(
  input: {
    inviteExists: boolean;
    inviteStatus?: string;
    redeemedBy?: string | null;
    userId: string;
    expiresAt?: string | Date | null;
    inviteeEmailHash?: string | null;
    userEmailHash: string;
    familyStatus?: string | null;
    subscriptionStatus?: string | null;
    inviteFamilyId?: string | null;
    memberFamilyId?: string | null;
    memberStatus?: string | null;
    usedSeats: number;
    seatLimit: number;
  },
  now?: number,
): FamilyJoinDecision;

