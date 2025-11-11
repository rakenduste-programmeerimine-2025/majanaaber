import { SupabaseClient } from "@supabase/supabase-js";

const MAX_ATTEMPTS = 5;

export interface LoginAttemptStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockedUntil: Date | null;
  minutesRemaining: number | null;
}

export async function checkAccountLocked(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_account_locked", {
    user_id: userId,
  });

  if (error) {
    console.error("Error checking account lock status:", error);
    return false;
  }

  return data === true;
}

export async function incrementFailedAttempts(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("increment_failed_login_attempts", {
    user_id: userId,
  });

  if (error) {
    console.error("Error incrementing failed attempts:", error);
    return 0;
  }

  return data || 0;
}

export async function resetFailedAttempts(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc("reset_failed_login_attempts", {
    user_id: userId,
  });

  if (error) {
    console.error("Error resetting failed attempts:", error);
    console.error("User ID:", userId);
  }
}

export async function getRemainingAttempts(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase.rpc("get_remaining_login_attempts", {
    user_id: userId,
  });

  if (error) {
    console.error("Error getting remaining attempts:", error);
    return MAX_ATTEMPTS;
  }

  return data || 0;
}

export async function getLoginAttemptStatus(
  supabase: SupabaseClient,
  email: string
): Promise<LoginAttemptStatus | null> {
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, failed_login_attempts, locked_until")
    .eq("id", (
      await supabase
        .from("auth.users")
        .select("id")
        .eq("email", email)
        .single()
    )?.data?.id || "")
    .single();

  if (profileError) {
    return null;
  }

  const lockedUntil = profiles?.locked_until
    ? new Date(profiles.locked_until)
    : null;
  const now = new Date();
  const isLocked = lockedUntil ? lockedUntil > now : false;
  const minutesRemaining = isLocked && lockedUntil
    ? Math.ceil((lockedUntil.getTime() - now.getTime()) / (1000 * 60))
    : null;

  return {
    isLocked,
    remainingAttempts: MAX_ATTEMPTS - (profiles?.failed_login_attempts || 0),
    lockedUntil,
    minutesRemaining,
  };
}

export function formatLockoutTime(minutes: number): string {
  if (minutes < 1) {
    return "less than a minute";
  }
  if (minutes === 1) {
    return "1 minute";
  }
  return `${minutes} minutes`;
}
