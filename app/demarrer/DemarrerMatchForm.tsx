"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import U20Badge from "@/app/U20Badge";

type Team = { id: string; name: string; league_id: string };
type Player = { id: string; name: string; jersey_number: number | null };
type League = { id: string; name: string; slug: string };

export default function DemarrerMatchForm() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [homeStarters, setHomeStarters] = useState<Set<string>>(new Set());
  const [awayStarters, setAwayStarters] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadLeagues() {
      const { data } = await supabase
        .from("leagues")
        .select("id, name, slug")
        .order("name");
      if (data) {
        setLeagues(data);
        if (data.length > 0) setLeagueId(data[0].id);
      }
    }
    loadLeagues();
  }, [supabase]);

  useEffect(() => {
    async function loadTeams() {
      const { data } = await supabase
        .from("teams")
        .select("id, name, league_id")
        .order("name");
      if (data) setTeams(data);
    }
    loadTeams();
  }, [supabase]);

  const leagueTeams = teams.filter((t) => t.league_id === leagueId);

  function handleLeagueChange(id: string) {
    setLeagueId(id);
    setHomeTeamId("");
    setAwayTeamId("");
    setHomePlayers([]);
    setAwayPlayers([]);
    setHomeStarters(new Set());
    setAwayStarters(new Set());
  }

  function handleHomeTeamChange(id: string) {
    setHomeTeamId(id);
    if (!id) {
      setHomePlayers([]);
      setHomeStarters(new Set());
    }
  }

  function handleAwayTeamChange(id: string) {
    setAwayTeamId(id);
    if (!id) {
      setAwayPlayers([]);
      setAwayStarters(new Set());
    }
  }

  useEffect(() => {
    if (!homeTeamId) return;
    supabase
      .from("players")
      .select("id, name, jersey_number")
      .eq("team_id", homeTeamId)
      .order("name")
      .then(({ data }) => {
        setHomePlayers(data ?? []);
        setHomeStarters(new Set());
      });
  }, [homeTeamId, supabase]);

  useEffect(() => {
    if (!awayTeamId) return;
    supabase
      .from("players")
      .select("id, name, jersey_number")
      .eq("team_id", awayTeamId)
      .order("name")
      .then(({ data }) => {
        setAwayPlayers(data ?? []);
        setAwayStarters(new Set());
      });
  }, [awayTeamId, supabase]);

  function toggleStarter(side: "home" | "away", playerId: string) {
    const set = side === "home" ? homeStarters : awayStarters;
    const setter = side === "home" ? setHomeStarters : setAwayStarters;
    const next = new Set(set);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else {
      if (next.size >= 5) return; // max 5 titulaires
      next.add(playerId);
    }
    setter(next);
  }

  const rostersLoaded = homeTeamId && awayTeamId && homeTeamId !== awayTeamId;
  const readyToStart =
    rostersLoaded && homeStarters.size === 5 && awayStarters.size === 5;

  async function handleStart() {
    setError(null);

    if (homeTeamId === awayTeamId) {
      setError("Les deux équipes doivent être différentes.");
      return;
    }
    if (homeStarters.size !== 5 || awayStarters.size !== 5) {
      setError("Choisis exactement 5 titulaires par équipe.");
      return;
    }

    setLoading(true);
    const homeTeam = teams.find((t) => t.id === homeTeamId);

    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({
        league_id: homeTeam?.league_id,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        game_date: new Date().toISOString().slice(0, 10),
        phase: "Saison régulière",
        status: "live",
      })
      .select()
      .single();

    if (gameError || !game) {
      setError("Erreur lors de la création du match : " + gameError?.message);
      setLoading(false);
      return;
    }

    const starterRows = [
      ...Array.from(homeStarters).map((player_id) => ({
        game_id: game.id,
        player_id,
        pts: 0,
        reb: 0,
        ast: 0,
        fgm: 0,
        fga: 0,
        ftm: 0,
        fta: 0,
      })),
      ...Array.from(awayStarters).map((player_id) => ({
        game_id: game.id,
        player_id,
        pts: 0,
        reb: 0,
        ast: 0,
        fgm: 0,
        fga: 0,
        ftm: 0,
        fta: 0,
      })),
    ];

    await supabase.from("player_game_stats").insert(starterRows);

    router.push(`/match/${game.id}/live`);
  }

  function renderRoster(
    side: "home" | "away",
    players: Player[],
    starters: Set<string>
  ) {
    return (
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wide mb-2">
          {starters.size}/5 titulaires sélectionnés
        </p>
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {players.map((p) => {
            const selected = starters.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleStarter(side, p.id)}
                className={`w-full flex items-center gap-2 text-left text-sm rounded px-3 py-2 border transition-colors ${
                  selected
                    ? "border-bsh-orange bg-bsh-orange/10 text-bsh-orange font-semibold"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-white/30"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] shrink-0 ${
                    selected ? "border-bsh-orange bg-bsh-orange text-black" : "border-white/30"
                  }`}
                >
                  {selected ? "✓" : ""}
                </span>
                #{p.jersey_number ?? "-"} {p.name}
              </button>
            );
          })}
          {players.length === 0 && (
            <p className="text-sm text-white/40">Aucun joueur dans cette équipe.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-xl text-bsh-orange mb-1 tracking-wide">
        DÉMARRER UN MATCH
      </h1>
      <p className="text-sm text-white/50 mb-6">
        Choisis les deux équipes, sélectionne les titulaires, et tu passes directement en saisie live.
      </p>

      {leagues.length > 0 && (
        <div className="mb-4 max-w-xl">
          <label className="block text-sm text-white/60 mb-1.5">Ligue</label>
          <div className="flex gap-1.5">
            {leagues.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => handleLeagueChange(l.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  leagueId === l.id
                    ? "bg-bsh-orange text-black"
                    : "bg-white/5 text-white/60 hover:text-bsh-orange"
                }`}
              >
                {l.slug.toUpperCase()}
                <U20Badge slug={l.slug} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-xl">
        <div>
          <label className="block text-sm text-white/60 mb-1">Équipe à domicile</label>
          <select
            value={homeTeamId}
            onChange={(e) => handleHomeTeamChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:border-bsh-orange outline-none"
          >
            <option value="">Sélectionner...</option>
            {leagueTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">Équipe visiteuse</label>
          <select
            value={awayTeamId}
            onChange={(e) => handleAwayTeamChange(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:border-bsh-orange outline-none"
          >
            <option value="">Sélectionner...</option>
            {leagueTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {homeTeamId && awayTeamId && homeTeamId === awayTeamId && (
        <p className="text-red-400 text-sm mb-4">
          Les deux équipes doivent être différentes.
        </p>
      )}

      {rostersLoaded && (
        <div className="grid grid-cols-2 gap-6 mb-6 max-w-2xl">
          {renderRoster("home", homePlayers, homeStarters)}
          {renderRoster("away", awayPlayers, awayStarters)}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <button
        onClick={handleStart}
        disabled={!readyToStart || loading}
        className="bg-bsh-orange text-black font-bold rounded-lg px-6 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Démarrage..." : "● Commencer le match"}
      </button>
    </div>
  );
}
