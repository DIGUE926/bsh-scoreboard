import { supabase } from "@/lib/supabase";

const LIVE_SCORING_KEY = "live_scoring_enabled";
const SCOREBOARD_AHBB_KEY = "scoreboard_ahbb_enabled";

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

/**
 * AHBB est désactivée par défaut dans bsh-scoreboard (gérée automatiquement
 * par le scraper ahbb-tracker, pas de saisie live manuelle nécessaire) --
 * contrairement à isLiveScoringEnabled(), si la ligne n'existe pas on
 * considère la ligue MASQUÉE par défaut. Pour la réactiver plus tard : mettre
 * value=true sur la ligne "scoreboard_ahbb_enabled" dans app_settings
 * (Supabase Table Editor), aucun redéploiement requis.
 */
export async function isScoreboardAhbbEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SCOREBOARD_AHBB_KEY)
    .single();

  if (error || !data) return false;
  return data.value === true;
}
