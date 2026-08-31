"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import U20Badge from "@/app/U20Badge";
import { isScoreboardAhbbEnabled } from "@/lib/settings";

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
  const [homeTeamNewName, setHomeTeamNewName] = useState("");
  const [awayTeamNewName, setAwayTeamNewName] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [phase, setPhase] = useState("Saison régulière");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // AHBB masquée par défaut -- gérée automatiquement par le scraper
    // (ahbb-tracker), pas de saisie live manuelle nécessaire. Activable
    // sans redéploiement via app_settings.scoreboard_ahbb_enabled.
    async function loadLeagues() {
      const ahbbEnabled = await isScoreboardAhbbEnabled();
      let query = supabase.from("leagues").select("id, name, slug").order("name");
      if (!ahbbEnabled) query = query.eq("slug", "suble");
      const { data } = await query;
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
    setHomeTeamNewName("");
    setAwayTeamNewName("");
  }

  // Crée une équipe à la volée (nom tapé à la main, ex. "Team A" pour un
  // essai) -- pratique pour tester l'app sans dépendre des vraies équipes.
  // Sans joueurs : utilisable pour programmer un match, mais /demarrer
  // ne pourra pas demander de titulaires pour ce côté. Réutilise une équipe
  // existante si le nom tapé correspond déjà à une équipe de la ligue
  // (comparaison insensible à la casse/aux espaces) -- sinon chaque nouvel
  // essai avec le même nom ("Team A" puis "team a") créait un doublon dans
  // la liste des équipes (retour Digue 2026-08-31 : "bug dans la liste des
  // equipes").
  async function resolveTeamId(
    selected: string,
    newName: string
  ): Promise<{ id: string; league_id: string } | null> {
    if (selected !== "__new__") {
      const team = teams.find((t) => t.id === selected);
      return team ? { id: team.id, league_id: team.league_id } : null;
    }
    const name = newName.trim();
    if (!name) return null;

    const existing = teams.find(
      (t) => t.league_id === leagueId && t.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return { id: existing.id, league_id: existing.league_id };

    const { data, error } = await supabase
      .from("teams")
      .insert({ name, league_id: leagueId })
      .select("id, league_id")
      .single();
    if (error || !data) return null;
    return data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (homeTeam === awayTeam && homeTeam !== "__new__") {
      setError("Les deux équipes doivent être différentes.");
      return;
    }

    setLoading(true);

    const home = await resolveTeamId(homeTeam, homeTeamNewName);
    const away = await resolveTeamId(awayTeam, awayTeamNewName);

    if (!home || !away) {
      setLoading(false);
      setError("Choisis ou nomme les deux équipes.");
      return;
    }

    const { error } = await supabase.from("games").insert({
      league_id: home.league_id,
      home_team_id: home.id,
      away_team_id: away.id,
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
            <option value="__new__">+ Nouvelle équipe (test)</option>
            {leagueTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {homeTeam === "__new__" && (
            <input
              type="text"
              value={homeTeamNewName}
              onChange={(e) => setHomeTeamNewName(e.target.value)}
              placeholder="ex: Team A"
              required
              className="w-full mt-2 bg-white/5 border border-bsh-orange/40 rounded-lg px-4 py-2 focus:border-bsh-orange outline-none"
            />
          )}
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
            <option value="__new__">+ Nouvelle équipe (test)</option>
            {leagueTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {awayTeam === "__new__" && (
            <input
              type="text"
              value={awayTeamNewName}
              onChange={(e) => setAwayTeamNewName(e.target.value)}
              placeholder="ex: Team B"
              required
              className="w-full mt-2 bg-white/5 border border-bsh-orange/40 rounded-lg px-4 py-2 focus:border-bsh-orange outline-none"
            />
          )}
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
