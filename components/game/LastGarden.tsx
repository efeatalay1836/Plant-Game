"use client";

/* ============================================================
   THE LAST GARDEN — game interface.
   All game state lives in one object so that swapping the source
   from local memory to Supabase later is a contained change.
   ============================================================ */

import { useState, useCallback, type ReactNode } from "react";
import {
  applyAction, drawSpecies, earnedBonuses, effectiveDecay, endRound as engineEndRound,
  eventShield, neighboursOf, newGame, newPlayer, plantScore, seasonOfRound, totalScore,
  validateAction, type GameState, type Player, type Plant,
} from "@/lib/game/engine";
import { runAllAI } from "@/lib/game/ai";
import HowToPlay from "@/components/tutorial/HowToPlay";
import {
  ACTIONS, EVENTS, NEIGHBOURS, SEASON_OF_ROUND, SEASONS, SPECIES,
  TOTAL_ROUNDS, type ActionType, type SpeciesCode,
} from "@/lib/game/rules";

/* ---------------- artwork ---------------- */

const GLYPHS: Record<SpeciesCode, string> = {
  sunflower: '<circle cx="12" cy="9" r="3"/><path d="M12 12v9"/><path d="M12 6V3M15 7l2-2M9 7 7 5M16 9h3M5 9h3M15 11l2 2M9 11l-2 2"/>',
  cactus: '<path d="M10 21V7a2 2 0 1 1 4 0v14"/><path d="M10 13H8a2 2 0 0 1-2-2v-1"/><path d="M14 11h2a2 2 0 0 0 2-2V8"/>',
  monstera: '<path d="M12 21v-7"/><path d="M12 14c5 0 8-3 8-8-5 0-8 3-8 8Z"/><path d="M15 7.5 12 11M18 9l-4 2.5"/>',
  rose: '<path d="M12 21v-7"/><circle cx="12" cy="8" r="3.2"/><path d="M12 5.5a2 2 0 0 1 0 5 2 2 0 0 1 0-5Z"/><path d="M9 16c-2 0-3.5-1.4-3.5-3 2 0 3.5 1.4 3.5 3Z"/>',
  moss: '<path d="M5 18c0-3 2-5 4-5s2 2 3 2 1-2 3-2 4 2 4 5Z"/><path d="M8 13v-2M16 13v-3M12 15v-3"/>',
};

const ACTION_ICONS: Record<ActionType, string> = {
  water: '<path d="M12 3s6 6.4 6 10.3A6 6 0 0 1 6 13.3C6 9.4 12 3 12 3Z"/>',
  weed: '<path d="M12 21V9"/><path d="M12 13 7 8M12 13l5-5"/><path d="M5 21h14"/>',
  fertilize: '<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M12 12v4M10 14h4"/>',
  shelter: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  plant: '<path d="M12 20c0-5 3-9 8-10-1 6-4 9-8 10Z"/><path d="M12 20c0-4-2.5-7.5-7-8.5.8 5 3.5 7.8 7 8.5Z"/><path d="M12 20v-4"/>',
};

const SEASON_ICONS: Record<string, string> = {
  spring: '<path d="M12 20v-8"/><path d="M12 12c4 0 6-2 6-6-4 0-6 2-6 6Z"/><path d="M12 14c-3 0-5-1.5-5-5 3 0 5 1.5 5 5Z"/>',
  summer: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  autumn: '<path d="M17 4c-6 0-11 4-11 10 0 2 1 4 1 4s8-1 11-6c2-3 1-8-1-8Z"/><path d="M6 18 10 13"/>',
  winter: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>',
};

const AURA_ICON: Record<string, string> = {
  parch: '<path d="M12 3s6 6.4 6 10.3A6 6 0 0 1 6 13.3C6 9.4 12 3 12 3Z"/><path d="M4 4l16 16"/>',
  damp: '<path d="M12 3s6 6.4 6 10.3A6 6 0 0 1 6 13.3C6 9.4 12 3 12 3Z"/>',
  shade: '<path d="M12 14c5 0 8-3 8-8-5 0-8 3-8 8Z"/>',
  lure: '<circle cx="12" cy="13" r="5"/><path d="M12 8V5M8 10 5 7M16 10l3-3"/>',
};
const AURA_COLOUR: Record<string, string> = {
  parch: "#D94F3D", damp: "#6EC6E8", shade: "#7FD36B", lure: "#D94F3D",
};

