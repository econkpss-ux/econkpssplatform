import { supabase } from "@/integrations/supabase/client";

export const SITE_SETTINGS_QUERY_KEY = ["site-settings", "maintenance"] as const;

export type SiteSettings = {
  id: number;
  maintenance_enabled: boolean;
  maintenance_title: string;
  maintenance_message: string;
  updated_at: string;
};

export async function getSiteSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("id, maintenance_enabled, maintenance_title, maintenance_message, updated_at")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}
