"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import U20Badge from "@/app/U20Badge";
import { isScoreboardAhbbEnabled } from "@/lib/settings";

type Team = { id: string; name: string; league_id: string };
type Player = { id: string; name: string; jersey_number: number | null };
type League = { id: string; name: string; slug: string };

export default function DemarrerMatchForm() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeTeamNewName, setHomeTeamNewName] = useState("");
  const [awayTeamNewName, setAwayTeamNewName] = useState("");
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [homeStarters, setHomeStarters] = useState<Set<string>>(new Set());
  const [awayStarters, setAwayStarters] = useState<Set<string>>(new Set());
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
    setHomeTeamId("");
    setAwayTeamId("");
    setHomeTeamNewName("");
    setAwayTeamNewName("");
    setHomePlayers([]);
    setAwayPlayers([]);
    setHomeStarters(new Set());
    setAwayStarters(new Set());
  }

  function handleHomeTeamChange(id: string) {
    setHomeTeamId(id);
    if (!id || id === "__new__") {
      setHomePlayers([]);
      setHomeStarters(new Set());
    }
  }

  function handleAwayTeamChange(id: string) {
    setAwayTeamId(id);
    if (!id || id === "__new__") {
      setAwayPlayers([]);
      setAwayStarters(new Set());
    }
  }

  useEffect(() => {
    if (!homeTeamId || homeTeamId === "__new__") return;
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
    if (!awayTeamId || awayTeamId === "__new__") return;
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

  // Nombre de titulaires exigé : 5 normalement, mais réduit à la taille de
  // l'effectif si l'équipe a moins de 5 joueurs (ex. équipe de test créée à
  // la volée pendant un match précédent, avec seulement 1-2 joueurs ajoutés
  // via "+ Joueur"). Une équipe sans aucun joueur n'exige aucun titulaire,
  // comme une équipe "__new__". Sans ça, une équipe existante avec moins de
  // 5 joueurs ne pouvait plus jamais démarrer de match (retour Digue
  // 2026-08-31 : "quand je clique sur equipe a et b jpeux pas commencer les
  // matchs").
  function requiredStarters(players: Player[]) {
    return Math.min(5, players.length);
  }

  function toggleStarter(side: "home" | "away", playerId: string) {
    const set = side === "home" ? homeStarters : awayStarters;
    const setter = side === "home" ? setHomeStarters : setAwayStarters;
    const players = side === "home" ? homePlayers : awayPlayers;
    const max = requiredStarters(players);
    const next = new Set(set);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else {
      if (next.size >= max) return;
      next.add(playerId);
    }
    setter(next);
  }

  const isHomeNew = homeTeamId === "__new__";
  const isAwayNew = awayTeamId === "__new__";
  const rostersLoaded = homeTeamId !== "" && awayTeamId !== "";
  const sameTeamConflict =
    !isHomeNew && !isAwayNew && homeTeamId !== "" && homeTeamId === awayTeamId;
  const homeReady = isHomeNew
    ? homeTeamNewName.trim().length > 0
    : homeTeamId !== "" && homeStarters.size === requiredStarters(homePlayers);
  const awayReady = isAwayNew
    ? awayTeamNewName.trim().length > 0
    : awayTeamId !== "" && awayStarters.size === requiredStarters(awayPlayers);
  const readyToStart = homeReady && awayReady && !sameTeamConflict;

  // Crée une équipe à la volée (nom tapé à la main, ex. "Team A" pour un
  // essai) -- sans joueurs, donc pas de titulaires à choisir pour ce côté.
  // Réutilise une équipe existante si le nom tapé correspond déjà à une
  // équipe de la ligue (insensible à la casse/aux espaces) -- sinon chaque
  // nouvel essai avec le même nom ("Team A" puis "team a") créait un
  // doublon dans la liste des équipes (retour Digue 2026-08-31 : "bug dans
  // la liste des equipes").
  async function resolveTeam(
    teamId: string,
    newName: string
  ): Promise<{ id: string; league_id: string } | null> {
    if (teamId !== "__new__") {
      const team = teams.find((t) => t.id === teamId);
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

  async function handleStart() {
    setError(null);

    if (sameTeamConflict) {
      setError("Les deux équipes doivent être différentes.");
      return;
    }
    const homeRequired = requiredStarters(homePlayers);
    const awayRequired = requiredStarters(awayPlayers);
    if (!isHomeNew && homeStarters.size !== homeRequired) {
      setError(
        homeRequired === 0
          ? "Erreur inattendue avec l'équipe à domicile."
          : `Choisis ${homeRequired} titulaire${homeRequired > 1 ? "s" : ""} pour l'équipe à domicile.`
      );
      return;
    }
    if (!isAwayNew && awayStarters.size !== awayRequired) {
      setError(
        awayRequired === 0
          ? "Erreur inattendue avec l'équipe visiteuse."
          : `Choisis ${awayRequired} titulaire${awayRequired > 1 ? "s" : ""} pour l'équipe visiteuse.`
      );
      return;
    }

    setLoading(true);

    const home = await resolveTeam(homeTeamId, homeTeamNewName);
    const away = await resolveTeam(awayTeamId, awayTeamNewName);

    if (!home || !away) {
      setLoading(false);
      setError("Choisis ou nomme les deux équipes.");
      return;
    }

    const { data: game, error: gameError } = await supabase
      .from("games")
      .insert({
        league_id: home.league_id,
        home_team_id: home.id,
        away_team_id: away.id,
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

    if (starterRows.length > 0) {
      await supabase.from("player_game_stats").insert(starterRows);
    }

    router.push(`/match/${game.id}/live`);
  }

  function renderRoster(
    side: "home" | "away",
    players: Player[],
    starters: Set<string>
  ) {
    const required = requiredStarters(players);
    return (
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wide mb-2">
          {starters.size}/{required} titulaire{required > 1 ? "s" : ""} sélectionné
          {required > 1 ? "s" : ""}
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
            <option value="__new__">+ Nouvelle équipe (test)</option>
            {leagueTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {isHomeNew && (
            <input
              type="text"
              value={homeTeamNewName}
              onChange={(e) => setHomeTeamNewName(e.target.value)}
              placeholder="ex: Team A"
              className="w-full mt-2 bg-white/5 border border-bsh-orange/40 rounded-lg px-4 py-2 focus:border-bsh-orange outline-none"
            />
          )}
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">Équipe visiteuse</label>
          <select
            value={awayTeamId}
            onChange={(e) => handleAwayTeamChange(e.target.value)}
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
          {isAwayNew && (
            <input
              type="text"
              value={awayTeamNewName}
              onChange={(e) => setAwayTeamNewName(e.target.value)}
              placeholder="ex: Team B"
              className="w-full mt-2 bg-white/5 border border-bsh-orange/40 rounded-lg px-4 py-2 focus:border-bsh-orange outline-none"
            />
          )}
        </div>
      </div>

      {sameTeamConflict && (
        <p className="text-red-400 text-sm mb-4">
          Les deux équipes doivent être différentes.
        </p>
      )}

      {rostersLoaded && (
        <div className="grid grid-cols-2 gap-6 mb-6 max-w-2xl">
          {isHomeNew ? (
            <p className="text-sm text-white/40">
              Nouvelle équipe test, pas de joueurs -- juste le score sera suivi.
            </p>
          ) : (
            renderRoster("home", homePlayers, homeStarters)
          )}
          {isAwayNew ? (
            <p className="text-sm text-white/40">
              Nouvelle équipe test, pas de joueurs -- juste le score sera suivi.
            </p>
          ) : (
            renderRoster("away", awayPlayers, awayStarters)
          )}
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
