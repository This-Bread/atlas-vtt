import type {
  HitLocationDefinition,
  LocationHealthState,
} from '../../types/locationHealthTypes';

/**
 * Standard Mythras humanoid hit-location die.
 */
export const MYTHRAS_HUMANOID_HIT_LOCATION_DIE = 20;

/**
 * Stable identifier for the standard Mythras humanoid anatomy.
 */
export const MYTHRAS_HUMANOID_ANATOMY_ID =
  'mythras-humanoid';

/**
 * Standard Mythras humanoid d20 hit-location table.
 *
 * This is the canonical definition of:
 *
 * - location ids
 * - display names
 * - hit-location roll ranges
 * - broad anatomical categories
 *
 * Runtime HP, armor, disabled, and severed state do not belong here.
 */
export const MYTHRAS_HUMANOID_HIT_LOCATIONS = [
  {
    id: 'right-leg',
    name: 'Right Leg',
    roll: {
      min: 1,
      max: 3,
    },
    category: 'leg',
  },
  {
    id: 'left-leg',
    name: 'Left Leg',
    roll: {
      min: 4,
      max: 6,
    },
    category: 'leg',
  },
  {
    id: 'abdomen',
    name: 'Abdomen',
    roll: {
      min: 7,
      max: 9,
    },
    category: 'torso',
  },
  {
    id: 'chest',
    name: 'Chest',
    roll: {
      min: 10,
      max: 12,
    },
    category: 'torso',
  },
  {
    id: 'right-arm',
    name: 'Right Arm',
    roll: {
      min: 13,
      max: 15,
    },
    category: 'arm',
  },
  {
    id: 'left-arm',
    name: 'Left Arm',
    roll: {
      min: 16,
      max: 18,
    },
    category: 'arm',
  },
  {
    id: 'head',
    name: 'Head',
    roll: {
      min: 19,
      max: 20,
    },
    category: 'head',
  },
] as const satisfies readonly HitLocationDefinition[];

/**
 * Options used when creating runtime health state for a standard
 * Mythras humanoid.
 *
 * hitPoints is deliberately uniform for now. The permanent character
 * initialization system will later calculate the correct HP for each
 * location from the character's Mythras characteristics.
 */
export interface CreateMythrasHumanoidLocationHealthOptions {
  hitPoints: number;
  armor?: number;
}

/**
 * Creates a fresh runtime location-health state for a standard
 * Mythras humanoid.
 *
 * Every call returns independent objects so changing one character's
 * HP or wound flags cannot mutate the canonical anatomy definition or
 * another character's health state.
 */
export function createMythrasHumanoidLocationHealth(
  options: CreateMythrasHumanoidLocationHealthOptions,
): LocationHealthState {
  const {
    hitPoints,
    armor = 0,
  } = options;

  if (
    !Number.isFinite(hitPoints) ||
    hitPoints <= 0
  ) {
    throw new Error(
      'Mythras humanoid location hit points must be greater than zero.',
    );
  }

  if (
    !Number.isFinite(armor) ||
    armor < 0
  ) {
    throw new Error(
      'Mythras humanoid armor must be zero or greater.',
    );
  }

  return {
    system: 'mythras',
    die: MYTHRAS_HUMANOID_HIT_LOCATION_DIE,
    anatomyId: MYTHRAS_HUMANOID_ANATOMY_ID,

    locations:
      MYTHRAS_HUMANOID_HIT_LOCATIONS.map(
        (location) => ({
          id: location.id,
          name: location.name,

          roll: {
            min: location.roll.min,
            max: location.roll.max,
          },

          category: location.category,

          hp: {
            current: hitPoints,
            max: hitPoints,
          },

          armor,
        }),
      ),
  };
}

/**
 * Finds the hit location containing the supplied die roll.
 *
 * Returns undefined when no location contains that roll.
 */
export function resolveHitLocation(
  roll: number,
  locations:
    readonly HitLocationDefinition[] =
      MYTHRAS_HUMANOID_HIT_LOCATIONS,
): HitLocationDefinition | undefined {
  if (!Number.isInteger(roll)) {
    return undefined;
  }

  return locations.find(
    (location) =>
      roll >= location.roll.min &&
      roll <= location.roll.max,
  );
}