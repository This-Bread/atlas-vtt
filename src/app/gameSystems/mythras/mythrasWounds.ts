import type { HitLocationDefinition } from '../../types/locationHealthTypes';
import type { WoundSeverity } from './mythrasDamage';

/**
 * How the standard humanoid wound rules treat a location.
 */
export type MythrasHumanoidWoundRegion =
  | 'limb'
  | 'vital';

export type MythrasHumanoidLimbKind =
  | 'arm'
  | 'leg';

export type MajorLimbInjuryType =
  | 'severed'
  | 'transfixed'
  | 'shattered'
  | 'ripped-off';

  /**
 * An instruction produced by the pure Mythras rules engine.
 *
 * These effects describe what should happen. They do not directly
 * modify Atlas token state.
 */
export type MythrasWoundEffect =
  | {
      type: 'permanent-scar';
    }
  | {
      type: 'stunned-or-distracted';
      durationRoll: '1d3';
      unit: 'turns';
      cannotAttack: true;
      cannotStartCasting: true;
      canParry: true;
      canEvade: true;
    }
  | {
      type: 'gm-location-use-penalty';
      difficultyGrades: 1;
      until: 'minor-wound';
    }
  | {
      type: 'disable-location';
      until: 'positive-hp';
    }
  | {
      type: 'drop-held-item';
      unlessStrapped: true;
    }
  | {
      type: 'fall-prone';
    }
  | {
      type: 'unconscious';
      duration?: {
        amount: number;
        unit: 'minutes';
      };
    }
  | {
      type: 'incapacitated';
    }
  | {
    type: 'catastrophic-limb-injury';
    injuryType: MajorLimbInjuryType;
    }
  | {
      type: 'first-aid-or-healing-may-restore-consciousness';
    }
  | {
      type: 'cannot-rejoin-combat-until-further-healing';
    }
  | {
      type: 'treatment-deadline';
      amount: number;
      unit: 'minutes' | 'combat-rounds';
      consequence: 'death';
    }
  | {
      type: 'death';
    };

/**
 * Mythras Serious and Major Wounds call for an opposed
 * Endurance test against the successful attack roll.
 *
 * The actual opposed-roll calculation belongs in a general
 * Mythras roll-resolution system, not in the wound module.
 */
export interface OpposedEnduranceTestInstruction {
  skill: 'Endurance';
  versus: 'successful-attack-roll';
  timing: 'immediate';
  repeatOnlyIfLocationWoundedAgain: true;
}

/**
 * Describes the complete consequence flow for a wound.
 *
 * The caller applies immediateEffects, performs the Endurance
 * test if one is required, and then applies the appropriate
 * outcome effects.
 */
export interface WoundConsequencePlan {
  severity: WoundSeverity;
  locationId: string;

  immediateEffects: MythrasWoundEffect[];

  enduranceTest?: OpposedEnduranceTestInstruction;

  onEnduranceWin: MythrasWoundEffect[];
  onEnduranceLoss: MythrasWoundEffect[];
}

export interface HumanoidWoundConsequenceInput {
  severity: WoundSeverity;

  location: HitLocationDefinition;

  /**
   * HP damage actually sustained from the attack after armor.
   *
   * This is used for Serious Wounds to the abdomen, chest,
   * or head, where failed Endurance causes unconsciousness
   * for this many minutes.
   */
  hpDamage: number;

  /**
   * Character's Mythras Healing Rate.
   */
  healingRate: number;

  /**
   * Major limb wounds can take several catastrophic forms.
   *
   * Set this to true when the narrated wound involves
   * life-threatening bleeding requiring treatment.
   *
   * It is deliberately separate from severity because not
   * every Major limb injury should automatically mean that
   * the limb was literally severed.
   */
  /**
   * Required when resolving a Major Wound to a limb.
   *
   * The selected injury determines the wound description and
   * whether the standard blood-loss treatment deadline applies.
   */
  majorLimbInjuryType?: MajorLimbInjuryType;
}

const OPPOSED_ENDURANCE_TEST: OpposedEnduranceTestInstruction = {
  skill: 'Endurance',
  versus: 'successful-attack-roll',
  timing: 'immediate',
  repeatOnlyIfLocationWoundedAgain: true,
};

/**
 * Classifies a standard humanoid location for wound rules.
 */