const SEAT_COLOURS = ["#7FD36B", "#F2B544", "#6EC6E8", "#D98FC0"];
const AI_NAMES = ["Nadia", "Bram", "Ilse", "Teo", "Roos", "Kai"];

function Icon({ path, stroke = "currentColor", className = "tlg-glyph" }: {
  path: string; stroke?: string; className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: path }} />
  );
}

/* ---------------- lobby ---------------- */

interface Seat { name: string; isAI: boolean; isYou: boolean }

function Lobby({ onStart }: {
  onStart: (name: string, seats: Seat[], visibility: "open" | "private") => void;
}) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"open" | "private">("open");
  const [seats, setSeats] = useState<Seat[]>([
    { name: "", isAI: false, isYou: true },
    { name: "Nadia", isAI: true, isYou: false },
  ]);

  const addSeat = (isAI: boolean) => {
    if (seats.length >= 4) return;
    const used = seats.map((s) => s.name);
    const seatName = isAI
      ? AI_NAMES.find((n) => !used.includes(n)) ?? "Agent"
      : `Player ${seats.length + 1}`;
    setSeats([...seats, { name: seatName, isAI, isYou: false }]);
  };

  return (
    <div className="tlg-lobby">
      <h1 className="tlg-wordmark"><span className="the">The</span>Last Garden</h1>
      <p className="tlg-tagline">One reservoir. Four gardens. Eight rounds until winter.</p>
      <HowToPlay />

      <div className="tlg-card">
        <div className="tlg-field">
          <label htmlFor="tlg-name">Your name</label>
          <input id="tlg-name" type="text" maxLength={18} value={name}
            placeholder="Type a name to join"
            onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="tlg-field">
          <label>Who can see the gardens</label>
          <div className="tlg-choices">
            <button type="button" className="tlg-choice" aria-pressed={visibility === "open"}
              onClick={() => setVisibility("open")}>
              <b>Open</b><span>Everyone sees every garden. Tokens stay hidden.</span>
            </button>
            <button type="button" className="tlg-choice" aria-pressed={visibility === "private"}
              onClick={() => setVisibility("private")}>
              <b>Private</b><span>You see only your own garden. Play blind.</span>
            </button>
          </div>
        </div>

        <div className="tlg-field" style={{ marginBottom: 6 }}>
          <label>Gardeners</label>
          <div className="tlg-seats">
            {seats.map((s, i) => (
              <div className="tlg-seat" key={i}>
                <span className="tlg-seat-n">{i + 1}</span>
                <span className="tlg-seat-name">{s.isYou ? (name || "You") : s.name}</span>
                <span className="tlg-seat-kind">{s.isAI ? "AI" : "Human"}</span>
                {!s.isYou && (
                  <button type="button"
                    onClick={() => setSeats(seats.filter((_, j) => j !== i))}>Remove</button>
                )}
              </div>
            ))}
          </div>
          <div className="tlg-add-row">
            <button type="button" className="tlg-ghost" disabled={seats.length >= 4}
              onClick={() => addSeat(false)}>Add a player</button>
            <button type="button" className="tlg-ghost" disabled={seats.length >= 4}
              onClick={() => addSeat(true)}>Add an AI gardener</button>
          </div>
        </div>

        <button className="tlg-primary" disabled={!name.trim() || seats.length < 2}
          onClick={() => onStart(name.trim(), seats, visibility)}>Start the game</button>

        <p className="tlg-rules-peek">
          <b>Four plants, three tokens.</b> You cannot tend everything.<br />
          <b>One reservoir, shared.</b> Water costs the pool — and it refills less as winter closes in.<br />
          <b>Neighbours matter.</b> A Sunflower parches the plots beside it; Moss keeps them damp.
        </p>
      </div>
    </div>
  );
}

/* ---------------- plot ---------------- */

