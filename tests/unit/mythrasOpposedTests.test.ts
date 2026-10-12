import { describe, expect, it } from 'vitest';

import {
  adjustOpposedSkills,
  calculateCriticalThreshold,
  evaluateSkillRoll,
  resolveOpposedTest,
} from '../../src/app/gameSystems/mythras/mythrasOpposedTests';

describe('Mythras skill roll evaluation', () => {
  it('distinguishes ordinary success and failure', () => {
    expect(
      evaluateSkillRoll(60, 45).level,
    ).toBe('success');

    expect(
      evaluateSkillRoll(60, 75).level,
    ).toBe('failure');
  });

  it('treats rolls of 01-05 as automatic successes', () => {
    expect(
      evaluateSkillRoll(0, 5).level,
    ).toBe('success');
  });

  it('treats rolls of 96-100 as automatic failures', () => {
    expect(
      evaluateSkillRoll(150, 96).level,
    ).toBe('failure');

    expect(
      evaluateSkillRoll(150, 99).level,
    ).toBe('failure');
  });

  it('rounds the critical threshold upward', () => {
    expect(
      calculateCriticalThreshold(56),
    ).toBe(6);

    expect(
      evaluateSkillRoll(56, 6).level,
    ).toBe('critical');

    expect(
      evaluateSkillRoll(56, 7).level,
    ).toBe('success');
  });

  it('fumbles on 99-100 when skill is 100 or less', () => {
    expect(
      evaluateSkillRoll(80, 99).level,
    ).toBe('fumble');

    expect(
      evaluateSkillRoll(80, 100).level,
    ).toBe('fumble');
  });

  it('only fumbles on 100 when skill exceeds 100', () => {
    expect(
      evaluateSkillRoll(120, 99).level,
    ).toBe('failure');

    expect(
      evaluateSkillRoll(120, 100).level,
    ).toBe('fumble');
  });
});

describe('Mythras opposed skill adjustment', () => {
  it('does not change skills when neither exceeds 100', () => {
    expect(
      adjustOpposedSkills(75, 65),
    ).toEqual({
      penalty: 0,
      firstEffectiveSkill: 75,
      secondEffectiveSkill: 65,
    });
  });

  it('subtracts the highest skill excess from both participants', () => {
    expect(
      adjustOpposedSkills(130, 80),
    ).toEqual({
      penalty: 30,
      firstEffectiveSkill: 100,
      secondEffectiveSkill: 50,
    });
  });
});

describe('Mythras opposed tests', () => {
  it('awards the contest to the better success level', () => {
    const result = resolveOpposedTest(
      {
        skill: 70,
        roll: 5,
      },
      {
        skill: 70,
        roll: 40,
      },
    );

    expect(result.first.level).toBe('critical');
    expect(result.second.level).toBe('success');
    expect(result.outcome).toBe('first-wins');
    expect(result.reason).toBe(
      'better-success-level',
    );
  });

  it('awards success over failure', () => {
    const result = resolveOpposedTest(
      {
        skill: 60,
        roll: 40,
      },
      {
        skill: 60,
        roll: 80,
      },
    );

    expect(result.outcome).toBe('first-wins');
  });

  it('uses the higher die roll when both have the same successful level', () => {
    const result = resolveOpposedTest(
      {
        skill: 70,
        roll: 40,
      },
      {
        skill: 70,
        roll: 30,
      },
    );

    expect(result.outcome).toBe('first-wins');
    expect(result.reason).toBe('higher-roll');
  });

  it('returns both-failed when both ordinary rolls fail', () => {
    const result = resolveOpposedTest(
      {
        skill: 50,
        roll: 75,
      },
      {
        skill: 50,
        roll: 80,
      },
    );

    expect(result.outcome).toBe('both-failed');
  });

  it('returns both-failed when both participants fail even if one fumbles', () => {
    const result = resolveOpposedTest(
      {
        skill: 50,
        roll: 80,
      },
      {
        skill: 50,
        roll: 99,
      },
    );

    expect(result.second.level).toBe('fumble');
    expect(result.outcome).toBe('both-failed');
  });

  it('preserves an exact successful tie for the caller to resolve', () => {
    const result = resolveOpposedTest(
      {
        skill: 70,
        roll: 40,
      },
      {
        skill: 70,
        roll: 40,
      },
    );

    expect(result.outcome).toBe('tie');
    expect(result.reason).toBe('exact-tie');
  });

  it('can retroactively downgrade an attack when Endurance exceeds 100', () => {
    const result = resolveOpposedTest(
      {
        skill: 75,
        roll: 70,
      },
      {
        skill: 130,
        roll: 60,
      },
    );

    expect(result.over100Penalty).toBe(30);

    expect(result.first.skill).toBe(45);
    expect(result.first.level).toBe('failure');

    expect(result.second.skill).toBe(100);
    expect(result.second.level).toBe('success');

    expect(result.outcome).toBe('second-wins');
  });

  it('preserves the higher-skilled participant advantage after the over-100 adjustment', () => {
    const result = adjustOpposedSkills(
      130,
      110,
    );

    expect(result).toEqual({
      penalty: 30,
      firstEffectiveSkill: 100,
      secondEffectiveSkill: 80,
    });
  });
});