export function classifyHumanoidWoundRegion(
  location: HitLocationDefinition,
):
  | {
      region: 'limb';
      limbKind: MythrasHumanoidLimbKind;
    }
  | {
      region: 'vital';
      limbKind: null;
    } {
  switch (location.category) {
    case 'arm':
      return {
        region: 'limb',
        limbKind: 'arm',
      };

    case 'leg':
      return {
        region: 'limb',
        limbKind: 'leg',
      };

    case 'head':
    case 'torso':
      return {
        region: 'vital',
        limbKind: null,
      };

    default:
      throw new Error(
        `Unsupported humanoid wound location category: ${location.category ?? 'undefined'}`,
      );
  }
}
/**
 * Determines whether a catastrophic limb injury uses the
 * Major Wound blood-loss treatment deadline.
 */
export function majorLimbInjuryRequiresUrgentTreatment(
  injuryType: MajorLimbInjuryType,
): boolean {
  return (
    injuryType === 'severed' ||
    injuryType === 'transfixed' ||
    injuryType === 'ripped-off'
  );
}

/**
 * Creates the Serious/Major Wound consequence plan for a
 * standard Mythras humanoid.
 *
 * This function describes rules consequences only. It does
 * not mutate Atlas state and does not roll dice.
 */
export function buildHumanoidWoundConsequencePlan(
  input: HumanoidWoundConsequenceInput,
): WoundConsequencePlan {
  const plan: WoundConsequencePlan = {
    severity: input.severity,
    locationId: input.location.id,
    immediateEffects: [],
    onEnduranceWin: [],
    onEnduranceLoss: [],
  };

  if (
    input.severity === 'none' ||
    input.severity === 'minor'
  ) {
    return plan;
  }

  const location = classifyHumanoidWoundRegion(
    input.location,
  );

  if (input.severity === 'serious') {
    plan.immediateEffects.push(
      {
        type: 'permanent-scar',
      },
      {
        type: 'stunned-or-distracted',
        durationRoll: '1d3',
        unit: 'turns',
        cannotAttack: true,
        cannotStartCasting: true,
        canParry: true,
        canEvade: true,
      },
      {
        type: 'gm-location-use-penalty',
        difficultyGrades: 1,
        until: 'minor-wound',
      },
    );

    plan.enduranceTest = OPPOSED_ENDURANCE_TEST;

    if (location.region === 'limb') {
      plan.onEnduranceLoss.push({
        type: 'disable-location',
        until: 'positive-hp',
      });

      if (location.limbKind === 'arm') {
        plan.onEnduranceLoss.push({
          type: 'drop-held-item',
          unlessStrapped: true,
        });
      }

      if (location.limbKind === 'leg') {
        plan.onEnduranceLoss.push({
          type: 'fall-prone',
        });
      }

      return plan;
    }

    plan.onEnduranceLoss.push(
      {
        type: 'unconscious',
        duration: {
          amount: input.hpDamage,
          unit: 'minutes',
        },
      },
      {
        type: 'first-aid-or-healing-may-restore-consciousness',
      },
      {
        type: 'cannot-rejoin-combat-until-further-healing',
      },
    );

    return plan;
  }

  /*
   * Major Wound
   */

  plan.enduranceTest = OPPOSED_ENDURANCE_TEST;

  if (location.region === 'limb') {
  if (!input.majorLimbInjuryType) {
    throw new Error(
      'Major limb wounds require a majorLimbInjuryType.',
    );
  }

  plan.immediateEffects.push(
    {
      type: 'incapacitated',
    },
    {
      type: 'fall-prone',
    },
    {
      type: 'catastrophic-limb-injury',
      injuryType: input.majorLimbInjuryType,
    },
  );

  if (
    majorLimbInjuryRequiresUrgentTreatment(
      input.majorLimbInjuryType,
    )
  ) {
    plan.immediateEffects.push({
      type: 'treatment-deadline',
      amount: input.healingRate * 5,
      unit: 'minutes',
      consequence: 'death',
    });
  }

  plan.onEnduranceLoss.push({
    type: 'unconscious',
  });

  return plan;
}

  /*
   * Major Wound to abdomen, chest, or head.
   */
  plan.immediateEffects.push(
    {
      type: 'unconscious',
    },
    {
      type: 'incapacitated',
    },
    {
      type: 'treatment-deadline',
      amount: input.healingRate * 2,
      unit: 'combat-rounds',
      consequence: 'death',
    },
  );

  plan.onEnduranceLoss.push({
    type: 'death',
  });

  return plan;
}