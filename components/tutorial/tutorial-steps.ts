// THE LAST GARDEN — "How to play" tutorial text.
// Edit the wording here freely. Each step is shown on its own page of the
// tutorial, in this order. `icon` picks the picture for the step and must be
// one of the names listed in TutorialIcon below.

export type TutorialIcon =
  | "garden" | "health" | "turn" | "reservoir" | "events" | "neighbours" | "win";

export interface TutorialStep {
  icon: TutorialIcon;
  title: string;
  body: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: "garden",
    title: "Your garden",
    body: "You have six plots and start with four seeds already planted. Grow them through four stages (Seed → Sprout → Mature → Bloom), because bigger plants are worth more points.",
  },
  {
    icon: "health",
    title: "Health and growth",
    body: "Each plant has up to 5 health, shown as dots under it. Keep a plant at full health for a few rounds in a row and it grows a stage. If its health drops to zero, it dies.",
  },
  {
    icon: "turn",
    title: "Your turn",
    body: "Each round you get 3 tokens to spend on actions: Water, Weed, Fertilise, Shelter or Plant a new seed. Choose an action, tap one of your plots, and press End round when you're done.",
  },
  {
    icon: "reservoir",
    title: "The shared reservoir",
    body: "Watering and fertilising take water from one reservoir that every gardener shares. It refills at the end of each round, but by less as the seasons move toward winter.",
  },
  {
    icon: "events",
    title: "Event cards",
    body: "Each round an event card is revealed, such as Drought, Pests, Frost or Gentle Rain. Read it before you act so you know which plants need help.",
  },
  {
    icon: "neighbours",
    title: "Neighbours matter",
    body: "Plants affect the plots right next to them. Sunflowers dry their neighbours out, Moss keeps them damp, Monstera shades them and Roses attract pests. Tap any plant to see what's affecting it.",
  },
  {
    icon: "win",
    title: "How to win",
    body: "After eight rounds, from Spring to Winter, the gardener with the most points wins. Plants in bloom score the most, and you get bonus points for growing different species and filling every plot.",
  },
];

// Button labels, in case you want to reword those too.
export const TUTORIAL_LABELS = {
  open: "How to play",
  back: "Back",
  next: "Next",
  skip: "Skip",
  finish: "Start playing",
};
