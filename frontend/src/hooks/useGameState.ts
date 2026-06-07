import { useCallback, useReducer } from "react";
import type { GameState, Player, Position, SimResult, SpinResult } from "../types";
import { POSITION_LIMITS, TOTAL_ROUNDS } from "../types";
import { spinReel, fetchCandidates, simulateSeason } from "../lib/api";

function initialState(classicMode: boolean): GameState {
  return {
    screen:              "start",
    round:               1,
    roster:              [],
    currentSpin:         null,
    candidates:          [],
    respinsRemaining:    3,
    simResult:           null,
    classicMode,
    positionCounts: {
      FF: 0, FP: 0, CHF: 0, HFF: 0,
      WNG: 0, MID: 0, RK: 0,
      CHB: 0, HBF: 0, FB: 0, BP: 0,
    },
    lockedDecade:        undefined,
    lockedClub:          undefined,
    preloadedSpin:       undefined,
    preloadedCandidates: undefined,
  };
}

type Action =
  | { type: "START_GAME"; classicMode: boolean }
  | { type: "BEGIN_SPIN" }
  | { type: "BEGIN_RESPIN" }
  | { type: "SPIN_COMPLETE"; spin: SpinResult; candidates: Player[] }
  | { type: "PICK_PLAYER"; player: Player }
  | { type: "SIM_COMPLETE"; result: SimResult }
  | { type: "RESTART" }
  | { type: "MOVE_PLAYER"; playerId: number; toPosition: Position }
  | { type: "REORDER_ROSTER"; roster: Player[] };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START_GAME":
      return { ...initialState(action.classicMode), screen: "spinning" };

    case "BEGIN_SPIN":
      return { ...state, screen: "spinning", candidates: [], currentSpin: null };

    case "BEGIN_RESPIN":
      return {
        ...state,
        respinsRemaining:    state.respinsRemaining - 1,
        screen:              "spinning",
        currentSpin:         null,
        candidates:          [],
        preloadedSpin:       undefined,
        preloadedCandidates: undefined,
        lockedDecade:        undefined,
        lockedClub:          undefined,
      };

    case "SPIN_COMPLETE":
      return {
        ...state,
        screen:              "picking",
        lockedDecade:        undefined,
        lockedClub:          undefined,
        preloadedSpin:       undefined,
        preloadedCandidates: undefined,
        currentSpin:         action.spin,
        candidates:          action.candidates,
      };

    case "PICK_PLAYER": {
      const player = action.player;
      const newCounts = { ...state.positionCounts };
      const pos = player.position as Position;
      newCounts[pos] = (newCounts[pos] ?? 0) + 1;
      const newRoster = [...state.roster, player];
      const isLastPick = state.round >= TOTAL_ROUNDS;
      return {
        ...state,
        roster:              newRoster,
        round:               state.round + 1,
        positionCounts:      newCounts,
        screen:              isLastPick ? "result" : "spinning",
        candidates:          [],
        currentSpin:         null,
        preloadedSpin:       undefined,
        preloadedCandidates: undefined,
        lockedDecade:        undefined,
        lockedClub:          undefined,
      };
    }

    case "MOVE_PLAYER": {
      const player = state.roster.find(p => p.id === action.playerId);
      if (!player) return state;
      const fromPos = player.position as Position;
      const toPos = action.toPosition;
      if ((state.positionCounts[toPos] ?? 0) >= POSITION_LIMITS[toPos]) return state;
      const newCounts = { ...state.positionCounts };
      newCounts[fromPos] = Math.max(0, (newCounts[fromPos] ?? 0) - 1);
      newCounts[toPos] = (newCounts[toPos] ?? 0) + 1;
      const newRoster = state.roster.map(p =>
        p.id === action.playerId ? { ...p, position: toPos, secondaryPosition: fromPos } : p
      );
      return { ...state, roster: newRoster, positionCounts: newCounts };
    }

    case "REORDER_ROSTER":
      return { ...state, roster: action.roster };

    case "SIM_COMPLETE":
      return { ...state, simResult: action.result };

    case "RESTART":
      return initialState(state.classicMode);

    default:
      return state;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialState(false));

  const startGame = useCallback((classicMode: boolean) => {
    dispatch({ type: "START_GAME", classicMode });
  }, []);

  const onSpinComplete = useCallback((spin: SpinResult, candidates: Player[]) => {
    dispatch({ type: "SPIN_COMPLETE", spin, candidates });
  }, []);

  const respin = useCallback(() => {
    if (state.respinsRemaining <= 0) return;
    dispatch({ type: "BEGIN_RESPIN" });
  }, [state.respinsRemaining]);

  const pickPlayer = useCallback((player: Player) => {
    dispatch({ type: "PICK_PLAYER", player });
  }, []);

  const movePlayer = useCallback((playerId: number, toPosition: Position) => {
    dispatch({ type: "MOVE_PLAYER", playerId, toPosition });
  }, []);

  const reorderRoster = useCallback((newRoster: Player[]) => {
    dispatch({ type: "REORDER_ROSTER", roster: newRoster });
  }, []);

  const runSimulation = useCallback(async () => {
    const result = await simulateSeason(state.roster);
    dispatch({ type: "SIM_COMPLETE", result });
  }, [state.roster]);

  const restart = useCallback(() => {
    dispatch({ type: "RESTART" });
  }, []);

  const isPositionFull = useCallback(
    (position: Position): boolean => {
      return (state.positionCounts[position] ?? 0) >= POSITION_LIMITS[position];
    },
    [state.positionCounts]
  );

  return {
    state,
    startGame,
    onSpinComplete,
    respin,
    pickPlayer,
    movePlayer,
    reorderRoster,
    runSimulation,
    restart,
    isPositionFull,
  };
}