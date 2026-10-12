import type { HitLocationDefinition } from '../../types/locationHealthTypes';

/**
 * Standard Mythras humanoid hit-location die.
 */
export const MYTHRAS_HUMANOID_HIT_LOCATION_DIE = 20;

/**
 * Standard Mythras humanoid d20 hit-location table.
 */
export const MYTHRAS_HUMANOID_HIT_LOCATIONS = [
  {
    id: 'right-leg',
    name: 'Right Leg',
    roll: { min: 1, max: 3 },
    category: 'leg',
  },
  {
    id: 'left-leg',
    name: 'Left Leg',
    roll: { min: 4, max: 6 },
    category: 'leg',
  },
  {
    id: 'abdomen',
    name: 'Abdomen',
    roll: { min: 7, max: 9 },
    category: 'torso',
  },
  {
    id: 'chest',
    name: 'Chest',
    roll: { min: 10, max: 12 },
    category: 'torso',
  },
  {
    id: 'right-arm',
    name: 'Right Arm',
    roll: { min: 13, max: 15 },
    category: 'arm',
  },
  {
    id: 'left-arm',
    name: 'Left Arm',
    roll: { min: 16, max: 18 },
    category: 'arm',
  },
  {
    id: 'head',
    name: 'Head',
    roll: { min: 19, max: 20 },
    category: 'head',
  },
] as const satisfies readonly HitLocationDefinition[];

/**
 * Finds the hit location containing the supplied die roll.
 *
 * Returns undefined when no location contains that roll.
 */
export function resolveHitLocation(
  roll: number,
  locations: readonly HitLocationDefinition[] = MYTHRAS_HUMANOID_HIT_LOCATIONS,
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