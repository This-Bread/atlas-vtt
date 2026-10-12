import { describe, expect, it } from 'vitest';

import {
  MYTHRAS_HUMANOID_HIT_LOCATIONS,
} from '../../src/app/gameSystems/mythras/mythrasHitLocations';

import {
  buildHumanoidWoundConsequencePlan,
} from '../../src/app/gameSystems/mythras/mythrasWounds';

import {
  resolveWoundConsequencePlan,
} from '../../src/app/gameSystems/mythras/mythrasWoundResolution';

function getLocation(id: string) {
  const location =
    MYTHRAS_HUMANOID_HIT_LOCATIONS.find(
      (candidate) => candidate.id === id,
    );

  if (!location) {
    throw new Error(`Unknown test location: ${id}`);
  }

  return location;
}

describe('Mythras wound resolution', () => {
  it('completes immediately when no Endurance test is required', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'minor',
        location: getLocation('right-arm'),
        hpDamage: 1,
        healingRate: 2,
      });

    const result =
      resolveWoundConsequencePlan({
        plan,
      });

    expect(result.status).toBe(
      'complete-no-test',
    );

    expect(result.opposedResult).toBeUndefined();
  });

  it('returns pending while waiting for a required Endurance roll', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('right-arm'),
        hpDamage: 5,
        healingRate: 2,
      });

    const result =
      resolveWoundConsequencePlan({
        plan,
      });

    expect(result.status).toBe(
      'pending-endurance-test',
    );

    expect(result.effects).toContainEqual({
      type: 'permanent-scar',
    });
  });

  it('applies Serious arm failure consequences when the attacker wins', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('right-arm'),
        hpDamage: 5,
        healingRate: 2,
      });

    const result =
      resolveWoundConsequencePlan({
        plan,
        opposedRoll: {
          attackSkill: 70,
          attackRoll: 50,
          enduranceSkill: 60,
          enduranceRoll: 40,
        },
      });

    expect(result.status).toBe(
      'complete-endurance-loss',
    );

    expect(result.effects).toContainEqual({
      type: 'disable-location',
      until: 'positive-hp',
    });

    expect(result.effects).toContainEqual({
      type: 'drop-held-item',
      unlessStrapped: true,
    });
  });

  it('does not apply Serious arm failure consequences when Endurance wins', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('right-arm'),
        hpDamage: 5,
        healingRate: 2,
      });

    const result =
      resolveWoundConsequencePlan({
        plan,
        opposedRoll: {
          attackSkill: 70,
          attackRoll: 30,
          enduranceSkill: 70,
          enduranceRoll: 50,
        },
      });

    expect(result.status).toBe(
      'complete-endurance-win',
    );

    expect(result.effects).not.toContainEqual({
      type: 'disable-location',
      until: 'positive-hp',
    });
  });

  it('applies unconsciousness after a failed Serious vital Endurance test', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('chest'),
        hpDamage: 7,
        healingRate: 2,
      });

    const result =
      resolveWoundConsequencePlan({
        plan,
        opposedRoll: {
          attackSkill: 75,
          attackRoll: 60,
          enduranceSkill: 55,
          enduranceRoll: 40,
        },
      });

    expect(result.status).toBe(
      'complete-endurance-loss',
    );

    expect(result.effects).toContainEqual({
      type: 'unconscious',
      duration: {
        amount: 7,
        unit: 'minutes',
      },
    });
  });

  it('applies death after a failed Major vital Endurance test', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'major',
        location: getLocation('head'),
        hpDamage: 10,
        healingRate: 2,
      });

    const result =
      resolveWoundConsequencePlan({
        plan,
        opposedRoll: {
          attackSkill: 80,
          attackRoll: 60,
          enduranceSkill: 50,
          enduranceRoll: 30,
        },
      });

    expect(result.status).toBe(
      'complete-endurance-loss',
    );

    expect(result.effects).toContainEqual({
      type: 'death',
    });
  });

  it('handles Endurance over 100 using the general opposed-test rule', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('right-arm'),
        hpDamage: 5,
        healingRate: 2,
      });

    const result =
      resolveWoundConsequencePlan({
        plan,
        opposedRoll: {
          attackSkill: 75,
          attackRoll: 70,
          enduranceSkill: 130,
          enduranceRoll: 60,
        },
      });

    expect(result.opposedResult?.over100Penalty)
      .toBe(30);

    expect(result.opposedResult?.first.level)
      .toBe('failure');

    expect(result.opposedResult?.second.level)
      .toBe('success');

    expect(result.status).toBe(
      'complete-endurance-win',
    );
  });

  it('requires a reroll when both participants fail', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('right-leg'),
        hpDamage: 5,
        healingRate: 2,
      });

    const result =
      resolveWoundConsequencePlan({
        plan,
        opposedRoll: {
          attackSkill: 50,
          attackRoll: 70,
          enduranceSkill: 50,
          enduranceRoll: 80,
        },
      });

    expect(result.status).toBe(
      'reroll-required',
    );

    expect(result.rerollReason).toBe(
      'both-failed',
    );

    expect(result.effects).not.toContainEqual({
      type: 'disable-location',
      until: 'positive-hp',
    });
  });

  it('requires a reroll for an exact successful tie', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('right-arm'),
        hpDamage: 5,
        healingRate: 2,
      });

    const result =
      resolveWoundConsequencePlan({
        plan,
        opposedRoll: {
          attackSkill: 70,
          attackRoll: 40,
          enduranceSkill: 70,
          enduranceRoll: 40,
        },
      });

    expect(result.status).toBe(
      'reroll-required',
    );

    expect(result.rerollReason).toBe(
      'exact-tie',
    );
  });
});