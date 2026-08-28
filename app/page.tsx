import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import QuickStartButton from "./QuickStartButton";
import SignOutButton from "./SignOutButton";
import { isLiveScoringEnabled } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Page d'accueil = liste des matchs à scorer. Protégée par le middleware
// (redirige vers /login si pas connecté). Volontairement minimal : rien
// d'autre que "choisir un match, démarrer/continuer la saisie".
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const liveEnabled = await isLiveScoringEnabled();

  const { data: games } = await supabase
    .from("games")
    .select(
      "*, home_team:home_team_id(name), away_team:away_team_id(name), league:league_id(slug)"
    )
    .in("status", ["scheduled", "live"])
    .order("game_date", { ascending: true })
    .limit(20);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <h1 className="font-display text-lg sm:text-xl text-bsh-orange tracking-wide">
          BSH SCOREBOARD
        </h1>
        <SignOutButton />
      </div>
      <p className="text-xs sm:text-sm text-white/40 mb-6 truncate">{user?.email}</p>

      {!liveEnabled && (
        <div className="border border-red-500/40 bg-red-500/10 rounded-lg p-4 mb-4 text-sm text-red-300">
          Scoreboard Live temporairement désactivé (maintenance).
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <Link
          href="/demarrer"
          className="flex-1 text-center bg-bsh-orange text-black font-bold rounded-lg px-3 py-2.5 text-sm hover:opacity-90 transition-opacity"
        >
          ● Démarrer un match
        </Link>
        <Link
          href="/nouveau-match"
          className="flex-1 text-center bg-white/10 text-white/80 font-bold rounded-lg px-3 py-2.5 text-sm hover:bg-white/20 transition-colors"
        >
          + Programmer un match
        </Link>
      </div>

      <div className="space-y-3">
        {games?.map((game) => (
          <div
            key={game.id}
            className="relative block border border-white/10 rounded-lg p-3 sm:p-4 hover:border-bsh-orange transition-colors bg-white/5"
          >
            <Link
              href={`/match/${game.id}/live`}
              className="absolute inset-0"
              aria-label={`Saisir ${game.home_team?.name ?? "?"} vs ${game.away_team?.name ?? "?"}`}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {game.league?.slug && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-bsh-orange bg-bsh-orange/10 rounded px-1.5 py-0.5">
                      {game.league.slug}
                    </span>
                  )}
                  <p className="font-semibold text-sm sm:text-base truncate">
                    {game.home_team?.name ?? "?"} vs {game.away_team?.name ?? "?"}
                  </p>
                </div>
                <p className="text-xs sm:text-sm text-white/50">
                  {game.game_date} · {game.phase ?? "Saison régulière"}
                </p>
              </div>
              <div className="relative z-10 flex items-center justify-between sm:justify-end gap-2">
                <div className="sm:text-right">
                  <p className="font-display text-base sm:text-lg text-bsh-gold">
                    {game.home_score ?? "-"} / {game.away_score ?? "-"}
                  </p>
                  <p className="text-[10px] sm:text-xs text-white/40 uppercase">{game.status}</p>
                </div>
                {game.status === "scheduled" ? (
                  <QuickStartButton gameId={game.id} disabled={!liveEnabled} />
                ) : (
                  <Link
                    href={`/match/${game.id}/live`}
                    className="relative z-10 text-xs bg-white/10 text-white/80 font-bold rounded px-2 py-1 hover:bg-white/20"
                  >
                    Continuer →
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
        {(!games || games.length === 0) && (
          <p className="text-white/50">Aucun match programmé ou en cours pour le moment.</p>
        )}
      </div>
    </div>
  );
}
