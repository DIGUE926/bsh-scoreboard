import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import LiveControls from "@/app/LiveControls";
import { isLiveScoringEnabled } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const supabase = await createClient();

  if (!(await isLiveScoringEnabled())) {
    return (
      <div>
        <div className="border border-red-500/40 bg-red-500/10 rounded-lg p-6 text-center">
          <p className="text-red-300 font-semibold mb-2">
            Scoreboard Live temporairement désactivé
          </p>
          <p className="text-sm text-white/50 mb-4">
            La saisie en direct est coupée pendant la maintenance.
          </p>
          <Link href="/" className="text-bsh-gold hover:underline text-sm">
            ← Retour aux matchs
          </Link>
        </div>
      </div>
    );
  }

  const { data: game } = await supabase
    .from("games")
    .select("*, home_team:home_team_id(id,name), away_team:away_team_id(id,name)")
    .eq("id", gameId)
    .single();

  if (!game) notFound();

  const homeTeam = game.home_team as unknown as { id: string; name: string };
  const awayTeam = game.away_team as unknown as { id: string; name: string };

  const { data: homePlayers } = await supabase
    .from("players")
    .select("id, name, jersey_number")
    .eq("team_id", homeTeam.id)
    .order("name");

  const { data: awayPlayers } = await supabase
    .from("players")
    .select("id, name, jersey_number")
    .eq("team_id", awayTeam.id)
    .order("name");

  const { data: events } = await supabase
    .from("game_events")
    .select("*")
    .eq("game_id", gameId)
    .eq("game_type", "regular")
    .order("created_at", { ascending: true });

  const { data: existingStats } = await supabase
    .from("player_game_stats")
    .select("*")
    .eq("game_id", gameId);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-lg sm:text-xl text-bsh-orange tracking-wide">
          {homeTeam.name} VS {awayTeam.name}
        </h1>
        <Link href="/" className="text-sm text-white/50 hover:text-bsh-orange">
          ← Matchs
        </Link>
      </div>
      <p className="text-white/50 mb-6">{game.game_date}</p>

      <LiveControls
        gameType="regular"
        gameId={gameId}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homePlayers={homePlayers ?? []}
        awayPlayers={awayPlayers ?? []}
        initialHomeScore={game.home_score ?? 0}
        initialAwayScore={game.away_score ?? 0}
        initialStatus={game.status ?? "scheduled"}
        initialPeriod={game.current_period ?? 1}
        initialClock={game.clock_display ?? ""}
        initialShots={events ?? []}
        existingStats={existingStats ?? []}
      />
    </div>
  );
}
