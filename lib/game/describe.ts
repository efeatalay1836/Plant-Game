// THE LAST GARDEN — turns the game state into plain text for an AI player.

import { effectiveDecay, eventShield, seasonOfRound, totalScore, type GameState } from "./engine";
import { EVENTS, MAX_HEALTH, PLOT_COUNT, SPECIES, TOTAL_ROUNDS } from "./rules";

export function describeState(state: GameState): string {
  const you = state.players.find((p) => p.isYou) ?? state.players[0];
  const season = seasonOfRound(state.round);
  const event = EVENTS[state.eventCode];
  const lines: string[] = [];
  lines.push(`ROUND ${state.round} of ${TOTAL_ROUNDS} (${season.name})`);
  lines.push(`This round's event: ${event.name}: ${event.text}`);
  lines.push(`Reservoir: ${state.reservoir} water (maximum ${state.reservoirMax}). Normal refill at the end of this round: +${season.refillPerPlayer * state.players.length}.`);
  lines.push(`Action tokens this round: ${you.tokens}`);
  lines.push("");
  lines.push("Garden (plots laid out 0 1 2 / 3 4 5):");
  for (let i = 0; i < PLOT_COUNT; i++) {
    const p = you.plots[i];
    if (!p) { lines.push(`Plot ${i}: empty`); continue; }
    const sp = SPECIES[p.species];
    const shade = eventShield(you, i) ? ", shaded by a neighbouring Monstera" : "";
    lines.push(`Plot ${i}: ${sp.name}, stage ${p.stage}, health ${p.health}/${MAX_HEALTH}, loses ${effectiveDecay(you, i)} health if left dry, full-health rounds toward next stage ${p.streak}/${sp.toLevel}, infested: ${p.pest ? "yes" : "no"}${shade}`);
  }
  lines.push("");
  lines.push(`Current score: ${totalScore(you)}`);
  return lines.join("\n");
}
