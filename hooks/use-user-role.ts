"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

type UserRole = "building_owner" | "apartment_owner" | "resident" | null;

export function useUserRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        setRole(profile?.role || null);
      }
      
      setLoading(false);
    };

    fetchUserRole();
  }, []);

  return { role, loading, isOwner: role === "building_owner" };
}
