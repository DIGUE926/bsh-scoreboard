"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CourtDiagram, { ShotPoint, guessShotType } from "@/app/CourtDiagram";

type Team = { id: string; name: string };
type Player = { id: string; name: string; jersey_number: number | null };
type EventType = "2PT" | "3PT" | "FT" | "REB" | "AST";
type GameEvent = ShotPoint & {
  id: string;
  player_id: string;
  team_id: string;
  period: number;
};
type GameType = "regular" | "playoff";

type BoxRow = {
  id: string | null;
  pts: number;
  reb: number;
  ast: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
};

type StatDelta = Partial<Omit<BoxRow, "id">>;

const EMPTY_ROW: Omit<BoxRow, "id"> = { pts: 0, reb: 0, ast: 0, fgm: 0, fga: 0, ftm: 0, fta: 0 };

function deltaFor(eventType: EventType, made: boolean): StatDelta {
  switch (eventType) {
    case "2PT":
      return made ? { pts: 2, fgm: 1, fga: 1 } : { fga: 1 };
    case "3PT":
      return made ? { pts: 3, fgm: 1, fga: 1 } : { fga: 1 };
    case "FT":
      return made ? { pts: 1, ftm: 1, fta: 1 } : { fta: 1 };
    case "REB":
      return { reb: 1 };
    case "AST":
      return { ast: 1 };
  }
}

function pointsFor(eventType: EventType, made: boolean): number {
  if (!made) return 0;
  if (eventType === "3PT") return 3;
  if (eventType === "2PT") return 2;
  if (eventType === "FT") return 1;
  return 0;
}

