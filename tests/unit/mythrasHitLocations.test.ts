import { describe, expect, it } from 'vitest';

import {
  MYTHRAS_HUMANOID_HIT_LOCATIONS,
  resolveHitLocation,
} from '../../src/app/gameSystems/mythras/mythrasHitLocations';

describe('Mythras humanoid hit locations', () => {
  it('contains seven locations', () => {
    expect(MYTHRAS_HUMANOID_HIT_LOCATIONS).toHaveLength(7);
  });

  it.each([
    [1, 'right-leg'],
    [2, 'right-leg'],
    [3, 'right-leg'],

    [4, 'left-leg'],
    [5, 'left-leg'],
    [6, 'left-leg'],

    [7, 'abdomen'],
    [8, 'abdomen'],
    [9, 'abdomen'],

    [10, 'chest'],
    [11, 'chest'],
    [12, 'chest'],

    [13, 'right-arm'],
    [14, 'right-arm'],
    [15, 'right-arm'],

    [16, 'left-arm'],
    [17, 'left-arm'],
    [18, 'left-arm'],

    [19, 'head'],
    [20, 'head'],
  ])('resolves roll %i to %s', (roll, expectedId) => {
    expect(resolveHitLocation(roll)?.id).toBe(expectedId);
  });

  it('returns undefined for rolls outside the table', () => {
    expect(resolveHitLocation(0)).toBeUndefined();
    expect(resolveHitLocation(21)).toBeUndefined();
  });

  it('returns undefined for non-integer rolls', () => {
    expect(resolveHitLocation(14.5)).toBeUndefined();
  });

  it('covers every d20 result exactly once with no gaps or overlaps', () => {
  for (let roll = 1; roll <= 20; roll += 1) {
    const matchingLocations = MYTHRAS_HUMANOID_HIT_LOCATIONS.filter(
      (location) =>
        roll >= location.roll.min &&
        roll <= location.roll.max,
    );

    expect(matchingLocations).toHaveLength(1);
  }
  });
});