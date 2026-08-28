import { supabase } from "@/lib/supabase";

const LIVE_SCORING_KEY = "live_scoring_enabled";

/**
 * Même kill switch que bsh-web (table app_settings partagée). Si la ligne
 * n'existe pas, on considère la feature activée par défaut.
 */
export async function isLiveScoringEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LIVE_SCORING_KEY)
    .single();

  if (error || !data) return true;
  return data.value === true;
}
