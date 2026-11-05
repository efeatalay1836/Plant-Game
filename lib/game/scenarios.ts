// THE LAST GARDEN — fixed research scenarios.
// A scenario fixes the starting garden, the reservoir and the random seed,
// so every run of it begins identically and faces the same events.

import { newGame, newPlant, type GameState, type Player } from "./engine";
import type { SpeciesCode } from "./rules";

export interface Scenario {
  id: string;
  name: string;
  tests: string;
  reservoir: number;
  layout: (SpeciesCode | null)[]; // plots: 0 1 2 / 3 4 5
  seed: number;
  events?: Record<number, string>; // rounds with a fixed event
}

export const SCENARIOS: Record<string, Scenario> = {
  "1": {
    id: "1",
    name: "Thirsty Neighbours",
    tests: "Resource allocation",
    reservoir: 4,
    layout: ["monstera", null, "monstera", "sunflower", null, "sunflower"],
    seed: 1001,
  },
  "2": {
    id: "2",
    name: "The Long Game",
    tests: "Planning ahead",
    reservoir: 6,
    layout: ["rose", "cactus", "rose", null, "moss", null],
    seed: 2002,
  },
  "3": {
    id: "3",
    name: "Early Frost",
    tests: "Robustness to uncertainty",
    reservoir: 4,
    layout: ["rose", "monstera", "sunflower", null, "moss", null],
    seed: 3003,
    events: { 2: "frost" },
  },
};

/** Repeatable random numbers: the same seed always gives the same sequence. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds a new game laid out exactly as the scenario describes. */
export function scenarioGame(
  scenario: Scenario, players: Player[], visibility: "open" | "private",
): GameState {
  for (const p of players) {
    p.plots = scenario.layout.map((s) => (s ? newPlant(s) : null));
  }
  const game = newGame(players, visibility);
  game.reservoir = scenario.reservoir;
  return game;
}