function PlotCell({ player, index, targetable, selected, isNeighbour, flash, onClick }: {
  player: Player; index: number; targetable: boolean; selected: boolean;
  isNeighbour: boolean; flash?: string; onClick: () => void;
}) {
  const plant = player.plots[index];
  const classes = ["tlg-plot"];
  if (!plant) classes.push("empty");
  if (targetable) classes.push("targetable", "clickable");
  else if (plant) classes.push("clickable");
  if (selected) classes.push("selected");
  if (isNeighbour) classes.push("neighbour");
  if (flash) classes.push(flash);

  if (!plant) {
    return (
      <div className={classes.join(" ")} onClick={onClick} tabIndex={targetable ? 0 : -1}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}>
        <Icon path='<path d="M4 17h16M7 17v-3M12 17v-5M17 17v-2"/>' stroke="rgba(232,239,228,.5)" />
      </div>
    );
  }

  const species = SPECIES[plant.species];
  const stroke = plant.stage === "bloom" ? "var(--bloom)" : plant.health <= 1 ? "var(--alarm)" : "var(--leaf)";
  const decay = effectiveDecay(player, index);

  return (
    <div className={classes.join(" ")} onClick={onClick} tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}>
      <Icon path={GLYPHS[plant.species]} stroke={stroke} />
      <span className="tlg-plant-name">{species.name}</span>
      <span className={`tlg-stage-tag ${plant.stage}`}>{plant.stage}</span>
      <span className="tlg-health">
        {[0, 1, 2, 3, 4].map((h) => (
          <span key={h} className={`tlg-hp ${h < plant.health ? (plant.health <= 1 ? "low" : "on") : ""}`} />
        ))}
      </span>
      <span className="tlg-badges">
        {plant.pest && (
          <span className="tlg-badge pest" title="Infested">
            <Icon className="" path='<circle cx="12" cy="13" r="5"/><path d="M12 8V5M8 10 5 7M16 10l3-3"/>' stroke="#fff" />
          </span>
        )}
        {plant.sheltered && (
          <span className="tlg-badge shield" title="Sheltered this round">
            <Icon className="" path='<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6Z"/>' />
          </span>
        )}
        {decay > species.decay && (
          <span className="tlg-badge dry" title="Parched by a neighbour">
            <Icon className="" path='<path d="M5 5l14 14M12 3s6 6.4 6 10.3A6 6 0 0 1 8 17"/>' stroke="#F0B3A8" />
          </span>
        )}
        {decay < species.decay && (
          <span className="tlg-badge moist" title="Kept damp by a neighbour">
            <Icon className="" path='<path d="M12 3s6 6.4 6 10.3A6 6 0 0 1 6 13.3C6 9.4 12 3 12 3Z"/>' stroke="#CDEAF7" />
          </span>
        )}
      </span>
      {species.aura && (
        <span className="tlg-aura-tag" title={species.auraText}>
          <Icon className="" path={AURA_ICON[species.aura]} stroke={AURA_COLOUR[species.aura]} />
        </span>
      )}
    </div>
  );
}

/* ---------------- garden ---------------- */

function Garden({ player, compact, blurred, selectedAction, canTarget, inspect, flashes, onPlotClick, rail }: {
  player: Player; compact: boolean; blurred: boolean; rail?: ReactNode;
  selectedAction: ActionType | null; canTarget: boolean;
  inspect: { seat: number; idx: number } | null;
  flashes: Record<string, string>;
  onPlotClick: (player: Player, index: number) => void;
}) {
  const classes = ["tlg-garden"];
  if (player.isYou) classes.push("you");
  if (compact) classes.push("compact");
  if (blurred) classes.push("blurred");

  const targetableAt = (index: number) => {
    if (!player.isYou || !selectedAction || !canTarget) return false;
    const plant = player.plots[index];
    if (selectedAction === "plant") return !plant;
    if (selectedAction === "weed") return !!plant && plant.pest;
    return !!plant;
  };

  return (
    <section className={classes.join(" ")}>
      <div className="tlg-gardener">
        <div className={`tlg-avatar ${player.isAI ? "ai" : ""}`}>
          {player.isAI
            ? <Icon className="" path='<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V4M9 12h.01M15 12h.01M9 16h6"/>' stroke="#F2B544" />
            : <Icon className="" path='<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>' />}
        </div>
        <div>
          <h2 className="tlg-gardener-name">{player.isYou ? "Your garden" : `${player.name}'s garden`}</h2>
          <p className="tlg-gardener-sub">Seat {player.seat}{player.isAI ? " · AI" : ""}</p>
        </div>
        <div className="tlg-score-chip"><b>{totalScore(player)}</b><span>points</span></div>
      </div>

      <div className={`tlg-tokens ${player.isYou ? "" : "concealed"}`}>
        <span className="tlg-tokens-label">Tokens</span>
        <div className="tlg-token-dots">
          {player.isYou
            ? [0, 1, 2].map((i) => <span key={i} className={`tlg-tok ${i < 3 - player.tokens ? "spent" : ""}`} />)
            : "? ? ?"}
        </div>
      </div>

      {rail}

      <div className="tlg-plots">
        {player.plots.map((_, i) => (
          <PlotCell key={i} player={player} index={i}
            targetable={targetableAt(i)}
            selected={inspect?.seat === player.seat && inspect?.idx === i}
            isNeighbour={
              inspect?.seat === player.seat && inspect !== null &&
              NEIGHBOURS[inspect.idx].includes(i)
            }
            flash={flashes[`${player.seat}-${i}`]}
            onClick={() => onPlotClick(player, i)} />
        ))}
      </div>
    </section>
  );
}

