import { describe, expect, it } from 'vitest';

import {
  MYTHRAS_HUMANOID_HIT_LOCATIONS,
} from '../../src/app/gameSystems/mythras/mythrasHitLocations';

import {
  buildHumanoidWoundConsequencePlan,
  classifyHumanoidWoundRegion,
} from '../../src/app/gameSystems/mythras/mythrasWounds';

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

describe('Mythras humanoid wound regions', () => {
  it('classifies arms and legs as limbs', () => {
    expect(
      classifyHumanoidWoundRegion(
        getLocation('right-arm'),
      ),
    ).toEqual({
      region: 'limb',
      limbKind: 'arm',
    });

    expect(
      classifyHumanoidWoundRegion(
        getLocation('left-leg'),
      ),
    ).toEqual({
      region: 'limb',
      limbKind: 'leg',
    });
  });

  it('classifies abdomen, chest, and head as vital locations', () => {
    for (const id of ['abdomen', 'chest', 'head']) {
      expect(
        classifyHumanoidWoundRegion(
          getLocation(id),
        ),
      ).toEqual({
        region: 'vital',
        limbKind: null,
      });
    }
  });
});

describe('Mythras Serious Wounds', () => {
  it('does nothing special for Minor Wounds', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'minor',
        location: getLocation('right-arm'),
        hpDamage: 1,
        healingRate: 2,
      });

    expect(plan.immediateEffects).toEqual([]);
    expect(plan.enduranceTest).toBeUndefined();
    expect(plan.onEnduranceLoss).toEqual([]);
  });

  it('applies the universal Serious Wound effects', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('right-arm'),
        hpDamage: 5,
        healingRate: 2,
      });

    expect(plan.immediateEffects).toContainEqual({
      type: 'permanent-scar',
    });

    expect(plan.immediateEffects).toContainEqual({
      type: 'stunned-or-distracted',
      durationRoll: '1d3',
      unit: 'turns',
      cannotAttack: true,
      cannotStartCasting: true,
      canParry: true,
      canEvade: true,
    });

    expect(plan.enduranceTest).toEqual({
      skill: 'Endurance',
      versus: 'successful-attack-roll',
      timing: 'immediate',
      repeatOnlyIfLocationWoundedAgain: true,
    });
  });

  it('disables a Seriously Wounded arm when Endurance loses', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('right-arm'),
        hpDamage: 5,
        healingRate: 2,
      });

    expect(plan.onEnduranceLoss).toContainEqual({
      type: 'disable-location',
      until: 'positive-hp',
    });

    expect(plan.onEnduranceLoss).toContainEqual({
      type: 'drop-held-item',
      unlessStrapped: true,
    });
  });

  it('drops a character prone when a Seriously Wounded leg fails Endurance', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('right-leg'),
        hpDamage: 5,
        healingRate: 2,
      });

    expect(plan.onEnduranceLoss).toContainEqual({
      type: 'disable-location',
      until: 'positive-hp',
    });

    expect(plan.onEnduranceLoss).toContainEqual({
      type: 'fall-prone',
    });
  });

  it('uses damage sustained as unconsciousness duration for a failed vital Serious Wound', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'serious',
        location: getLocation('chest'),
        hpDamage: 7,
        healingRate: 2,
      });

    expect(plan.onEnduranceLoss).toContainEqual({
      type: 'unconscious',
      duration: {
        amount: 7,
        unit: 'minutes',
      },
    });

    expect(plan.onEnduranceLoss).toContainEqual({
      type: 'cannot-rejoin-combat-until-further-healing',
    });
  });
});

describe('Mythras Major Wounds', () => {
  it('immediately incapacitates and drops a Major limb wound victim prone', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'major',
        location: getLocation('right-arm'),
        hpDamage: 10,
        healingRate: 2,
        majorLimbInjuryType: 'shattered',
      });

    expect(plan.immediateEffects).toContainEqual({
      type: 'incapacitated',
    });

    expect(plan.immediateEffects).toContainEqual({
      type: 'fall-prone',
    });

    expect(plan.immediateEffects).toContainEqual({
      type: 'catastrophic-limb-injury',
      injuryType: 'shattered',
    });
  });

  it('causes unconsciousness when Major limb Endurance loses', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'major',
        location: getLocation('right-arm'),
        hpDamage: 10,
        healingRate: 2,
        majorLimbInjuryType: 'shattered',
      });

    expect(plan.onEnduranceLoss).toContainEqual({
      type: 'unconscious',
    });
  });

  it('sets a five-times-Healing-Rate deadline for a bleeding Major limb wound', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'major',
        location: getLocation('left-leg'),
        hpDamage: 10,
        healingRate: 3,
        majorLimbInjuryType: 'severed',
      });

    expect(plan.immediateEffects).toContainEqual({
      type: 'treatment-deadline',
      amount: 15,
      unit: 'minutes',
      consequence: 'death',
    });
  });

  it('immediately knocks a Major vital wound victim unconscious and incapacitates them', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'major',
        location: getLocation('head'),
        hpDamage: 10,
        healingRate: 3,
      });

    expect(plan.immediateEffects).toContainEqual({
      type: 'unconscious',
    });

    expect(plan.immediateEffects).toContainEqual({
      type: 'incapacitated',
    });
  });

  it('sets a twice-Healing-Rate treatment deadline for a Major vital wound', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'major',
        location: getLocation('abdomen'),
        hpDamage: 10,
        healingRate: 3,
      });

    expect(plan.immediateEffects).toContainEqual({
      type: 'treatment-deadline',
      amount: 6,
      unit: 'combat-rounds',
      consequence: 'death',
    });
  });

  it('causes death when Major vital Endurance loses', () => {
    const plan =
      buildHumanoidWoundConsequencePlan({
        severity: 'major',
        location: getLocation('chest'),
        hpDamage: 10,
        healingRate: 2,
      });

    expect(plan.onEnduranceLoss).toContainEqual({
      type: 'death',
    });
  });

  it('records the selected Major limb injury type', () => {
  const plan =
    buildHumanoidWoundConsequencePlan({
      severity: 'major',
      location: getLocation('right-arm'),
      hpDamage: 10,
      healingRate: 2,
      majorLimbInjuryType: 'transfixed',
    });

  expect(plan.immediateEffects).toContainEqual({
    type: 'catastrophic-limb-injury',
    injuryType: 'transfixed',
  });
});

it('does not add the blood-loss deadline for a shattered limb by default', () => {
  const plan =
    buildHumanoidWoundConsequencePlan({
      severity: 'major',
      location: getLocation('right-arm'),
      hpDamage: 10,
      healingRate: 2,
      majorLimbInjuryType: 'shattered',
    });

  expect(
    plan.immediateEffects.some(
      (effect) => effect.type === 'treatment-deadline',
    ),
  ).toBe(false);
});

it('rejects a Major limb wound without an injury type', () => {
  expect(() =>
    buildHumanoidWoundConsequencePlan({
      severity: 'major',
      location: getLocation('right-arm'),
      hpDamage: 10,
      healingRate: 2,
    }),
  ).toThrow(
    'Major limb wounds require a majorLimbInjuryType.',
  );
});
});