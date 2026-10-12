import { describe, expect, it } from 'vitest';

import {
  MYTHRAS_HUMANOID_HIT_LOCATION_DIE,
  MYTHRAS_HUMANOID_HIT_LOCATIONS,
  createMythrasHumanoidLocationHealth,
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

describe(
  'createMythrasHumanoidLocationHealth',
  () => {
    it(
      'creates the canonical Mythras humanoid location health state',
      () => {
        const health =
          createMythrasHumanoidLocationHealth({
            hitPoints: 5,
          });

        expect(health).toMatchObject({
          system: 'mythras',
          die: 20,
          anatomyId: 'mythras-humanoid',
        });

        expect(
          health.locations,
        ).toHaveLength(7);
      },
    );

    it(
      'creates all humanoid locations with the correct ranges and categories',
      () => {
        const health =
          createMythrasHumanoidLocationHealth({
            hitPoints: 5,
          });

        expect(
          health.locations.map(
            ({
              id,
              name,
              roll,
              category,
            }) => ({
              id,
              name,
              roll,
              category,
            }),
          ),
        ).toEqual([
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
        ]);
      },
    );

    it(
      'initializes every location with the requested hit points and armor',
      () => {
        const health =
          createMythrasHumanoidLocationHealth({
            hitPoints: 6,
            armor: 3,
          });

        for (
          const location
          of health.locations
        ) {
          expect(
            location.hp,
          ).toEqual({
            current: 6,
            max: 6,
          });

          expect(
            location.armor,
          ).toBe(3);
        }
      },
    );

    it(
      'defaults armor to zero',
      () => {
        const health =
          createMythrasHumanoidLocationHealth({
            hitPoints: 5,
          });

        expect(
          health.locations.every(
            (location) =>
              location.armor === 0,
          ),
        ).toBe(true);
      },
    );

    it(
      'creates independent mutable state for separate characters',
      () => {
        const first =
          createMythrasHumanoidLocationHealth({
            hitPoints: 5,
          });

        const second =
          createMythrasHumanoidLocationHealth({
            hitPoints: 5,
          });

        const firstRightLeg =
          first.locations.find(
            (location) =>
              location.id === 'right-leg',
          );

        const secondRightLeg =
          second.locations.find(
            (location) =>
              location.id === 'right-leg',
          );

        expect(firstRightLeg).toBeDefined();
        expect(secondRightLeg).toBeDefined();

        firstRightLeg!.hp.current = -5;
        firstRightLeg!.disabled = true;
        firstRightLeg!.severed = true;

        expect(
          secondRightLeg!.hp.current,
        ).toBe(5);

        expect(
          secondRightLeg!.disabled,
        ).toBeUndefined();

        expect(
          secondRightLeg!.severed,
        ).toBeUndefined();
      },
    );

    it(
      'does not mutate the canonical humanoid definition when runtime state changes',
      () => {
        const health =
          createMythrasHumanoidLocationHealth({
            hitPoints: 5,
          });

        const rightLeg =
          health.locations.find(
            (location) =>
              location.id === 'right-leg',
          );

        expect(rightLeg).toBeDefined();

        rightLeg!.roll.min = 99;
        rightLeg!.hp.current = -5;

        const canonicalRightLeg =
          MYTHRAS_HUMANOID_HIT_LOCATIONS.find(
            (location) =>
              location.id === 'right-leg',
          );

        expect(
          canonicalRightLeg?.roll.min,
        ).toBe(1);
      },
    );

    it(
      'rejects zero or negative hit points',
      () => {
        expect(() =>
          createMythrasHumanoidLocationHealth({
            hitPoints: 0,
          }),
        ).toThrow(
          'Mythras humanoid location hit points must be greater than zero.',
        );

        expect(() =>
          createMythrasHumanoidLocationHealth({
            hitPoints: -1,
          }),
        ).toThrow(
          'Mythras humanoid location hit points must be greater than zero.',
        );
      },
    );

    it(
      'rejects invalid armor values',
      () => {
        expect(() =>
          createMythrasHumanoidLocationHealth({
            hitPoints: 5,
            armor: -1,
          }),
        ).toThrow(
          'Mythras humanoid armor must be zero or greater.',
        );
      },
    );

    it(
      'rejects non-finite hit points and armor',
      () => {
        expect(() =>
          createMythrasHumanoidLocationHealth({
            hitPoints: Number.NaN,
          }),
        ).toThrow();

        expect(() =>
          createMythrasHumanoidLocationHealth({
            hitPoints: Number.POSITIVE_INFINITY,
          }),
        ).toThrow();

        expect(() =>
          createMythrasHumanoidLocationHealth({
            hitPoints: 5,
            armor: Number.NaN,
          }),
        ).toThrow();

        expect(() =>
          createMythrasHumanoidLocationHealth({
            hitPoints: 5,
            armor:
              Number.POSITIVE_INFINITY,
          }),
        ).toThrow();
      },
    );
  },
);