/* ---------------- inspector ---------------- */

function Inspector({ state, inspect }: {
  state: GameState; inspect: { seat: number; idx: number } | null;
}) {
  if (!inspect) {
    return <div className="tlg-inspector empty">
      Click any plant to inspect it, and to see what its neighbours are doing to it.
    </div>;
  }
  const player = state.players.find((p) => p.seat === inspect.seat);
  const plant = player?.plots[inspect.idx];
  if (!player || !plant) {
    return <div className="tlg-inspector empty">
      Click any plant to inspect it, and to see what its neighbours are doing to it.
    </div>;
  }

  const species = SPECIES[plant.species];
  const stroke = plant.stage === "bloom" ? "var(--bloom)" : plant.health <= 1 ? "var(--alarm)" : "var(--leaf)";
  const decay = effectiveDecay(player, inspect.idx);
  const shaded = eventShield(player, inspect.idx);
  const atMax = plant.stage === species.maxStage;
  const needs = Math.max(0, species.toLevel - plant.streak);
  const auraNeighbours = neighboursOf(player, inspect.idx).filter((nb) => SPECIES[nb.species].aura);

  const auraPhrase = (nb: Plant) => {
    const a = SPECIES[nb.species].aura;
    if (a === "parch") return { text: "dries it 1 faster", cls: "tlg-warn" };
    if (a === "damp") return { text: "keeps it damp, 1 slower", cls: "tlg-good" };
    if (a === "shade") return { text: "shields it from 1 event damage", cls: "tlg-good" };
    return { text: "draws pests to it", cls: "tlg-warn" };
  };

  return (
    <div className="tlg-inspector">
      <div className="tlg-insp-head">
        <Icon path={GLYPHS[plant.species]} stroke={stroke} />
        <div>
          <h3 className="tlg-insp-title">{species.name}</h3>
          <p className="tlg-insp-sub">
            {player.isYou ? "Your garden" : `${player.name}'s garden`} · plot {inspect.idx + 1}
          </p>
        </div>
      </div>
      <p className="tlg-insp-desc">{species.blurb}</p>

      <div className="tlg-stat-row"><span>Health</span>
        <span className={plant.health <= 1 ? "tlg-warn" : ""}>{plant.health} of 5</span></div>
      <div className="tlg-stat-row"><span>Stage</span>
        <span>{plant.stage}{atMax ? " · highest" : ""}</span></div>
      <div className="tlg-stat-row"><span>Worth now</span>
        <span>{plantScore(plant)} points</span></div>
      <div className="tlg-stat-row"><span>Dries at</span>
        <span className={decay > species.decay ? "tlg-warn" : decay < species.decay ? "tlg-cool" : ""}>
          {decay} per dry round{decay !== species.decay ? ` (base ${species.decay})` : ""}
        </span></div>
      <div className="tlg-stat-row"><span>Pests</span>
        <span className={species.pest > 1 ? "tlg-warn" : species.pest === 0 ? "tlg-good" : ""}>
          {species.pest === 0 ? "immune" : species.pest > 1 ? "double damage" : "normal"}
        </span></div>
      {!atMax && (
        <div className="tlg-stat-row"><span>To next stage</span>
          <span>{plant.health === 5 ? `${needs} more full round${needs === 1 ? "" : "s"}` : "needs full health"}</span></div>
      )}

      <p className="tlg-insp-section">ITS OWN EFFECT</p>
      <div className="tlg-stat-row" style={{ border: "none" }}>
        <span style={{ color: "var(--parchment)" }}>{species.auraText}</span>
      </div>

      {auraNeighbours.length > 0 && (
        <>
          <p className="tlg-insp-section">FROM ITS NEIGHBOURS</p>
          {auraNeighbours.map((nb, i) => {
            const phrase = auraPhrase(nb);
            return (
              <div className="tlg-stat-row" key={i}>
                <span>{SPECIES[nb.species].name}</span>
                <span className={phrase.cls}>{phrase.text}</span>
              </div>
            );
          })}
        </>
      )}
      {shaded > 0 && (
        <div className="tlg-stat-row"><span>Sheltered by canopy</span>
          <span className="tlg-good">−1 event damage</span></div>
      )}
      {plant.pest && (
        <div className="tlg-stat-row"><span>Infested</span>
          <span className="tlg-warn">weed it to clear</span></div>
      )}
    </div>
  );
}

