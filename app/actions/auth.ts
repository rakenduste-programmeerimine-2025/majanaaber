"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  checkLoginRateLimit,
  checkStrictRateLimit,
  checkEmailResendRateLimit,
  getClientIP,
  resetRateLimit,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import {
  incrementFailedAttempts,
  resetFailedAttempts,
  formatLockoutTime,
} from "@/lib/login-attempts";

export interface LoginResult {
  success: boolean;
  error?: string;
  rateLimited?: boolean;
  redirectTo?: string;
  isLockoutError?: boolean;
}

export async function loginWithRateLimit(
  email: string,
  password: string
): Promise<LoginResult> {
  const headersList = await headers();
  const ip = getClientIP(headersList);

  const rateLimit = await checkLoginRateLimit(ip);
  if (!rateLimit.success) {
    const resetDate = new Date(rateLimit.reset);
    const minutesRemaining = Math.ceil(
      (resetDate.getTime() - Date.now()) / (1000 * 60)
    );
    return {
      success: false,
      rateLimited: true,
      error: `Too many login attempts from your IP address. Please try again in ${formatLockoutTime(minutesRemaining)}.`,
    };
  }

  const supabase = await createClient();

  try {
    const { data: userId } = await supabase.rpc("get_user_id_by_email", {
      user_email: email,
    });

    if (userId) {
      const { data: profileData } = await supabase.rpc(
        "get_profile_login_info",
        { user_id: userId }
      );

      const profile =
        profileData && profileData.length > 0 ? profileData[0] : null;

      if (profile) {
        const lockedUntil = profile.locked_until
          ? new Date(profile.locked_until)
          : null;
        const now = new Date();

        if (lockedUntil && lockedUntil > now) {
          const minutesRemaining = Math.ceil(
            (lockedUntil.getTime() - now.getTime()) / (1000 * 60)
          );
          return {
            success: false,
            isLockoutError: true,
            error: `Account is temporarily locked. Please try again in ${formatLockoutTime(minutesRemaining)}.`,
          };
        }
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (userId) {
        const { data: profileData } = await supabase.rpc(
          "get_profile_login_info",
          { user_id: userId }
        );

        const profile =
          profileData && profileData.length > 0 ? profileData[0] : null;

        if (profile) {
          const newAttemptCount = await incrementFailedAttempts(
            supabase,
            profile.id
          );
          const remainingAttempts = Math.max(0, 5 - newAttemptCount);

          if (remainingAttempts > 0) {
            return {
              success: false,
              error: `Invalid email or password. You have ${remainingAttempts} attempt${remainingAttempts !== 1 ? "s" : ""} remaining before your account is locked.`,
            };
          } else {
            return {
              success: false,
              isLockoutError: true,
              error:
                "Account locked due to too many failed login attempts. Please try again in 15 minutes.",
            };
          }
        }
      }

      return {
        success: false,
        error: error.message || "Invalid email or password.",
      };
    }

    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: "Please verify your email address before logging in.",
        redirectTo: `/auth/verify-email?email=${encodeURIComponent(email)}`,
      };
    }

    if (data.user) {
      await resetFailedAttempts(supabase, data.user.id);
      await resetRateLimit(ip);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const redirectTo =
        profile?.role === "building_manager" ? "/manager-hub" : "/resident-hub";

      return {
        success: true,
        redirectTo,
      };
    }

    return {
      success: false,
      error: "An unexpected error occurred.",
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An error occurred",
    };
  }
}

export interface ResendEmailResult {
  success: boolean;
  error?: string;
  rateLimited?: boolean;
  remainingAttempts?: number;
  resetInMinutes?: number;
}

export async function resendVerificationEmail(
  email: string
): Promise<ResendEmailResult> {
  const headersList = await headers();
  const ip = getClientIP(headersList);

  // Use both IP and email as identifier to prevent abuse
  const identifier = `${ip}:${email}`;
  const rateLimit = await checkEmailResendRateLimit(identifier);

  if (!rateLimit.success) {
    const resetDate = new Date(rateLimit.reset);
    const minutesRemaining = Math.ceil(
      (resetDate.getTime() - Date.now()) / (1000 * 60)
    );
    return {
      success: false,
      rateLimited: true,
      error: `Too many email resend requests. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
      resetInMinutes: minutesRemaining,
    };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
        remainingAttempts: rateLimit.remaining,
      };
    }

    return {
      success: true,
      remainingAttempts: rateLimit.remaining,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An error occurred",
      remainingAttempts: rateLimit.remaining,
    };
  }
}
