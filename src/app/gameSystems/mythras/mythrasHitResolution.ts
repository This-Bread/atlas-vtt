import type {
  HitLocationState,
  LocationHealthState,
} from '../../types/locationHealthTypes';

import {
  resolveLocationDamage,
  type LocationDamageResult,
} from './mythrasDamage';

import {
  buildHumanoidWoundConsequencePlan,
  classifyHumanoidWoundRegion,
  type MajorLimbInjuryType,
  type WoundConsequencePlan,
} from './mythrasWounds';

import {
  resolveWoundConsequencePlan,
  type WoundResolutionResult,
  type WoundResolutionStatus,
} from './mythrasWoundResolution';

export type HumanoidHitResolutionStatus =
  | WoundResolutionStatus
  | 'pending-major-limb-injury';

export interface ResolveHumanoidHitInput {
  /**
   * Current runtime location health for the target.
   */
  locationHealth: LocationHealthState;

  /**
   * Already-rolled hit-location result.
   *
   * This function does not roll dice itself.
   */
  locationRoll: number;

  /**
   * Damage reaching the target before location armor.
   */
  incomingDamage: number;

  /**
   * Original attack skill and successful attack roll.
   *
   * These are retained because Serious/Major Wounds can
   * require an opposed Endurance test against that attack.
   */
  attackSkill: number;
  attackRoll: number;

  /**
   * Target's Healing Rate.
   */
  healingRate: number;

  /**
   * Supply both once an Endurance roll has actually been made.
   * Omit both while the wound is waiting for that roll.
   */
  enduranceSkill?: number;
  enduranceRoll?: number;

  /**
   * Required when a Major limb wound has been assigned its
   * catastrophic injury form.
   */
  majorLimbInjuryType?: MajorLimbInjuryType;
}

export interface HumanoidHitResolutionResult {
  status: HumanoidHitResolutionStatus;

  /**
   * Location state before damage.
   */
  location: HitLocationState;

  /**
   * Location state after HP damage.
   *
   * The original LocationHealthState is NOT mutated.
   */
  updatedLocation: HitLocationState;

  damage: LocationDamageResult;

  /**
   * Absent only while a Major limb wound is waiting for its
   * catastrophic injury type to be chosen.
   */
  woundPlan?: WoundConsequencePlan;

  woundResolution?: WoundResolutionResult;
}

/**
 * Resolves a standard humanoid Mythras hit from an already-rolled
 * hit-location result through armor, location HP, wound severity,
 * and wound consequences.
 *
 * This is an orchestration function. The individual rule modules
 * remain responsible for the actual rules.
 *
 * This function does not mutate Atlas state and does not roll dice.
 */
export function resolveHumanoidHit(
  input: ResolveHumanoidHitInput,
): HumanoidHitResolutionResult {
  if (input.locationHealth.system !== 'mythras') {
    throw new Error(
      `resolveHumanoidHit requires Mythras location health. Received system: ${input.locationHealth.system}`,
    );
  }

  if (
    !Number.isInteger(input.locationRoll) ||
    input.locationRoll < 1 ||
    input.locationRoll > input.locationHealth.die
  ) {
    throw new RangeError(
      `Hit location roll must be an integer from 1 to ${input.locationHealth.die}. Received: ${input.locationRoll}`,
    );
  }

  const location =
    input.locationHealth.locations.find(
      (candidate) =>
        input.locationRoll >= candidate.roll.min &&
        input.locationRoll <= candidate.roll.max,
    );

  if (!location) {
    throw new Error(
      `No hit location contains roll ${input.locationRoll}.`,
    );
  }

  const damage = resolveLocationDamage({
    currentHp: location.hp.current,
    maxHp: location.hp.max,
    incomingDamage: input.incomingDamage,
    armorPoints: location.armor,
  });

  const updatedLocation: HitLocationState = {
    ...location,
    hp: {
      ...location.hp,
      current: damage.currentHp,
    },
  };
  const enduranceSkill = input.enduranceSkill;
  const enduranceRoll = input.enduranceRoll;

  const hasEnduranceSkill =
    enduranceSkill !== undefined;

  const hasEnduranceRoll =
    enduranceRoll !== undefined;

  if (hasEnduranceSkill !== hasEnduranceRoll) {
    throw new Error(
      'Provide both enduranceSkill and enduranceRoll, or omit both.',
    );
  }
  
  /*
   * A Major limb wound requires its catastrophic injury form
   * before the complete wound consequence plan can be built.
   */
  if (damage.woundSeverity === 'major') {
    const region =
      classifyHumanoidWoundRegion(location);

    if (
      region.region === 'limb' &&
      !input.majorLimbInjuryType
    ) {
      return {
        status: 'pending-major-limb-injury',
        location,
        updatedLocation,
        damage,
      };
    }
  }

  const woundPlan =
  buildHumanoidWoundConsequencePlan({
    severity: damage.woundSeverity,
    location,
    hpDamage: damage.hpDamage,
    healingRate: input.healingRate,
    ...(input.majorLimbInjuryType !== undefined
      ? {
          majorLimbInjuryType:
            input.majorLimbInjuryType,
        }
      : {}),
  });

const woundResolution =
  resolveWoundConsequencePlan({
    plan: woundPlan,
    ...(enduranceSkill !== undefined &&
    enduranceRoll !== undefined
      ? {
          opposedRoll: {
            attackSkill: input.attackSkill,
            attackRoll: input.attackRoll,
            enduranceSkill,
            enduranceRoll,
          },
        }
      : {}),
  });

  return {
    status: woundResolution.status,
    location,
    updatedLocation,
    damage,
    woundPlan,
    woundResolution,
  };
}