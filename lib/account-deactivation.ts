import { SupabaseClient } from "@supabase/supabase-js";

export interface DeactivationInfo {
  is_deactivated: boolean;
  deactivated_at: string | null;
  deactivation_reason: string | null;
}

export async function deactivateAccount(
  supabase: SupabaseClient,
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("deactivate_account", {
      target_user_id: userId,
      reason: reason || null,
    });

    if (error) {
      console.error("Error deactivating account:", error);
      return { success: false, error: error.message };
    }

    return { success: data === true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function reactivateAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc("reactivate_account", {
      target_user_id: userId,
    });

    if (error) {
      console.error("Error reactivating account:", error);
      return { success: false, error: error.message };
    }

    return { success: data === true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function isAccountDeactivated(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_account_deactivated", {
      check_user_id: userId,
    });

    if (error) {
      console.error("Error checking account deactivation:", error);
      return false;
    }

    return data === true;
  } catch {
    return false;
  }
}

export async function getAccountDeactivationInfo(
  supabase: SupabaseClient,
  userId: string
): Promise<DeactivationInfo | null> {
  try {
    const { data, error } = await supabase.rpc(
      "get_account_deactivation_info",
      {
        check_user_id: userId,
      }
    );

    if (error) {
      console.error("Error getting deactivation info:", error);
      return null;
    }

    if (data && data.length > 0) {
      return data[0] as DeactivationInfo;
    }

    return null;
  } catch {
    return null;
  }
}

export function formatDeactivationDate(dateString: string | null): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
