import { betterAuth } from "better-auth";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";

let instance: ReturnType<typeof betterAuth> | undefined;

export function auth() {
  if (!process.env.BETTER_AUTH_SECRET) throw new Error("AUTH_NOT_CONFIGURED");
  if (!instance) {
    instance = betterAuth({
      database: db(),
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.APP_URL,
      appName: "CareCircle",
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 10,
        maxPasswordLength: 128,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url }) => {
          await sendEmail(user.email, "Reset your CareCircle password", `<p>Use this secure link to reset your password:</p><p><a href="${url}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`);
        },
      },
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        expiresIn: 60 * 60,
        sendVerificationEmail: async ({ user, url }) => {
          await sendEmail(user.email, "Verify your CareCircle email", `<p>Welcome to CareCircle.</p><p><a href="${url}">Verify your email</a></p><p>This link expires in one hour.</p>`);
        },
      },
      session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
      rateLimit: {
        enabled: true,
        window: 60,
        max: 60,
        storage: "database",
        modelName: "rateLimit",
        customRules: {
          "/sign-in/email": { window: 60, max: 5 },
          "/sign-up/email": { window: 60, max: 5 },
          "/request-password-reset": { window: 300, max: 3 },
        },
      },
      advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
    });
  }
  return instance;
}
