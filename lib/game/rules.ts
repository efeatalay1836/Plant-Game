// THE LAST GARDEN — rule data.
// Everything that defines the game's numbers lives here, so balance
// changes never require touching the engine or the interface.

export type Stage = "seed" | "sprout" | "mature" | "bloom";
export type Aura = "parch" | "damp" | "shade" | "lure" | null;
export type SpeciesCode = "sunflower" | "cactus" | "monstera" | "rose" | "moss";
export type ActionType = "water" | "weed" | "fertilize" | "shelter" | "plant";
export type SeasonCode = "spring" | "summer" | "autumn" | "winter";

export const STAGES: Stage[] = ["seed", "sprout", "mature", "bloom"];
export const STAGE_SCORE: Record<Stage, number> = {
  seed: 1, sprout: 2, mature: 5, bloom: 10,
};

export interface Species {
  code: SpeciesCode;
  name: string;
  decay: number;        // health lost per dry round
  toLevel: number;      // rounds at full health needed to advance
  pest: number;         // 0 = immune, 2 = double damage
  maxStage: Stage;
  bloomScore: number;
  aura: Aura;
  auraText: string;
  blurb: string;
}

export const SPECIES: Record<SpeciesCode, Species> = {
  sunflower: {
    code: "sunflower", name: "Sunflower", decay: 1, toLevel: 2, pest: 1,
    maxStage: "bloom", bloomScore: 10, aura: "parch",
    auraText: "Parches neighbours — they dry 1 faster.",
    blurb: "Tall and greedy for light. Grows well anywhere, at its neighbours' expense.",
  },
  cactus: {
    code: "cactus", name: "Cactus", decay: 0, toLevel: 3, pest: 1,
    maxStage: "bloom", bloomScore: 7, aura: null,
    auraText: "No effect on neighbours.",
    blurb: "Never thirsts, never hurries, never bothers anyone. Pays out modestly.",
  },
  monstera: {
    code: "monstera", name: "Monstera", decay: 2, toLevel: 1, pest: 1,
    maxStage: "bloom", bloomScore: 10, aura: "shade",
    auraText: "Shades neighbours — they take 1 less event damage.",
    blurb: "Races through its stages and drinks twice as hard. Its canopy shelters what grows beside it.",
  },
  rose: {
    code: "rose", name: "Rose", decay: 1, toLevel: 2, pest: 2,
    maxStage: "bloom", bloomScore: 15, aura: "lure",
    auraText: "Lures pests onto neighbours as well as itself.",
    blurb: "The richest plant in the garden. Every pest for miles knows where it is.",
  },
  moss: {
    code: "moss", name: "Moss", decay: 1, toLevel: 2, pest: 0,
    maxStage: "mature", bloomScore: 5, aura: "damp",
    auraText: "Holds moisture — neighbours dry 1 slower.",
    blurb: "Worth little and never flowers, but everything around it survives longer.",
  },
};

// Weighted draw pile: Sunflowers are common, Roses rare.
export const SEED_DECK: SpeciesCode[] = [
  "sunflower", "sunflower", "sunflower",
  "cactus", "cactus",
  "monstera", "monstera",
  "moss", "moss",
  "rose",
];

// Plots form a 3x2 grid: 0 1 2 / 3 4 5. Neighbours are orthogonal only.
export const PLOT_COUNT = 6;
export const NEIGHBOURS: Record<number, number[]> = {
  0: [1, 3], 1: [0, 2, 4], 2: [1, 5],
  3: [0, 4], 4: [1, 3, 5], 5: [2, 4],
};

export const TOKENS_PER_ROUND = 3;
export const STARTING_PLANTS = 4;
export const TOTAL_ROUNDS = 8;
export const MAX_HEALTH = 5;
export const START_HEALTH = 3;

export interface ActionCost {
  id: ActionType;
  label: string;
  tokens: number;
  water: number;
  hint: string;
}

export const ACTIONS: ActionCost[] = [
  { id: "water",     label: "Water",     tokens: 1, water: 1, hint: "+1 health and counts as watered this round" },
  { id: "weed",      label: "Weed",      tokens: 1, water: 0, hint: "Clears an infestation" },
  { id: "fertilize", label: "Fertilise", tokens: 2, water: 1, hint: "+2 health, counts as watered, and adds a growth round" },
  { id: "shelter",   label: "Shelter",   tokens: 2, water: 0, hint: "Immune to this round's event and to decay" },
  { id: "plant",     label: "Plant",     tokens: 1, water: 0, hint: "Place a drawn seed in an empty plot" },
];

export interface GameEvent {
  code: string;
  name: string;
  text: string;
  bad: boolean;
}

export const EVENTS: Record<string, GameEvent> = {
  drought:  { code: "drought",  name: "Drought",        bad: true,  text: "Unwatered plants lose 2 extra health. Reservoir refill halved." },
  pests:    { code: "pests",    name: "Pests",          bad: true,  text: "A plot in every garden becomes infested. Roses spread it to neighbours." },
  frost:    { code: "frost",    name: "Frost",          bad: true,  text: "Seed and Sprout plants lose 2 health, watered or not." },
  storm:    { code: "storm",    name: "Storm",          bad: true,  text: "One plant in every garden drops a stage." },
  heatwave: { code: "heatwave", name: "Heatwave",       bad: true,  text: "Mature and Bloom plants lose 2 extra health if unwatered." },
  blight:   { code: "blight",   name: "Blight",         bad: true,  text: "Infested plants lose an extra 2 health this round." },
  sunny:    { code: "sunny",    name: "Sunny Spell",    bad: false, text: "Watered plants heal an extra point this round." },
  rain:     { code: "rain",     name: "Gentle Rain",    bad: false, text: "Every plant gains a point of health, and the reservoir swells." },
  bumper:   { code: "bumper",   name: "Bumper Growth",  bad: false, text: "Plants at full health gain a free round toward levelling up." },
};

export interface Season {
  code: SeasonCode;
  name: string;
  refillPerPlayer: number;
  pool: string[];
}

export const SEASONS: Record<SeasonCode, Season> = {
  spring: { code: "spring", name: "Spring", refillPerPlayer: 3, pool: ["rain", "sunny", "bumper", "pests"] },
  summer: { code: "summer", name: "Summer", refillPerPlayer: 2, pool: ["drought", "heatwave", "sunny", "drought", "bumper"] },
  autumn: { code: "autumn", name: "Autumn", refillPerPlayer: 2, pool: ["pests", "blight", "storm", "rain", "pests"] },
  winter: { code: "winter", name: "Winter", refillPerPlayer: 1, pool: ["frost", "storm", "frost", "drought"] },
};

// Round 1 is index 0.
export const SEASON_OF_ROUND: SeasonCode[] = [
  "spring", "spring", "summer", "summer", "autumn", "autumn", "winter", "winter",
];

export interface Bonus { code: string; label: string; value: number }

export const BONUSES: Bonus[] = [
  { code: "five_species",  label: "Five species alive",  value: 12 },
  { code: "three_species", label: "Three species alive", value: 5 },
  { code: "full_garden",   label: "Every plot planted",  value: 8 },
];
