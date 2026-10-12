import type {
  MythrasWoundEffect,
  WoundConsequencePlan,
} from './mythrasWounds';

import {
  resolveOpposedTest,
  type OpposedTestResult,
} from './mythrasOpposedTests';

export interface WoundOpposedRollInput {
  /**
   * Attacker's skill value used for the original successful attack,
   * after ordinary situational modifiers but before the Mythras
   * over-100 opposed-test adjustment.
   */
  attackSkill: number;

  /**
   * Original successful attack roll.
   */
  attackRoll: number;

  /**
   * Defender's Endurance skill.
   */
  enduranceSkill: number;

  /**
   * Defender's Endurance roll.
   */
  enduranceRoll: number;
}

export type WoundResolutionStatus =
  | 'complete-no-test'
  | 'pending-endurance-test'
  | 'complete-endurance-win'
  | 'complete-endurance-loss'
  | 'reroll-required';

export type WoundRerollReason =
  | 'both-failed'
  | 'exact-tie';

export interface WoundResolutionResult {
  status: WoundResolutionStatus;

  /**
   * Effects that should currently be applied.
   *
   * Immediate effects are always included.
   * Conditional effects are added once the Endurance test resolves.
   */
  effects: MythrasWoundEffect[];

  opposedResult?: OpposedTestResult;

  rerollReason?: WoundRerollReason;
}

export interface ResolveWoundConsequenceInput {
  plan: WoundConsequencePlan;

  /**
   * Omit this before the required Endurance roll has been made.
   */
  opposedRoll?: WoundOpposedRollInput;
}

/**
 * Resolves a wound consequence plan through its opposed
 * Endurance test.
 *
 * This function does not mutate Atlas state.
 */
export function resolveWoundConsequencePlan(
  input: ResolveWoundConsequenceInput,
): WoundResolutionResult {
  const immediateEffects = [
    ...input.plan.immediateEffects,
  ];

  /*
   * Minor and unwounded locations do not require the
   * wound Endurance contest.
   */
  if (!input.plan.enduranceTest) {
    return {
      status: 'complete-no-test',
      effects: immediateEffects,
    };
  }

  /*
   * The wound has occurred, so its immediate consequences
   * already apply even though the Endurance roll has not
   * yet been made.
   */
  if (!input.opposedRoll) {
    return {
      status: 'pending-endurance-test',
      effects: immediateEffects,
    };
  }

  /*
   * First participant = attacker.
   * Second participant = wounded character's Endurance.
   */
  const opposedResult = resolveOpposedTest(
    {
      skill: input.opposedRoll.attackSkill,
      roll: input.opposedRoll.attackRoll,
    },
    {
      skill: input.opposedRoll.enduranceSkill,
      roll: input.opposedRoll.enduranceRoll,
    },
  );

  /*
   * Attacker wins the opposed contest:
   * wounded character loses the Endurance test.
   */
  if (opposedResult.outcome === 'first-wins') {
    return {
      status: 'complete-endurance-loss',
      effects: [
        ...immediateEffects,
        ...input.plan.onEnduranceLoss,
      ],
      opposedResult,
    };
  }

  /*
   * Endurance wins the opposed contest.
   */
  if (opposedResult.outcome === 'second-wins') {
    return {
      status: 'complete-endurance-win',
      effects: [
        ...immediateEffects,
        ...input.plan.onEnduranceWin,
      ],
      opposedResult,
    };
  }

  /*
   * A wound Endurance test ultimately needs a binary winner.
   *
   * For both-failed results we use the Mythras option of
   * rerolling the contest.
   *
   * The core opposed-roll rule does not provide a further
   * tiebreaker for identical successful rolls, so Setara
   * also rerolls an exact tie rather than inventing a winner.
   */
  return {
    status: 'reroll-required',
    effects: immediateEffects,
    opposedResult,
    rerollReason:
      opposedResult.outcome === 'both-failed'
        ? 'both-failed'
        : 'exact-tie',
  };
}