/* ---------------- results ---------------- */

function Results({ state, onReplay }: { state: GameState; onReplay: () => void }) {
  const ranked = [...state.players].sort((a, b) => totalScore(b) - totalScore(a));
  const top = ranked[0];

  return (
    <div className="tlg-results">
      <h1 className="tlg-winner-line">
        {top.isAI || !top.isYou ? `${top.name}'s garden endured.` : "Your garden endured."}
      </h1>
      <p className="tlg-winner-sub">{totalScore(top)} points after eight rounds.</p>

      <div className="tlg-card">
        {ranked.map((player, n) => {
          const alive = player.plots.filter((p): p is Plant => !!p);
          const bonuses = earnedBonuses(player);
          return (
            <div className={`tlg-result-row ${n === 0 ? "champion" : ""}`} key={player.id}>
              <span className="tlg-rank">{n + 1}</span>
              <span className="tlg-result-name">
                <b>{player.isYou ? "You" : player.name}{player.isAI ? " · AI" : ""}</b>
                <span className="tlg-result-breakdown">
                  {alive.length
                    ? alive.map((p) => `${SPECIES[p.species].name} (${p.stage}, ${plantScore(p)})`).join(" · ")
                    : "Nothing survived."}
                  {bonuses.length > 0 && (
                    <><br /><span className="tlg-bonus-line">
                      {bonuses.map((b) => `${b.label} +${b.value}`).join(" · ")}
                    </span></>
                  )}
                </span>
              </span>
              <span className="tlg-result-score">{totalScore(player)}</span>
            </div>
          );
        })}
      </div>

      <button className="tlg-primary" onClick={onReplay}>Play again</button>
    </div>
  );
}

/* ---------------- main ---------------- */

