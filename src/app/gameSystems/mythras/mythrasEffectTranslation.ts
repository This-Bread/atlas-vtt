import type {
  HitLocationState,
} from '../../types/locationHealthTypes';

import type {
  MajorLimbInjuryType,
  MythrasWoundEffect,
} from './mythrasWounds';

export type MythrasPersistentCondition =
  | 'prone'
  | 'unconscious'
  | 'incapacitated'
  | 'dead';

export type MythrasCombatTimeUnit =
  | 'turns'
  | 'combat-rounds'
  | 'minutes';

export type MythrasTimedEffect =
  | {
      type: 'unconscious';
      locationId: string;
      amount: number;
      unit: 'minutes';
    }
  | {
      type: 'treatment-deadline';
      locationId: string;
      amount: number;
      unit: 'minutes' | 'combat-rounds';
      consequence: 'death';
    };

export type MythrasCombatInstruction =
  | {
      type: 'permanent-scar';
      locationId: string;
    }
  | {
      type: 'stunned-or-distracted';
      locationId: string;
      durationRoll: '1d3';
      unit: 'turns';
      cannotAttack: true;
      cannotStartCasting: true;
      canParry: true;
      canEvade: true;
    }
  | {
      type: 'gm-location-use-penalty';
      locationId: string;
      difficultyGrades: number;
      until: 'minor-wound';
    }
  | {
      type: 'drop-held-item';
      locationId: string;
      unlessStrapped: true;
    }
  | {
      type: 'catastrophic-limb-injury';
      locationId: string;
      injuryType: MajorLimbInjuryType;
    }
  | {
      type:
        'first-aid-or-healing-may-restore-consciousness';
      locationId: string;
    }
  | {
      type:
        'cannot-rejoin-combat-until-further-healing';
      locationId: string;
    }
  | {
      type: 'treatment-deadline';
      locationId: string;
      amount: number;
      unit: 'minutes' | 'combat-rounds';
      consequence: 'death';
    };

export interface TranslateMythrasWoundEffectsInput {
  /**
   * The location after HP damage has already been resolved.
   * The translator may add persistent anatomical flags such
   * as disabled or severed.
   */
  updatedLocation: HitLocationState;

  /**
   * Final effects produced by wound resolution.
   */
  effects: readonly MythrasWoundEffect[];
}

export interface MythrasEffectTranslation {
  /**
   * Copy of updatedLocation with persistent anatomical
   * consequences applied.
   */
  updatedLocation: HitLocationState;

  /**
   * Semantic conditions. Atlas IDs are assigned later by
   * MythrasCombatService.
   */
  persistentConditions:
    readonly MythrasPersistentCondition[];

  /**
   * Effects whose duration is already numerically known.
   * These are not persisted yet.
   */
  timedEffects:
    readonly MythrasTimedEffect[];

  /**
   * Structured consequences requiring UI, GM action,
   * another roll, or a future subsystem.
   */
  instructions:
    readonly MythrasCombatInstruction[];
}

export function translateMythrasWoundEffects(
  input: TranslateMythrasWoundEffectsInput,
): MythrasEffectTranslation {
  const updatedLocation: HitLocationState = {
    ...input.updatedLocation,
    roll: {
      ...input.updatedLocation.roll,
    },
    hp: {
      ...input.updatedLocation.hp,
    },
  };

  const persistentConditions =
    new Set<MythrasPersistentCondition>();

  const timedEffects: MythrasTimedEffect[] = [];

  const instructions:
    MythrasCombatInstruction[] = [];

  for (const effect of input.effects) {
    switch (effect.type) {
      case 'permanent-scar':
        instructions.push({
          type: 'permanent-scar',
          locationId: updatedLocation.id,
        });
        break;

      case 'stunned-or-distracted':
        instructions.push({
          type: 'stunned-or-distracted',
          locationId: updatedLocation.id,
          durationRoll: effect.durationRoll,
          unit: effect.unit,
          cannotAttack: effect.cannotAttack,
          cannotStartCasting:
            effect.cannotStartCasting,
          canParry: effect.canParry,
          canEvade: effect.canEvade,
        });
        break;

      case 'gm-location-use-penalty':
        instructions.push({
          type: 'gm-location-use-penalty',
          locationId: updatedLocation.id,
          difficultyGrades:
            effect.difficultyGrades,
          until: effect.until,
        });
        break;

      case 'disable-location':
        updatedLocation.disabled = true;
        break;

      case 'drop-held-item':
        instructions.push({
          type: 'drop-held-item',
          locationId: updatedLocation.id,
          unlessStrapped: effect.unlessStrapped,
        });
        break;

      case 'fall-prone':
        persistentConditions.add('prone');
        break;

      case 'unconscious':
        persistentConditions.add('unconscious');

        if (effect.duration) {
          timedEffects.push({
            type: 'unconscious',
            locationId: updatedLocation.id,
            amount: effect.duration.amount,
            unit: effect.duration.unit,
          });
        }

        break;

      case 'incapacitated':
        persistentConditions.add(
          'incapacitated',
        );
        break;

      case 'catastrophic-limb-injury':
        updatedLocation.disabled = true;

        if (
          effect.injuryType === 'severed' ||
          effect.injuryType === 'ripped-off'
        ) {
          updatedLocation.severed = true;
        }

        instructions.push({
          type: 'catastrophic-limb-injury',
          locationId: updatedLocation.id,
          injuryType: effect.injuryType,
        });

        break;

      case 'first-aid-or-healing-may-restore-consciousness':
        instructions.push({
          type:
            'first-aid-or-healing-may-restore-consciousness',
          locationId: updatedLocation.id,
        });
        break;

      case 'cannot-rejoin-combat-until-further-healing':
        instructions.push({
          type:
            'cannot-rejoin-combat-until-further-healing',
          locationId: updatedLocation.id,
        });
        break;

      case 'treatment-deadline':
        timedEffects.push({
          type: 'treatment-deadline',
          locationId: updatedLocation.id,
          amount: effect.amount,
          unit: effect.unit,
          consequence: effect.consequence,
        });

        instructions.push({
          type: 'treatment-deadline',
          locationId: updatedLocation.id,
          amount: effect.amount,
          unit: effect.unit,
          consequence: effect.consequence,
        });

        break;

      case 'death':
        persistentConditions.add('dead');
        break;
    }
  }

  return {
    updatedLocation,
    persistentConditions: [
      ...persistentConditions,
    ],
    timedEffects,
    instructions,
  };
}