// THE LAST GARDEN — rules engine.
// Pure functions only: given a game state, return the next game state.
// Nothing here touches the database or the screen, so the same code can
// run a live game, replay a logged one, or simulate hundreds in a script.

import {
  ACTIONS, BONUSES, EVENTS, MAX_HEALTH, NEIGHBOURS, PLOT_COUNT,
  SEASONS, SEASON_OF_ROUND, SEED_DECK, SPECIES, STAGES, STAGE_SCORE,
  START_HEALTH, STARTING_PLANTS, TOKENS_PER_ROUND, TOTAL_ROUNDS,
  type ActionType, type SpeciesCode, type Stage,
} from "./rules";

export interface Plant {
  species: SpeciesCode;
  stage: Stage;
  health: number;
  pest: boolean;
  sheltered: boolean;
  watered: boolean;
  streak: number;      // consecutive rounds at full health
}

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  isYou: boolean;
  seat: number;
  tokens: number;
  plots: (Plant | null)[];
}

export interface GameState {
  round: number;
  reservoir: number;
  reservoirMax: number;
  eventCode: string;
  visibility: "open" | "private";
  players: Player[];
  finished: boolean;
}

/* ---------------- creation ---------------- */

export function drawSpecies(rng: () => number = Math.random): SpeciesCode {
  return SEED_DECK[Math.floor(rng() * SEED_DECK.length)];
}

export function newPlant(species: SpeciesCode): Plant {
  return {
    species, stage: "seed", health: START_HEALTH,
    pest: false, sheltered: false, watered: false, streak: 0,
  };
}

export function newPlayer(
  id: string, name: string, isAI: boolean, seat: number,
  rng: () => number = Math.random,
): Player {
  const plots: (Plant | null)[] = Array(PLOT_COUNT).fill(null);
  for (let i = 0; i < STARTING_PLANTS; i++) plots[i] = newPlant(drawSpecies(rng));
  return { id, name, isAI, isYou: false, seat, tokens: TOKENS_PER_ROUND, plots };
}

export function newGame(
  players: Player[], visibility: "open" | "private" = "open",
): GameState {
  const n = players.length;
  return {
    round: 1,
    reservoir: n * 4,
    reservoirMax: n * 6,
    eventCode: "sunny",
    visibility,
    players,
    finished: false,
  };
}

/* ---------------- adjacency ---------------- */

export function neighboursOf(player: Player, plot: number): Plant[] {
  return NEIGHBOURS[plot].map((j) => player.plots[j]).filter((p): p is Plant => !!p);
}

/** A plant's real thirst, after its neighbours have their say. */
export function effectiveDecay(player: Player, plot: number): number {
  const plant = player.plots[plot];
  if (!plant) return 0;
  let decay = SPECIES[plant.species].decay;
  for (const nb of neighboursOf(player, plot)) {
    const aura = SPECIES[nb.species].aura;
    if (aura === "parch") decay += 1;
    if (aura === "damp") decay -= 1;
  }
  return Math.max(0, decay);
}

/** 1 if any neighbouring Monstera is casting shade, otherwise 0. */
export function eventShield(player: Player, plot: number): number {
  return neighboursOf(player, plot).some((nb) => SPECIES[nb.species].aura === "shade") ? 1 : 0;
}

/* ---------------- scoring ---------------- */

export function plantScore(plant: Plant | null): number {
  if (!plant) return 0;
  return plant.stage === "bloom"
    ? SPECIES[plant.species].bloomScore
    : STAGE_SCORE[plant.stage];
}

export function earnedBonuses(player: Player) {
  const alive = player.plots.filter((p): p is Plant => !!p);
  const kinds = new Set(alive.map((p) => p.species));
  const out = [];
  if (kinds.size >= 5) out.push(BONUSES.find((b) => b.code === "five_species")!);
  else if (kinds.size >= 3) out.push(BONUSES.find((b) => b.code === "three_species")!);
  if (alive.length === PLOT_COUNT) out.push(BONUSES.find((b) => b.code === "full_garden")!);
  return out;
}