// Panneau d'ajout rapide de joueur -- purement présentationnel (le
// composant qui l'utilise décide de la cible et de ce qui se passe une fois
// le joueur créé/sélectionné). Défini au niveau module, pas dans le corps de
// LiveControls, pour éviter de recréer un composant à chaque rendu.
function QuickAddPanel({
  name,
  onNameChange,
  onPick,
  onSubmit,
  error,
}: {
  name: string;
  onNameChange: (v: string) => void;
  onPick: (letter: string) => void;
  onSubmit: () => void;
  error: string | null;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 p-3 border border-bsh-orange/30 rounded-lg bg-white/5">
      <span className="text-xs text-white/50 mr-1">Rapide :</span>
      {["A", "B", "C", "D", "E"].map((letter) => (
        <button
          key={letter}
          onClick={() => onPick(letter)}
          className="w-8 h-8 rounded bg-white/10 text-sm font-bold hover:bg-bsh-orange hover:text-black transition-colors"
        >
          {letter}
        </button>
      ))}
      <span className="text-xs text-white/50 mx-1">ou</span>
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        placeholder="Nom du joueur"
        className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm focus:border-bsh-orange outline-none"
      />
      <button onClick={onSubmit} className="text-sm bg-bsh-orange text-black font-bold rounded px-3 py-1.5">
        Ajouter
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export default function LiveControls({
  gameType,
  gameId,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  initialHomeScore,
  initialAwayScore,
  initialStatus,
  initialPeriod,
  initialClock,
  initialShots,
  existingStats,
}: {
  gameType: GameType;
  gameId: string;
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: Player[];
  awayPlayers: Player[];
  initialHomeScore: number;
  initialAwayScore: number;
  initialStatus: string;
  initialPeriod: number;
  initialClock: string;
  initialShots: GameEvent[];
  existingStats: Array<{ id: string; player_id: string } & Record<string, number | null>>;
}) {
  const supabase = createClient();
  const scoreTable = gameType === "regular" ? "games" : "playoff_games";
  const statsTable = gameType === "regular" ? "player_game_stats" : "playoff_player_stats";
  const statsFk = gameType === "regular" ? "game_id" : "playoff_game_id";

  const [homeScore, setHomeScore] = useState(initialHomeScore);
  const [awayScore, setAwayScore] = useState(initialAwayScore);
  const [status, setStatus] = useState(initialStatus);
  const [period, setPeriod] = useState(initialPeriod);
  const [clock, setClock] = useState(initialClock);
  const [events, setEvents] = useState<GameEvent[]>(initialShots);

  const [box, setBox] = useState<Record<string, BoxRow>>(() => {
    const map: Record<string, BoxRow> = {};
    for (const s of existingStats) {
      map[s.player_id] = {
        id: s.id,
        pts: s.pts ?? 0,
        reb: s.reb ?? 0,
        ast: s.ast ?? 0,
        fgm: s.fgm ?? 0,
        fga: s.fga ?? 0,
        ftm: s.ftm ?? 0,
        fta: s.fta ?? 0,
      };
    }
    return map;
  });

  const [selectedTeamId, setSelectedTeamId] = useState<string>(homeTeam.id);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [pendingShot, setPendingShot] = useState<{ x: number; y: number } | null>(null);

  // Étapes du "slide" d'attribution d'un tir (retour Digue 2026-08-31) :
  // clic sur le terrain → réussi/raté vite fait → quelle équipe → qui a
  // shooté (titulaires) → qui a fait la passe (titulaires moins le
  // shooteur, uniquement si le tir est réussi). null = pas de tir en cours,
  // les contrôles habituels (LF/rebond/passe manuels) restent visibles.
  type ShotStage = "made_miss" | "team" | "shooter" | "assist" | null;
  const [shotStage, setShotStage] = useState<ShotStage>(null);
  const [shotMade, setShotMade] = useState<boolean | null>(null);
  const [shotTeamId, setShotTeamId] = useState<string>("");
  const [shotShooterId, setShotShooterId] = useState<string>("");

  // Roster tenu en état local (pas juste les props) -- permet d'ajouter des
  // joueurs à la volée en cours de match (équipe test sans roster, ou joueur
  // manquant), sans recharger la page.
  const [homeRoster, setHomeRoster] = useState<Player[]>(homePlayers);
  const [awayRoster, setAwayRoster] = useState<Player[]>(awayPlayers);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);

  const players = selectedTeamId === homeTeam.id ? homeRoster : awayRoster;
  const allPlayers = [...homeRoster, ...awayRoster];
  const rosterFor = (teamId: string) => (teamId === homeTeam.id ? homeRoster : awayRoster);

  // Crée (ou réutilise si le nom existe déjà côté équipe cible) un joueur à
  // la volée -- pratique pour une équipe test sans roster ("A", "B", "C"...)
  // ou pour ajouter rapidement un remplaçant non listé. Retourne le joueur
  // (créé ou existant) pour que l'appelant décide de la suite -- utilisé à
  // la fois par la sélection manuelle et par le slide d'attribution de tir.
  async function addPlayer(rawName: string, teamId: string): Promise<Player | null> {
    const name = rawName.trim();
    if (!name) return null;
    setAddPlayerError(null);

    const existing = rosterFor(teamId).find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setAddingPlayer(false);
      setNewPlayerName("");
      return existing;
    }

    const { data, error } = await supabase
      .from("players")
      .insert({ team_id: teamId, name })
      .select("id, name, jersey_number")
      .single();

    if (error || !data) {
      setAddPlayerError("Erreur lors de l'ajout du joueur.");
      return null;
    }

    if (teamId === homeTeam.id) setHomeRoster((prev) => [...prev, data]);
    else setAwayRoster((prev) => [...prev, data]);
    setAddingPlayer(false);
    setNewPlayerName("");
    return data;
  }

  async function persistScore(newHome: number, newAway: number) {
    setHomeScore(newHome);
    setAwayScore(newAway);
    await supabase
      .from(scoreTable)
      .update({ home_score: newHome, away_score: newAway })
      .eq("id", gameId);
  }

  function bumpScore(teamId: string, delta: number) {
    if (delta === 0) return;
    if (teamId === homeTeam.id) persistScore(Math.max(0, homeScore + delta), awayScore);
    else persistScore(homeScore, Math.max(0, awayScore + delta));
  }

  async function goLive() {
    setStatus("live");
    await supabase.from(scoreTable).update({ status: "live" }).eq("id", gameId);
  }

  async function endGame() {
    setStatus("completed");
    await supabase.from(scoreTable).update({ status: "completed" }).eq("id", gameId);
  }

  async function changePeriod(delta: number) {
    const next = Math.max(1, period + delta);
    setPeriod(next);
    await supabase.from(scoreTable).update({ current_period: next }).eq("id", gameId);
  }

  async function saveClock() {
    await supabase.from(scoreTable).update({ clock_display: clock }).eq("id", gameId);
  }

  async function applyDelta(playerId: string, delta: StatDelta) {
    const current = box[playerId] ?? { id: null, ...EMPTY_ROW };
    const next: BoxRow = {
      id: current.id,
      pts: current.pts + (delta.pts ?? 0),
      reb: current.reb + (delta.reb ?? 0),
      ast: current.ast + (delta.ast ?? 0),
      fgm: current.fgm + (delta.fgm ?? 0),
      fga: current.fga + (delta.fga ?? 0),
      ftm: current.ftm + (delta.ftm ?? 0),
      fta: current.fta + (delta.fta ?? 0),
    };
    setBox((prev) => ({ ...prev, [playerId]: next }));

    const payload: Record<string, string | number> = {
      [statsFk]: gameId,
      player_id: playerId,
      pts: next.pts,
      reb: next.reb,
      ast: next.ast,
      fgm: next.fgm,
      fga: next.fga,
      ftm: next.ftm,
      fta: next.fta,
    };

    if (current.id) {
      await supabase.from(statsTable).update(payload).eq("id", current.id);
    } else {
      const { data } = await supabase.from(statsTable).insert(payload).select("id").single();
      if (data) {
        setBox((prev) => ({ ...prev, [playerId]: { ...prev[playerId], id: data.id } }));
      }
    }
  }

  async function insertGameEvent(
    playerId: string,
    teamId: string,
    eventType: EventType,
    made: boolean,
    x?: number,
    y?: number
  ) {
    const points = pointsFor(eventType, made);

    const { data, error } = await supabase
      .from("game_events")
      .insert({
        game_id: gameId,
        game_type: gameType,
        player_id: playerId,
        team_id: teamId,
        period,
        x: x ?? null,
        y: y ?? null,
        event_type: eventType,
        made,
        points,
      })
      .select()
      .single();

    if (!error && data) {
      setEvents((prev) => [...prev, data as GameEvent]);
      await applyDelta(playerId, deltaFor(eventType, made));
      if (points > 0) bumpScore(teamId, points);
    }
  }

  async function recordEvent(eventType: EventType, made: boolean) {
    if (!selectedPlayerId) return;
    await insertGameEvent(selectedPlayerId, selectedTeamId, eventType, made);
  }

  // Slide d'attribution d'un tir : clic terrain → réussi/raté → équipe →
  // shooteur → (si réussi) passeur. Le terrain reste cliquable en
  // permanence -- plus besoin de choisir un joueur avant de taper le tir.
  function handleCourtClick(x: number, y: number) {
    if (shotStage) return; // un tir est déjà en cours d'attribution
    setAddingPlayer(false);
    setPendingShot({ x, y });
    setShotStage("made_miss");
  }

  function chooseMadeMiss(made: boolean) {
    setShotMade(made);
    setShotStage("team");
  }

  function chooseShotTeam(teamId: string) {
    setShotTeamId(teamId);
    setShotStage("shooter");
  }

  function chooseShooter(playerId: string) {
    setShotShooterId(playerId);
    if (shotMade) {
      setShotStage("assist");
    } else {
      finalizeShot(playerId);
    }
  }

  function cancelShotWizard() {
    setPendingShot(null);
    setShotStage(null);
    setShotMade(null);
    setShotTeamId("");
    setShotShooterId("");
    setAddingPlayer(false);
  }

  async function finalizeShot(shooterId: string, assistId?: string) {
    if (!pendingShot || shotMade === null || !shotTeamId) return;
    const eventType = guessShotType(pendingShot.x, pendingShot.y);
    await insertGameEvent(shooterId, shotTeamId, eventType, shotMade, pendingShot.x, pendingShot.y);
    if (shotMade && assistId) {
      await insertGameEvent(assistId, shotTeamId, "AST", true);
    }
    cancelShotWizard();
  }

  async function undoLastEvent() {
    const last = events[events.length - 1];
    if (!last) return;
    await supabase.from("game_events").delete().eq("id", last.id);
    setEvents((prev) => prev.slice(0, -1));

    const delta = deltaFor(last.event_type, last.made);
    const reversed: StatDelta = Object.fromEntries(
      Object.entries(delta).map(([k, v]) => [k, -(v as number)])
    );
    await applyDelta(last.player_id, reversed);

    const points = pointsFor(last.event_type, last.made);
    if (points > 0) bumpScore(last.team_id, -points);
  }

  const guess = pendingShot ? guessShotType(pendingShot.x, pendingShot.y) : "2PT";
  const courtShots = events.filter((e) => e.event_type === "2PT" || e.event_type === "3PT");

  return (
    <div>
      {/* Status + score bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 border border-white/10 rounded-lg bg-white/5">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              status === "live" ? "bg-red-500 animate-pulse" : "bg-white/30"
            }`}
          />
          <span className="text-xs uppercase text-white/60">{status}</span>
        </div>
        {status !== "live" && status !== "completed" && (
          <button onClick={goLive} className="bg-red-600 text-white text-sm font-bold rounded px-3 py-1.5">
            ● Démarrer le direct
          </button>
        )}
        {status === "live" && (
          <button onClick={endGame} className="bg-white/10 text-white text-sm font-bold rounded px-3 py-1.5 hover:bg-white/20">
            Terminer le match
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => changePeriod(-1)} className="w-7 h-7 rounded bg-white/10 hover:bg-white/20">−</button>
          <span className="text-sm text-white/70 w-16 text-center">Période {period}</span>
          <button onClick={() => changePeriod(1)} className="w-7 h-7 rounded bg-white/10 hover:bg-white/20">+</button>
        </div>

        <input
          value={clock}
          onChange={(e) => setClock(e.target.value)}
          onBlur={saveClock}
          placeholder="8:42"
          className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-center text-sm focus:border-bsh-orange outline-none"
        />
      </div>

      {/* Score display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[{ team: homeTeam, score: homeScore }, { team: awayTeam, score: awayScore }].map(({ team, score }) => (
          <div key={team.id} className="border border-white/10 rounded-lg p-4 text-center bg-white/5">
            <p className="text-sm text-white/60 mb-1">{team.name}</p>
            <p className="font-display text-4xl text-bsh-gold">{score}</p>
          </div>
        ))}
      </div>

      {/* En dehors d'un tir en cours d'attribution : contrôles habituels
          (équipe/joueur actif + LF/rebond/passe manuels). Pendant un tir
          (shotStage non-null), ce bloc laisse la place au slide juste en
          dessous -- retour Digue 2026-08-31 ("ca doit etre comme un
          slide") : le terrain se tape en premier, on attribue ensuite. */}
      {!shotStage && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {[homeTeam, awayTeam].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTeamId(t.id);
                    setSelectedPlayerId("");
                  }}
                  className={`px-3 py-1.5 text-sm ${
                    selectedTeamId === t.id ? "bg-bsh-orange text-black font-bold" : "bg-white/5 text-white/70"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {events.length > 0 && (
              <button onClick={undoLastEvent} className="text-sm text-white/50 hover:text-white ml-auto">
                ↩ Annuler dernière action
              </button>
            )}
          </div>

          {/* Joueurs en gros boutons tactiles -- un tap suffit, pas de menu
              déroulant à ouvrir/scroller en plein match (retour Digue
              2026-08-31 : "trop long pour choisir les joueurs"). Sert aux
              actions manuelles (LF/rebond/passe) ci-dessous -- les tirs
              passent maintenant par le slide déclenché au clic sur le
              terrain. */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayerId(p.id)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  selectedPlayerId === p.id
                    ? "bg-bsh-orange text-black"
                    : "bg-white/10 text-white/80 hover:bg-white/20"
                }`}
              >
                #{p.jersey_number ?? "-"} {p.name}
              </button>
            ))}
            <button
              onClick={() => setAddingPlayer((v) => !v)}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/5 text-white/50 border border-dashed border-white/20 hover:bg-white/10"
            >
              + Joueur
            </button>
          </div>

          {addingPlayer && (
            <QuickAddPanel
              name={newPlayerName}
              onNameChange={setNewPlayerName}
              onPick={(letter) => {
                addPlayer(letter, selectedTeamId).then((p) => p && setSelectedPlayerId(p.id));
              }}
              onSubmit={() => {
                addPlayer(newPlayerName, selectedTeamId).then((p) => p && setSelectedPlayerId(p.id));
              }}
              error={addPlayerError}
            />
          )}

          {selectedPlayerId && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => recordEvent("FT", true)} className="text-sm bg-green-600/20 text-green-400 rounded px-3 py-1.5">
                LF réussi
              </button>
              <button onClick={() => recordEvent("FT", false)} className="text-sm bg-red-600/20 text-red-400 rounded px-3 py-1.5">
                LF raté
              </button>
              <button onClick={() => recordEvent("REB", true)} className="text-sm bg-white/10 text-white/80 rounded px-3 py-1.5">
                Rebond
              </button>
              <button onClick={() => recordEvent("AST", true)} className="text-sm bg-white/10 text-white/80 rounded px-3 py-1.5">
                Passe déc.
              </button>
            </div>
          )}

          {!selectedPlayerId && (
            <p className="text-xs text-white/40 mb-2">
              Tape le terrain pour un tir, ou choisis un joueur pour un LF/rebond/passe.
            </p>
          )}
        </>
      )}

      {/* Slide d'attribution -- étapes 2 à 4 (équipe / shooteur / passeur),
          l'étape 1 (réussi/raté) est la bulle flottante sur le terrain
          juste en dessous. */}
      {shotStage === "team" && (
        <div className="mb-4 p-3 border border-bsh-orange/30 rounded-lg bg-white/5">
          <p className="text-sm text-white/70 mb-2">
            Tir {shotMade ? "réussi" : "raté"} -- quelle équipe ?
          </p>
          <div className="flex gap-2">
            {[homeTeam, awayTeam].map((t) => (
              <button
                key={t.id}
                onClick={() => chooseShotTeam(t.id)}
                className="flex-1 bg-white/10 hover:bg-bsh-orange hover:text-black rounded-lg py-3 font-bold text-sm transition-colors"
              >
                {t.name}
              </button>
            ))}
          </div>
          <button onClick={cancelShotWizard} className="text-xs text-white/40 mt-2">
            annuler
          </button>
        </div>
      )}

      {shotStage === "shooter" && (
        <div className="mb-4 p-3 border border-bsh-orange/30 rounded-lg bg-white/5">
          <p className="text-sm text-white/70 mb-2">Qui a {shotMade ? "marqué" : "tenté"} le tir ?</p>
          <div className="flex flex-wrap gap-1.5">
            {rosterFor(shotTeamId).map((p) => (
              <button
                key={p.id}
                onClick={() => chooseShooter(p.id)}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white/80 hover:bg-bsh-orange hover:text-black transition-colors"
              >
                #{p.jersey_number ?? "-"} {p.name}
              </button>
            ))}
            <button
              onClick={() => setAddingPlayer((v) => !v)}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/5 text-white/50 border border-dashed border-white/20 hover:bg-white/10"
            >
              + Joueur
            </button>
          </div>
          {addingPlayer && (
            <QuickAddPanel
              name={newPlayerName}
              onNameChange={setNewPlayerName}
              onPick={(letter) => {
                addPlayer(letter, shotTeamId).then((p) => p && chooseShooter(p.id));
              }}
              onSubmit={() => {
                addPlayer(newPlayerName, shotTeamId).then((p) => p && chooseShooter(p.id));
              }}
              error={addPlayerError}
            />
          )}
          <button onClick={cancelShotWizard} className="text-xs text-white/40 mt-2">
            annuler
          </button>
        </div>
      )}

      {shotStage === "assist" && (
        <div className="mb-4 p-3 border border-bsh-orange/30 rounded-lg bg-white/5">
          <p className="text-sm text-white/70 mb-2">Qui a fait la passe ?</p>
          <div className="flex flex-wrap gap-1.5">
            {rosterFor(shotTeamId)
              .filter((p) => p.id !== shotShooterId)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => finalizeShot(shotShooterId, p.id)}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/10 text-white/80 hover:bg-bsh-orange hover:text-black transition-colors"
                >
                  #{p.jersey_number ?? "-"} {p.name}
                </button>
              ))}
            <button
              onClick={() => finalizeShot(shotShooterId)}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/5 text-white/50 border border-dashed border-white/20 hover:bg-white/10"
            >
              Pas de passe
            </button>
          </div>
        </div>
      )}

      {/* Court diagram */}
      <div className="max-w-md relative mb-8">
        <CourtDiagram shots={courtShots} onCourtClick={handleCourtClick} />

        {shotStage === "made_miss" && pendingShot && (
          <div
            className="absolute bg-bsh-black border border-bsh-orange rounded-lg p-2 flex flex-col gap-1 shadow-xl z-10"
            style={{
              left: `${pendingShot.x}%`,
              top: `${pendingShot.y}%`,
              transform: "translate(-50%, 8px)",
            }}
          >
            <p className="text-xs text-bsh-gold font-bold text-center mb-1">{guess}</p>
            <div className="flex gap-1">
              <button
                onClick={() => chooseMadeMiss(true)}
                className="text-xs px-3 py-1.5 rounded bg-green-600 text-white font-bold"
              >
                Réussi ✓
              </button>
              <button
                onClick={() => chooseMadeMiss(false)}
                className="text-xs px-3 py-1.5 rounded bg-red-600/80 text-white font-bold"
              >
                Raté ✗
              </button>
            </div>
            <button onClick={cancelShotWizard} className="text-xs text-white/40">
              annuler
            </button>
          </div>
        )}
      </div>

      {/* Box score live */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Box score en direct</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/20 text-white/50 uppercase">
                <th className="py-2 pr-2">Joueur</th>
                <th className="py-2 px-1 text-center">PTS</th>
                <th className="py-2 px-1 text-center">REB</th>
                <th className="py-2 px-1 text-center">AST</th>
                <th className="py-2 px-1 text-center">FG</th>
                <th className="py-2 px-1 text-center">LF</th>
              </tr>
            </thead>
            <tbody>
              {allPlayers
                .filter((p) => box[p.id])
                .map((p) => {
                  const b = box[p.id];
                  return (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="py-2 pr-2 whitespace-nowrap">#{p.jersey_number ?? "-"} {p.name}</td>
                      <td className="py-1 px-1 text-center text-bsh-orange font-bold">{b.pts}</td>
                      <td className="py-1 px-1 text-center">{b.reb}</td>
                      <td className="py-1 px-1 text-center">{b.ast}</td>
                      <td className="py-1 px-1 text-center">{b.fgm}/{b.fga}</td>
                      <td className="py-1 px-1 text-center">{b.ftm}/{b.fta}</td>
                    </tr>
                  );
                })}
              {allPlayers.filter((p) => box[p.id]).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-white/50">Aucune action enregistrée pour l&apos;instant.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
