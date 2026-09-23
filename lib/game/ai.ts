// Simple scripted opponents, so a single player has something to play against.
// These are NOT the research agent — that will be a separate, API-driven
// player. These exist only to make the board feel alive.

import {
  applyAction, effectiveDecay, plantScore, drawSpecies,
  type GameState, type Player, type ActionRequest,
} from "./engine";
import { ACTIONS, PLOT_COUNT, SPECIES, type SpeciesCode } from "./rules";

/** How urgently this plant needs attention: value at risk, weighted by danger. */
function urgency(player: Player, plot: number): number {
  const plant = player.plots[plot];
  if (!plant) return 0;
  const decay = effectiveDecay(player, plot);
  const roundsLeft = decay > 0 ? plant.health / decay : 99;
  const worth = plantScore(plant);
  const pestPenalty = plant.pest ? SPECIES[plant.species].pest * 2 : 0;
  return worth / Math.max(1, roundsLeft) + pestPenalty;
}

/** Prefers plots whose neighbours will not fight the new plant. */
function bestEmptyPlot(player: Player, species: SpeciesCode): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < PLOT_COUNT; i++) {
    if (player.plots[i]) continue;
    const trial: Player = structuredClone(player);
    trial.plots[i] = {
      species, stage: "seed", health: 3,
      pest: false, sheltered: false, watered: false, streak: 0,
    };
    // Lower decay is better, both for this plant and for those beside it.
    let score = -effectiveDecay(trial, i);
    for (let j = 0; j < PLOT_COUNT; j++) {
      if (j === i || !trial.plots[j]) continue;
      score -= effectiveDecay(trial, j) - effectiveDecay(player, j);
    }
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

/** Plays out one opponent's whole turn, returning the updated game state. */
export function takeAITurn(state: GameState, playerId: string): GameState {
  let next = state;

  for (let guard = 0; guard < 6; guard++) {
    const player = next.players.find((p) => p.id === playerId)!;
    if (player.tokens <= 0) break;

    const ranked = player.plots
      .map((plant, i) => ({ plant, i, score: urgency(player, i) }))
      .filter((x) => x.plant)
      .sort((a, b) => b.score - a.score);

    let move: ActionRequest | null = null;

    // 1. Clear pests on anything genuinely valuable.
    const infested = ranked.find((x) => x.plant!.pest && plantScore(x.plant!) >= 5);
    if (infested && player.tokens >= 1) {
      move = { playerId, action: "weed", plot: infested.i };
    }

    // 2. Water whatever is closest to dying.
    if (!move && next.reservoir >= 1) {
      const thirsty = ranked.find(
        (x) => x.plant!.health < 5 && effectiveDecay(player, x.i) > 0,
      );
      if (thirsty) {
        const canFertilise =
          player.tokens >= 2 && thirsty.plant!.health <= 3 && plantScore(thirsty.plant!) >= 5;
        move = {
          playerId,
          action: canFertilise ? "fertilize" : "water",
          plot: thirsty.i,
        };
      }
    }

    // 3. Otherwise fill an empty plot, placing it thoughtfully.
    if (!move && player.tokens >= 1) {
      const species = drawSpecies();
      const plot = bestEmptyPlot(player, species);
      if (plot >= 0) move = { playerId, action: "plant", plot, species };
    }

    if (!move) break;

    const cost = ACTIONS.find((a) => a.id === move!.action)!;
    if (player.tokens < cost.tokens || next.reservoir < cost.water) break;

    try {
      next = applyAction(next, move);
    } catch {
      break;
    }
  }

  return next;
}

/** Runs every AI player's turn in seat order. */
export function runAllAI(state: GameState): GameState {
  let next = state;
  for (const player of next.players.filter((p) => p.isAI)) {
    next = takeAITurn(next, player.id);
  }
  return next;
}