export function totalScore(player: Player): number {
  const plants = player.plots.reduce((sum, p) => sum + plantScore(p), 0);
  const bonus = earnedBonuses(player).reduce((sum, b) => sum + b.value, 0);
  return plants + bonus;
}

/* ---------------- legality ---------------- */

export interface ActionRequest {
  playerId: string;
  action: ActionType;
  plot: number;
  species?: SpeciesCode;   // only for "plant"
}

/** Returns null if the move is legal, or a reason string if it is not. */
export function validateAction(state: GameState, req: ActionRequest): string | null {
  const player = state.players.find((p) => p.id === req.playerId);
  if (!player) return "No such player.";
  if (state.finished) return "The game is over.";
  if (req.plot < 0 || req.plot >= PLOT_COUNT) return "That plot does not exist.";

  const cost = ACTIONS.find((a) => a.id === req.action);
  if (!cost) return "Unknown action.";
  if (player.tokens < cost.tokens) return "Not enough action tokens.";
  if (state.reservoir < cost.water) return "The reservoir is empty.";

  const plant = player.plots[req.plot];
  if (req.action === "plant") {
    if (plant) return "That plot is already planted.";
    if (!req.species) return "No seed drawn.";
  } else {
    if (!plant) return "There is nothing planted there.";
    if (req.action === "weed" && !plant.pest) return "Nothing to weed there.";
  }
  return null;
}

/* ---------------- applying an action ---------------- */

export function applyAction(state: GameState, req: ActionRequest): GameState {
  const problem = validateAction(state, req);
  if (problem) throw new Error(problem);

  const next = structuredClone(state);
  const player = next.players.find((p) => p.id === req.playerId)!;
  const cost = ACTIONS.find((a) => a.id === req.action)!;
  const plant = player.plots[req.plot];

  switch (req.action) {
    case "plant":
      player.plots[req.plot] = newPlant(req.species!);
      break;
    case "water":
      plant!.health = Math.min(MAX_HEALTH, plant!.health + 1);
      plant!.watered = true;
      break;
    case "fertilize":
      plant!.health = Math.min(MAX_HEALTH, plant!.health + 2);
      plant!.watered = true;
      plant!.streak += 1;
      break;
    case "shelter":
      plant!.sheltered = true;
      break;
    case "weed":
      plant!.pest = false;
      break;
  }

  player.tokens -= cost.tokens;
  next.reservoir -= cost.water;
  return next;
}

/* ---------------- events ---------------- */

export function seasonOfRound(round: number) {
  return SEASONS[SEASON_OF_ROUND[Math.min(round, TOTAL_ROUNDS) - 1]];
}

export function drawEvent(round: number, rng: () => number = Math.random): string {
  const pool = seasonOfRound(round).pool;
  return pool[Math.floor(rng() * pool.length)];
}

/** Events that act the moment they are revealed, before anyone acts. */
export function applyEventOnReveal(
  state: GameState, code: string, rng: () => number = Math.random,
): GameState {
  const next = structuredClone(state);
  next.eventCode = code;

  if (code === "pests") {
    for (const player of next.players) {
      const targets = player.plots
        .map((p, i) => ({ p, i }))
        .filter((x): x is { p: Plant; i: number } => !!x.p && SPECIES[x.p.species].pest > 0);
      if (!targets.length) continue;
      const hit = targets[Math.floor(rng() * targets.length)];
      hit.p.pest = true;
      // A Rose passes the infestation on to whatever grows beside it.
      if (SPECIES[hit.p.species].aura === "lure") {
        for (const j of NEIGHBOURS[hit.i]) {
          const nb = player.plots[j];
          if (nb && SPECIES[nb.species].pest > 0) nb.pest = true;
        }
      }
    }
  }

  if (code === "storm") {
    for (const player of next.players) {
      const grown = player.plots.filter((p): p is Plant => !!p && STAGES.indexOf(p.stage) > 0);
      if (!grown.length) continue;
      const hit = grown[Math.floor(rng() * grown.length)];
      hit.stage = STAGES[STAGES.indexOf(hit.stage) - 1];
    }
  }

  return next;
}

