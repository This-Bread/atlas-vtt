/**
 * General Mythras skill-roll and opposed-test resolution.
 *
 * A roll of 100 represents "00" on a d100.
 */

export type SkillRollLevel =
  | 'fumble'
  | 'failure'
  | 'success'
  | 'critical';

export interface SkillRollEvaluation {
  skill: number;
  roll: number;
  criticalThreshold: number;
  level: SkillRollLevel;
}

export interface OpposedParticipantInput {
  /**
   * Skill after ordinary situational modifiers have already
   * been applied, but before the Mythras over-100 opposed
   * skill adjustment.
   */
  skill: number;

  /**
   * d100 result from 1 through 100.
   *
   * 100 represents "00".
   */
  roll: number;
}

export interface OpposedSkillAdjustment {
  penalty: number;
  firstEffectiveSkill: number;
  secondEffectiveSkill: number;
}

export type OpposedTestOutcome =
  | 'first-wins'
  | 'second-wins'
  | 'both-failed'
  | 'tie';

export type OpposedTestReason =
  | 'better-success-level'
  | 'higher-roll'
  | 'both-failed'
  | 'exact-tie';

export interface OpposedTestResult {
  outcome: OpposedTestOutcome;
  reason: OpposedTestReason;

  over100Penalty: number;

  first: SkillRollEvaluation;
  second: SkillRollEvaluation;
}

const SUCCESS_LEVEL_RANK: Record<
  SkillRollLevel,
  number
> = {
  fumble: 0,
  failure: 1,
  success: 2,
  critical: 3,
};

function assertValidRoll(roll: number): void {
  if (
    !Number.isInteger(roll) ||
    roll < 1 ||
    roll > 100
  ) {
    throw new RangeError(
      `A Mythras d100 roll must be an integer from 1 to 100. Received: ${roll}`,
    );
  }
}

function assertValidSkill(skill: number): void {
  if (!Number.isFinite(skill)) {
    throw new RangeError(
      `A Mythras skill value must be finite. Received: ${skill}`,
    );
  }
}

/**
 * Calculates the critical-success threshold.
 *
 * Mythras uses one tenth of the skill, rounding fractions up.
 */
export function calculateCriticalThreshold(
  skill: number,
): number {
  assertValidSkill(skill);

  return Math.max(0, Math.ceil(skill / 10));
}

/**
 * Evaluates one d100 roll against one effective skill value.
 */
export function evaluateSkillRoll(
  skill: number,
  roll: number,
): SkillRollEvaluation {
  assertValidSkill(skill);
  assertValidRoll(roll);

  const criticalThreshold =
    calculateCriticalThreshold(skill);

  /*
   * Rolls of 96-100 always fail.
   *
   * Normally 99-100 fumble.
   * A skill above 100 fumbles only on 100.
   */
  if (roll >= 96) {
    const isFumble =
      roll === 100 ||
      (skill <= 100 && roll === 99);

    return {
      skill,
      roll,
      criticalThreshold,
      level: isFumble ? 'fumble' : 'failure',
    };
  }

  if (roll <= criticalThreshold) {
    return {
      skill,
      roll,
      criticalThreshold,
      level: 'critical',
    };
  }

  /*
   * Rolls of 01-05 always succeed even if the skill
   * has been reduced below the rolled value.
   */
  if (roll <= 5) {
    return {
      skill,
      roll,
      criticalThreshold,
      level: 'success',
    };
  }

  return {
    skill,
    roll,
    criticalThreshold,
    level: roll <= skill ? 'success' : 'failure',
  };
}

/**
 * Applies the Mythras opposed-skills-over-100 rule.
 */
export function adjustOpposedSkills(
  firstSkill: number,
  secondSkill: number,
): OpposedSkillAdjustment {
  assertValidSkill(firstSkill);
  assertValidSkill(secondSkill);

  const highestSkill = Math.max(
    firstSkill,
    secondSkill,
  );

  const penalty = Math.max(
    0,
    highestSkill - 100,
  );

  return {
    penalty,
    firstEffectiveSkill:
      firstSkill - penalty,
    secondEffectiveSkill:
      secondSkill - penalty,
  };
}

function isSuccessfulLevel(
  level: SkillRollLevel,
): boolean {
  return (
    level === 'success' ||
    level === 'critical'
  );
}

/**
 * Resolves a standard two-participant Mythras Opposed Roll.
 *
 * This does not apply consequences. It only determines the
 * result of the contest.
 */
export function resolveOpposedTest(
  firstInput: OpposedParticipantInput,
  secondInput: OpposedParticipantInput,
): OpposedTestResult {
  const adjustment = adjustOpposedSkills(
    firstInput.skill,
    secondInput.skill,
  );

  const first = evaluateSkillRoll(
    adjustment.firstEffectiveSkill,
    firstInput.roll,
  );

  const second = evaluateSkillRoll(
    adjustment.secondEffectiveSkill,
    secondInput.roll,
  );

  const firstSucceeded =
    isSuccessfulLevel(first.level);

  const secondSucceeded =
    isSuccessfulLevel(second.level);

  /*
   * Mythras treats a contest where both participants fail
   * specially rather than simply awarding it to one of them.
   */
  if (!firstSucceeded && !secondSucceeded) {
    return {
      outcome: 'both-failed',
      reason: 'both-failed',
      over100Penalty: adjustment.penalty,
      first,
      second,
    };
  }

  if (firstSucceeded && !secondSucceeded) {
    return {
      outcome: 'first-wins',
      reason: 'better-success-level',
      over100Penalty: adjustment.penalty,
      first,
      second,
    };
  }

  if (!firstSucceeded && secondSucceeded) {
    return {
      outcome: 'second-wins',
      reason: 'better-success-level',
      over100Penalty: adjustment.penalty,
      first,
      second,
    };
  }

  /*
   * Both succeeded.
   */
  const firstRank =
    SUCCESS_LEVEL_RANK[first.level];

  const secondRank =
    SUCCESS_LEVEL_RANK[second.level];

  if (firstRank > secondRank) {
    return {
      outcome: 'first-wins',
      reason: 'better-success-level',
      over100Penalty: adjustment.penalty,
      first,
      second,
    };
  }

  if (secondRank > firstRank) {
    return {
      outcome: 'second-wins',
      reason: 'better-success-level',
      over100Penalty: adjustment.penalty,
      first,
      second,
    };
  }

  /*
   * Same successful level: higher successful die roll wins.
   */
  if (first.roll > second.roll) {
    return {
      outcome: 'first-wins',
      reason: 'higher-roll',
      over100Penalty: adjustment.penalty,
      first,
      second,
    };
  }

  if (second.roll > first.roll) {
    return {
      outcome: 'second-wins',
      reason: 'higher-roll',
      over100Penalty: adjustment.penalty,
      first,
      second,
    };
  }

  /*
   * The core text does not specify an additional tiebreaker
   * for identical successful rolls, so preserve the tie and
   * let the calling rule or GM resolve it.
   */
  return {
    outcome: 'tie',
    reason: 'exact-tie',
    over100Penalty: adjustment.penalty,
    first,
    second,
  };
}