export default function LastGarden() {
  const [state, setState] = useState<GameState | null>(null);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [inspect, setInspect] = useState<{ seat: number; idx: number } | null>(null);
  const [drawnSeed, setDrawnSeed] = useState<SpeciesCode | null>(null);
  const [message, setMessage] = useState("Pick an action, then choose a plot.");
  const [flashes, setFlashes] = useState<Record<string, string>>({});
  const [flipping, setFlipping] = useState(false);

  const start = useCallback((name: string, seats: Seat[], visibility: "open" | "private") => {
    const players = seats.map((s, i) =>
      newPlayer(`p${i + 1}`, s.isYou ? name : s.name, s.isAI, i + 1));
    players.forEach((p, i) => { p.isYou = seats[i].isYou; });
    const game = newGame(players, visibility);
    setState(game);
    setMessage(`Spring begins. ${EVENTS[game.eventCode].name} — ${EVENTS[game.eventCode].text}`);
  }, []);

  const flash = (seat: number, idx: number, kind: string) => {
    const key = `${seat}-${idx}`;
    setFlashes((f) => ({ ...f, [key]: kind }));
    setTimeout(() => setFlashes((f) => {
      const next = { ...f };
      delete next[key];
      return next;
    }), 700);
  };

  if (!state) return <div className="tlg"><Lobby onStart={start} /></div>;
  if (state.finished) {
    return <div className="tlg">
      <Results state={state} onReplay={() => { setState(null); setInspect(null); }} />
    </div>;
  }

  const you = state.players.find((p) => p.isYou)!;
  const opponents = state.players.filter((p) => p !== you);
  const season = seasonOfRound(state.round);
  const nextSeasonCode = SEASON_OF_ROUND[state.round] ?? null;
  const showsNextSeason = nextSeasonCode && nextSeasonCode !== season.code;
  const event = EVENTS[state.eventCode];
  const refill = season.refillPerPlayer * state.players.length;
  const low = state.reservoir <= state.players.length;

  const handlePlotClick = (player: Player, index: number) => {
    // Acting on your own garden takes priority; otherwise it is an inspection.
    if (player === you && selectedAction) {
      const species = selectedAction === "plant" ? (drawnSeed ?? drawSpecies()) : undefined;
      const request = { playerId: you.id, action: selectedAction, plot: index, species };
      const problem = validateAction(state, request);
      if (problem) { setMessage(problem); return; }

      setState(applyAction(state, request));
      flash(player.seat, index, "grew");
      setSelectedAction(null);
      if (selectedAction === "plant") { setDrawnSeed(null); }
      const name = species ? SPECIES[species].name : SPECIES[player.plots[index]!.species].name;
      setMessage(`${ACTIONS.find((a) => a.id === selectedAction)!.label} — ${name}.`);
    }
    setInspect({ seat: player.seat, idx: index });
  };

  const handleEndRound = () => {
    let next = runAllAI(state);
    const result = engineEndRound(next);
    for (const note of result.notes) {
      const player = state.players.find((p) => p.id === note.playerId);
      if (player === you) flash(player.seat, note.plot, note.kind === "grew" ? "grew" : "hurt");
    }
    setFlipping(true);
    setTimeout(() => setFlipping(false), 520);
    setState(result.state);
    setSelectedAction(null);
    if (!result.state.finished) {
      const s = seasonOfRound(result.state.round);
      const changed = SEASON_OF_ROUND[result.state.round - 2] !== SEASON_OF_ROUND[result.state.round - 1];
      setMessage(`${changed ? `${s.name} arrives. ` : ""}Round ${result.state.round}. ${EVENTS[result.state.eventCode].name} — ${EVENTS[result.state.eventCode].text}`);
    }
  };

  const actionRail = (
      <div className="tlg-rail">
        {ACTIONS.map((a) => {
          const disabled = you.tokens < a.tokens || state.reservoir < a.water;
          return (
            <button key={a.id} className="tlg-act" type="button" title={a.hint}
              aria-pressed={selectedAction === a.id} disabled={disabled}
              onClick={() => {
                const next = selectedAction === a.id ? null : a.id;
                setSelectedAction(next);
                if (next === "plant" && !drawnSeed) setDrawnSeed(drawSpecies());
                if (next) setMessage(`${a.label} — ${a.hint}. Choose a plot.`);
              }}>
              <Icon className="" path={ACTION_ICONS[a.id]} />
              {a.label}
              <span className="tlg-cost">
                {Array.from({ length: a.tokens }, (_, i) => <i key={i} />)}
                {a.water > 0 && <u />}
              </span>
            </button>
          );
        })}
      </div>
  );

  const petals = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const cx = 100 + Math.cos(a) * 70;
    const cy = 118 + Math.sin(a) * 84;
    return <ellipse key={i} cx={cx} cy={cy} rx="13" ry="27"
      transform={`rotate(${(a * 180) / Math.PI + 90} ${cx} ${cy})`} />;
  });

  return (
    <div className="tlg">
      <header className="tlg-masthead">
        <h1 className="tlg-mini-mark">The Last Garden</h1>
        <div className="tlg-season-strip">
          <span className="tlg-season-chip">
            <Icon className="" path={SEASON_ICONS[season.code]} stroke="var(--bloom)" />
            <span>{season.name} · round {state.round} of {TOTAL_ROUNDS}</span>
          </span>
          {showsNextSeason && (
            <span className="tlg-season-chip next">
              <Icon className="" path={SEASON_ICONS[nextSeasonCode!]} stroke="var(--muted)" />
              <span>{SEASONS[nextSeasonCode!].name} next</span>
            </span>
          )}
          <div className="tlg-pips">
            {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
              <span key={i} className={`tlg-pip ${i + 1 < state.round ? "done" : i + 1 === state.round ? "now" : ""}`} />
            ))}
          </div>
        </div>
      </header>

      <main className="tlg-board">
        <Garden player={you} compact={false} blurred={false}
          selectedAction={selectedAction} canTarget rail={actionRail}
          inspect={inspect} flashes={flashes} onPlotClick={handlePlotClick} />

        <div className="tlg-centre">
          <div className="tlg-reservoir">
            <div className="tlg-res-head">
              <h3>Reservoir</h3>
              <span className={`tlg-res-amount ${low ? "low" : ""}`}>{state.reservoir}</span>
            </div>
            <div className="tlg-res-bar">
              <div className={`tlg-res-fill ${low ? "low" : ""}`}
                style={{ width: `${Math.max(0, Math.min(100, (state.reservoir / state.reservoirMax) * 100))}%` }} />
            </div>
            <p className="tlg-res-note">
              Shared by every garden. Refills <b>+{refill}</b> at the end of this round.
              {low && <span className="tlg-warn"> Running dry.</span>}
            </p>
          </div>

          <div className="tlg-deck">
            <p className="tlg-deck-title">Seeds</p>
            <div className="tlg-seed-stack" role="button" tabIndex={0}
              onClick={() => {
                const s = drawSpecies();
                setDrawnSeed(s);
                setMessage(`You drew a ${SPECIES[s].name}. ${SPECIES[s].auraText} Choose an empty plot.`);
              }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDrawnSeed(drawSpecies()); } }}>
              <Icon className="" path='<path d="M12 20c0-5 3-9 8-10-1 6-4 9-8 10Z"/><path d="M12 20c0-4-2.5-7.5-7-8.5.8 5 3.5 7.8 7 8.5Z"/><path d="M12 20v-4"/>' stroke="#CFE8C2" />
            </div>
            <p className="tlg-deck-hint">{drawnSeed ? `${SPECIES[drawnSeed].name} ready` : "Click to draw"}</p>
          </div>

          <div className="tlg-deck tlg-event-frame">
            <svg className="tlg-sunflower" viewBox="0 0 200 240" aria-hidden="true">
              <g fill="none" stroke="rgba(242,181,68,.2)" strokeWidth="1.3">{petals}</g>
            </svg>
            <p className="tlg-deck-title">Events</p>
            <div className={`tlg-event-card ${event.bad ? "negative" : ""} ${flipping ? "flipping" : ""}`}>
              <Icon className="tlg-event-icon"
                path={event.bad
                  ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
                  : '<path d="M12 3s6 6.4 6 10.3A6 6 0 0 1 6 13.3C6 9.4 12 3 12 3Z"/>'}
                stroke={event.bad ? "#D94F3D" : "#7FD36B"} />
              <h3 className="tlg-event-name">{event.name}</h3>
              <p className="tlg-event-text">{event.text}</p>
            </div>
          </div>

          <div className="tlg-standings">
            <h3>Standings</h3>
            {[...state.players].sort((a, b) => totalScore(b) - totalScore(a)).map((p, i) => (
              <div className={`tlg-stand-row ${p === you ? "you" : ""}`} key={p.id}>
                <span className="tlg-dot" style={{ background: SEAT_COLOURS[p.seat - 1] }} />
                <span className="nm">{p === you ? "You" : p.name}</span>
                <span className="sc">{totalScore(p)}</span>
              </div>
            ))}
          </div>

          <Inspector state={state} inspect={inspect} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(9px,1.2vw,15px)" }}>
          {opponents.map((p) => (
            <Garden key={p.id} player={p} compact blurred={state.visibility === "private"}
              selectedAction={null} canTarget={false}
              inspect={inspect} flashes={flashes} onPlotClick={handlePlotClick} />
          ))}
        </div>
      </main>

      <div className="tlg-turnbar">
        <p className="tlg-log">{message}</p>
        <button className="tlg-end-round" type="button" onClick={handleEndRound}>End round</button>
      </div>
    </div>
  );
}