/* ---------------- upkeep ---------------- */

export interface UpkeepNote {
  playerId: string;
  plot: number;
  kind: "damaged" | "died" | "grew";
  detail: string;
}

/** Resolves decay, pests, the event, growth and death for every garden. */
export function resolveUpkeep(state: GameState): { state: GameState; notes: UpkeepNote[] } {
  const next = structuredClone(state);
  const notes: UpkeepNote[] = [];
  const event = next.eventCode;

  for (const player of next.players) {
    player.plots.forEach((plant, i) => {
      if (!plant) return;
      const species = SPECIES[plant.species];
      const before = plant.health;
      const shade = eventShield(player, i);

      if (!plant.watered && !plant.sheltered) plant.health -= effectiveDecay(player, i);
      if (plant.pest && !plant.sheltered) plant.health -= species.pest;

      if (!plant.sheltered) {
        let damage = 0;
        if (event === "drought" && !plant.watered) damage += 2;
        if (event === "heatwave" && !plant.watered && (plant.stage === "mature" || plant.stage === "bloom")) damage += 2;
        if (event === "frost" && (plant.stage === "seed" || plant.stage === "sprout")) damage += 2;
        if (event === "blight" && plant.pest) damage += 2;
        plant.health -= Math.max(0, damage - shade);
      }
      if (event === "rain") plant.health += 1;
      if (event === "sunny" && plant.watered) plant.health += 1;

      plant.health = Math.max(0, Math.min(MAX_HEALTH, plant.health));

      // Growth: full health for enough consecutive rounds advances a stage.
      if (plant.health === MAX_HEALTH) {
        plant.streak += 1;
        if (event === "bumper") plant.streak += 1;
      } else {
        plant.streak = 0;
      }
      const at = STAGES.indexOf(plant.stage);
      const ceiling = STAGES.indexOf(species.maxStage);
      if (plant.streak >= species.toLevel && at < ceiling) {
        plant.stage = STAGES[at + 1];
        plant.streak = 0;
        notes.push({ playerId: player.id, plot: i, kind: "grew", detail: `${species.name} reached ${plant.stage}` });
      }

      if (plant.health < before) {
        notes.push({ playerId: player.id, plot: i, kind: "damaged", detail: `${species.name} lost ${before - plant.health} health` });
      }

      plant.watered = false;
      plant.sheltered = false;

      if (plant.health === 0) {
        player.plots[i] = null;
        notes.push({ playerId: player.id, plot: i, kind: "died", detail: `${species.name} died` });
      }
    });
  }

  return { state: next, notes };
}

/* ---------------- round transition ---------------- */

export function refillReservoir(state: GameState): GameState {
  const next = structuredClone(state);
  const season = seasonOfRound(next.round);
  let add = season.refillPerPlayer * next.players.length;
  if (next.eventCode === "drought") add = Math.floor(add / 2);
  if (next.eventCode === "rain") add += next.players.length * 2;
  next.reservoir = Math.min(next.reservoirMax, next.reservoir + add);
  return next;
}

/** Ends the current round: upkeep, refill, then either advance or finish. */
export function endRound(
  state: GameState, rng: () => number = Math.random,
): { state: GameState; notes: UpkeepNote[] } {
  let { state: next, notes } = resolveUpkeep(state);
  next = refillReservoir(next);

  if (next.round >= TOTAL_ROUNDS) {
    next.finished = true;
    return { state: next, notes };
  }

  next.round += 1;
  for (const player of next.players) player.tokens = TOKENS_PER_ROUND;
  next = applyEventOnReveal(next, drawEvent(next.round, rng), rng);

  return { state: next, notes };
}

export { EVENTS, SPECIES, ACTIONS, SEASONS, NEIGHBOURS, STAGES };
