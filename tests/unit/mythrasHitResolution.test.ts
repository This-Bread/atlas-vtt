import { describe, expect, it } from 'vitest';

import type {
  LocationHealthState,
} from '../../src/app/types/locationHealthTypes';

import {
  MYTHRAS_HUMANOID_HIT_LOCATIONS,
} from '../../src/app/gameSystems/mythras/mythrasHitLocations';

import {
  resolveHumanoidHit,
} from '../../src/app/gameSystems/mythras/mythrasHitResolution';

function makeHumanoidHealth(): LocationHealthState {
  return {
    system: 'mythras',
    die: 20,
    anatomyId: 'mythras-humanoid',
    locations:
      MYTHRAS_HUMANOID_HIT_LOCATIONS.map(
        (location) => ({
          ...location,
          hp: {
            current: 5,
            max: 5,
          },
          armor: 0,
        }),
      ),
  };
}

describe('Mythras complete humanoid hit resolution', () => {
  it('resolves a Minor Wound from location roll through HP loss', () => {
    const health = makeHumanoidHealth();

    const result = resolveHumanoidHit({
      locationHealth: health,
      locationRoll: 14,
      incomingDamage: 2,
      attackSkill: 70,
      attackRoll: 40,
      healingRate: 2,
    });

    expect(result.location.id).toBe(
      'right-arm',
    );

    expect(result.damage.hpDamage).toBe(2);

    expect(result.updatedLocation.hp.current)
      .toBe(3);

    expect(result.damage.woundSeverity)
      .toBe('minor');

    expect(result.status)
      .toBe('complete-no-test');
  });

  it('applies location armor before HP damage', () => {
    const health = makeHumanoidHealth();

    const rightArm =
      health.locations.find(
        (location) =>
          location.id === 'right-arm',
      );

    if (!rightArm) {
      throw new Error('Missing right arm');
    }

    rightArm.armor = 3;

    const result = resolveHumanoidHit({
      locationHealth: health,
      locationRoll: 14,
      incomingDamage: 6,
      attackSkill: 70,
      attackRoll: 40,
      healingRate: 2,
    });

    expect(result.damage.hpDamage).toBe(3);
    expect(result.updatedLocation.hp.current)
      .toBe(2);
  });

  it('returns pending when a Serious Wound needs an Endurance roll', () => {
    const health = makeHumanoidHealth();

    const result = resolveHumanoidHit({
      locationHealth: health,
      locationRoll: 14,
      incomingDamage: 5,
      attackSkill: 70,
      attackRoll: 50,
      healingRate: 2,
    });

    expect(result.damage.woundSeverity)
      .toBe('serious');

    expect(result.status)
      .toBe('pending-endurance-test');
  });

  it('fully resolves a failed Serious arm Endurance test', () => {
    const health = makeHumanoidHealth();

    const result = resolveHumanoidHit({
      locationHealth: health,
      locationRoll: 14,
      incomingDamage: 5,
      attackSkill: 70,
      attackRoll: 50,
      healingRate: 2,
      enduranceSkill: 60,
      enduranceRoll: 40,
    });

    expect(result.status)
      .toBe('complete-endurance-loss');

    expect(
      result.woundResolution?.effects,
    ).toContainEqual({
      type: 'disable-location',
      until: 'positive-hp',
    });

    expect(
      result.woundResolution?.effects,
    ).toContainEqual({
      type: 'drop-held-item',
      unlessStrapped: true,
    });
  });

  it('pauses a Major limb wound until its injury type is supplied', () => {
    const health = makeHumanoidHealth();

    const result = resolveHumanoidHit({
      locationHealth: health,
      locationRoll: 14,
      incomingDamage: 10,
      attackSkill: 70,
      attackRoll: 50,
      healingRate: 2,
    });

    expect(result.damage.woundSeverity)
      .toBe('major');

    expect(result.updatedLocation.hp.current)
      .toBe(-5);

    expect(result.status)
      .toBe('pending-major-limb-injury');

    expect(result.woundPlan).toBeUndefined();
  });

  it('fully resolves a specified Major limb injury', () => {
    const health = makeHumanoidHealth();

    const result = resolveHumanoidHit({
      locationHealth: health,
      locationRoll: 14,
      incomingDamage: 10,
      attackSkill: 70,
      attackRoll: 50,
      healingRate: 3,
      enduranceSkill: 60,
      enduranceRoll: 40,
      majorLimbInjuryType: 'severed',
    });

    expect(result.status)
      .toBe('complete-endurance-loss');

    expect(
      result.woundResolution?.effects,
    ).toContainEqual({
      type: 'catastrophic-limb-injury',
      injuryType: 'severed',
    });

    expect(
      result.woundResolution?.effects,
    ).toContainEqual({
      type: 'treatment-deadline',
      amount: 15,
      unit: 'minutes',
      consequence: 'death',
    });

    expect(
      result.woundResolution?.effects,
    ).toContainEqual({
      type: 'unconscious',
    });
  });

  it('uses the over-100 opposed-test rule through the complete pipeline', () => {
    const health = makeHumanoidHealth();

    const result = resolveHumanoidHit({
      locationHealth: health,
      locationRoll: 14,
      incomingDamage: 5,
      attackSkill: 75,
      attackRoll: 70,
      healingRate: 2,
      enduranceSkill: 130,
      enduranceRoll: 60,
    });

    expect(
      result.woundResolution
        ?.opposedResult
        ?.over100Penalty,
    ).toBe(30);

    expect(result.status)
      .toBe('complete-endurance-win');
  });

  it('does not mutate the original location HP', () => {
    const health = makeHumanoidHealth();

    const originalArm =
      health.locations.find(
        (location) =>
          location.id === 'right-arm',
      );

    if (!originalArm) {
      throw new Error('Missing right arm');
    }

    expect(originalArm.hp.current).toBe(5);

    const result = resolveHumanoidHit({
      locationHealth: health,
      locationRoll: 14,
      incomingDamage: 4,
      attackSkill: 70,
      attackRoll: 40,
      healingRate: 2,
    });

    expect(result.updatedLocation.hp.current)
      .toBe(1);

    /*
     * Pure rules calculation:
     * original state remains unchanged.
     */
    expect(originalArm.hp.current).toBe(5);
  });

  it('requires Endurance skill and roll to be supplied together', () => {
    const health = makeHumanoidHealth();

    expect(() =>
      resolveHumanoidHit({
        locationHealth: health,
        locationRoll: 14,
        incomingDamage: 5,
        attackSkill: 70,
        attackRoll: 50,
        healingRate: 2,
        enduranceSkill: 60,
      }),
    ).toThrow(
      'Provide both enduranceSkill and enduranceRoll, or omit both.',
    );
  });

  it('validates paired Endurance input before pausing for a Major limb injury', () => {
  const health = makeHumanoidHealth();

  expect(() =>
    resolveHumanoidHit({
      locationHealth: health,
      locationRoll: 14,
      incomingDamage: 10,
      attackSkill: 70,
      attackRoll: 50,
      healingRate: 2,
      enduranceSkill: 60,
    }),
  ).toThrow(
    'Provide both enduranceSkill and enduranceRoll, or omit both.',
  );
});
});