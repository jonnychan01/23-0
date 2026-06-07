export type GameScreen =
  | "start"
  | "spinning"
  | "picking"
  | "result";

export type Position =
  | "FF" | "FP" | "CHF" | "HFF"   // Forwards
  | "WNG" | "MID"                  // Midfield
  | "RK"                           // Ruck
  | "CHB" | "HBF" | "FB" | "BP"   // Defence

export interface Player {
  id: number;
  name: string;
  club: string;
  decade: string;
  games: number;
  goals: number;
  disposals: number;
  marks: number;
  tackles: number;
  hitouts: number;
  clearances: number;
  inside50s: number;
  position: Position;
  secondaryPosition?: string;
}

export interface SpinResult {
  club: string;
  decade: string;
  playerCount: number;
}

export interface SimResult {
  wins: number;
  losses: number;
  teamRating: number;
  breakdown: {
    attacking: number;
    midfield: number;
    defensive: number;
    ruck: number;
    balance: number;
  };
  mvp: string;
}

export interface GameState {
  screen: GameScreen;
  round: number;
  roster: Player[];
  currentSpin: SpinResult | null;
  candidates: Player[];
  respinsRemaining: number;
  simResult: SimResult | null;
  classicMode: boolean;
  positionCounts: Record<Position, number>;
  lockedDecade?: string;
  lockedClub?: string;
  preloadedSpin?: SpinResult;
  preloadedCandidates?: Player[];
}

// Max per position group
export const POSITION_LIMITS: Record<Position, number> = {
  FF:   1,
  FP:   2,
  CHF:  1,
  HFF:  2,
  WNG:  2,
  MID:  3,
  RK:   1,
  CHB:  1,
  HBF:  2,
  FB:   1,
  BP:   2,
};

export const TOTAL_ROUNDS = 18;

export const POSITION_LABELS: Record<Position, string> = {
  FF:  "Full Forward",
  FP:  "Fwd Pocket",
  CHF: "Ctr Hf Fwd",
  HFF: "Half Forward",
  WNG: "Wing",
  MID: "Midfielder",
  RK:  "Ruck",
  CHB: "Ctr Hf Bck",
  HBF: "Half Back",
  FB:  "Full Back",
  BP:  "Bck Pocket",
};

// Field layout for position map
export const FIELD_POSITIONS = [
  { position: "FF",  label: "FF",  x: 50, y: 7  },
  { position: "FP",  label: "FP",  x: 35, y: 10 },
  { position: "FP",  label: "FP",  x: 65, y: 10 },
  { position: "CHF", label: "CHF", x: 50, y: 30 },
  { position: "HFF", label: "HFF", x: 25, y: 27 },
  { position: "HFF", label: "HFF", x: 75, y: 27 },
  { position: "WNG", label: "WNG", x: 15, y: 50 },
  { position: "WNG", label: "WNG", x: 85, y: 50 },
  { position: "MID", label: "MID", x: 40, y: 45 },
  { position: "MID", label: "MID", x: 60, y: 45 },
  { position: "MID", label: "MID", x: 60, y: 55 },
  { position: "RK",  label: "RK",  x: 40, y: 55 },
  { position: "CHB", label: "CHB", x: 50, y: 68 },
  { position: "HBF", label: "HBF", x: 30, y: 70 },
  { position: "HBF", label: "HBF", x: 70, y: 70 },
  { position: "BP",  label: "BP",  x: 30, y: 82 },
  { position: "BP",  label: "BP",  x: 70, y: 82 },
  { position: "FB",  label: "FB",  x: 50, y: 90 },
];

export const TEAM_COLOURS: Record<string, { primary: string; secondary: string }> = {
  "Adelaide":          { primary: "#0F1432", secondary: "#FFD200" },
  "Brisbane Bears":    { primary: "#A30046", secondary: "#FDBE57" },
  "Brisbane Lions":    { primary: "#A30046", secondary: "#FDBE57" },
  "Carlton":           { primary: "#0E1E2D", secondary: "#FFFFFF" },
  "Collingwood":       { primary: "#000000", secondary: "#FFFFFF" },
  "Essendon":          { primary: "#000000", secondary: "#E20A20" },
  "Fitzroy":           { primary: "#A3003E", secondary: "#FFD200" },
  "Fremantle":         { primary: "#2A1A54", secondary: "#FFFFFF" },
  "Geelong":           { primary: "#1C3C63", secondary: "#FFFFFF" },
  "Gold Coast":        { primary: "#FFE600", secondary: "#D93E39" },
  "GWS Giants":        { primary: "#F15C22", secondary: "#FFFFFF" },
  "Hawthorn":          { primary: "#4D2004", secondary: "#FBBF15" },
  "Melbourne":         { primary: "#0F1131", secondary: "#CC2031" },
  "North Melbourne":   { primary: "#013B9F", secondary: "#FFFFFF" },
  "Port Adelaide":     { primary: "#008AAB", secondary: "#FFFFFF" },
  "Richmond":          { primary: "#000000", secondary: "#FED102" },
  "St Kilda":          { primary: "#ED1B2E", secondary: "#FFFFFF" },
  "Sydney":            { primary: "#ED171F", secondary: "#FFFFFF" },
  "West Coast":        { primary: "#062EE2", secondary: "#FFD700" },
  "Western Bulldogs":  { primary: "#20539D", secondary: "#FFFFFF" },
};
