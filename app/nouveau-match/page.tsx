"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import U20Badge from "@/app/U20Badge";

type Team = { id: string; name: string; league_id: string };
type League = { id: string; name: string; slug: string };

// Programme un match à venir (statut "scheduled") sans démarrer la saisie
// tout de suite -- il apparaîtra ensuite sur l'accueil avec un bouton
// "Démarrer" (QuickStartButton). Pour lancer un match immédiatement avec
// les titulaires, voir /demarrer à la place.
export default function NouveauMatchPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [phase, setPhase] = useState("Saison régulière");
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
    setHomeTeam("");
    setAwayTeam("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (homeTeam === awayTeam) {
      setError("Les deux équipes doivent être différentes.");
      return;
    }

    setLoading(true);

    const { data: homeTeamData } = await supabase
      .from("teams")
      .select("league_id")
      .eq("id", homeTeam)
      .single();

    const { error } = await supabase.from("games").insert({
      league_id: homeTeamData?.league_id,
      home_team_id: homeTeam,
      away_team_id: awayTeam,
      game_date: gameDate,
      phase,
      status: "scheduled",
    });

    setLoading(false);

    if (error) {
      setError("Erreur lors de la création du match : " + error.message);
      return;
    }

    router.push("/");
  }

  return (
    <div>
      <h1 className="font-display text-xl text-bsh-orange mb-4 tracking-wide">
        NOUVEAU MATCH
      </h1>

      {leagues.length > 0 && (
        <div className="mb-4 max-w-md">
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

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm text-white/60 mb-1">
            Équipe à domicile
          </label>
          <select
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            required
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
          <label className="block text-sm text-white/60 mb-1">
            Équipe visiteuse
          </label>
          <select
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            required
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
          <label className="block text-sm text-white/60 mb-1">Date</label>
          <input
            type="date"
            value={gameDate}
            onChange={(e) => setGameDate(e.target.value)}
            required
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:border-bsh-orange outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1">Phase</label>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 focus:border-bsh-orange outline-none"
          >
            <option value="Saison régulière">Saison régulière</option>
            <option value="Playoffs">Playoffs</option>
            <option value="Finale">Finale</option>
          </select>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-bsh-orange text-black font-bold rounded-lg py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer le match"}
        </button>
      </form>
    </div>
  );
}
