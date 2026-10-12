import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  HitLocationState,
} from '../../src/app/types/locationHealthTypes';

import {
  translateMythrasWoundEffects,
} from '../../src/app/gameSystems/mythras/mythrasEffectTranslation';

function makeRightArm(): HitLocationState {
  return {
    id: 'right-arm',
    name: 'Right Arm',
    roll: {
      min: 13,
      max: 15,
    },
    category: 'arm',
    hp: {
      current: 0,
      max: 5,
    },
    armor: 2,
  };
}

describe(
  'translateMythrasWoundEffects',
  () => {
    it(
      'returns an unchanged copy when there are no effects',
      () => {
        const location = makeRightArm();

        const result =
          translateMythrasWoundEffects({
            updatedLocation: location,
            effects: [],
          });

        expect(result).toEqual({
          updatedLocation: location,
          persistentConditions: [],
          timedEffects: [],
          instructions: [],
        });

        expect(
          result.updatedLocation,
        ).not.toBe(location);

        expect(
          result.updatedLocation.hp,
        ).not.toBe(location.hp);

        expect(
          result.updatedLocation.roll,
        ).not.toBe(location.roll);
      },
    );
        it(
      'marks the location disabled',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type:
                  'disable-location',
                until: 'positive-hp',
              },
            ],
          });

        expect(
          result.updatedLocation.disabled,
        ).toBe(true);

        expect(
          result.persistentConditions,
        ).toEqual([]);

        expect(
          result.instructions,
        ).toEqual([]);
      },
    );
        it(
      'persists a severed catastrophic limb injury',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type:
                  'catastrophic-limb-injury',
                injuryType: 'severed',
              },
            ],
          });

        expect(
          result.updatedLocation.disabled,
        ).toBe(true);

        expect(
          result.updatedLocation.severed,
        ).toBe(true);

        expect(
          result.instructions,
        ).toEqual([
          {
            type:
              'catastrophic-limb-injury',
            locationId: 'right-arm',
            injuryType: 'severed',
          },
        ]);
      },
    );

        it(
      'does not mark a shattered limb as severed',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type:
                  'catastrophic-limb-injury',
                injuryType: 'shattered',
              },
            ],
          });

        expect(
          result.updatedLocation.disabled,
        ).toBe(true);

        expect(
          result.updatedLocation.severed,
        ).not.toBe(true);

        expect(
          result.instructions[0],
        ).toEqual({
          type:
            'catastrophic-limb-injury',
          locationId: 'right-arm',
          injuryType: 'shattered',
        });
      },
    );

        it(
      'translates persistent global states into semantic conditions',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type: 'fall-prone',
              },
              {
                type: 'incapacitated',
              },
              {
                type: 'death',
              },
            ],
          });

        expect(
          result.persistentConditions,
        ).toEqual([
          'prone',
          'incapacitated',
          'dead',
        ]);
      },
    );

        it(
      'does not duplicate persistent conditions',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type: 'fall-prone',
              },
              {
                type: 'fall-prone',
              },
            ],
          });

        expect(
          result.persistentConditions,
        ).toEqual([
          'prone',
        ]);
      },
    );

        it(
      'creates a timed unconscious effect when duration is known',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type: 'unconscious',
                duration: {
                  amount: 4,
                  unit: 'minutes',
                },
              },
            ],
          });

        expect(
          result.persistentConditions,
        ).toEqual([
          'unconscious',
        ]);

        expect(
          result.timedEffects,
        ).toEqual([
          {
            type: 'unconscious',
            locationId: 'right-arm',
            amount: 4,
            unit: 'minutes',
          },
        ]);
      },
    );

        it(
      'does not invent a timer for indefinite unconsciousness',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type: 'unconscious',
              },
            ],
          });

        expect(
          result.persistentConditions,
        ).toEqual([
          'unconscious',
        ]);

        expect(
          result.timedEffects,
        ).toEqual([]);
      },
    );

        it(
      'returns stunned or distracted as an instruction until its duration is rolled',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type:
                  'stunned-or-distracted',
                durationRoll: '1d3',
                unit: 'turns',
                cannotAttack: true,
                cannotStartCasting: true,
                canParry: true,
                canEvade: true,
              },
            ],
          });

        expect(
          result.timedEffects,
        ).toEqual([]);

        expect(
          result.instructions,
        ).toEqual([
          {
            type:
              'stunned-or-distracted',
            locationId: 'right-arm',
            durationRoll: '1d3',
            unit: 'turns',
            cannotAttack: true,
            cannotStartCasting: true,
            canParry: true,
            canEvade: true,
          },
        ]);
      },
    );

        it(
      'creates timed state and an instruction for a treatment deadline',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type:
                  'treatment-deadline',
                amount: 10,
                unit: 'minutes',
                consequence: 'death',
              },
            ],
          });

        const expected = {
          type:
            'treatment-deadline' as const,
          locationId: 'right-arm',
          amount: 10,
          unit: 'minutes' as const,
          consequence: 'death' as const,
        };

        expect(
          result.timedEffects,
        ).toEqual([
          expected,
        ]);

        expect(
          result.instructions,
        ).toEqual([
          expected,
        ]);
      },
    );

        it(
      'preserves non-persistent wound consequences as structured instructions',
      () => {
        const result =
          translateMythrasWoundEffects({
            updatedLocation:
              makeRightArm(),
            effects: [
              {
                type: 'permanent-scar',
              },
              {
                type:
                  'gm-location-use-penalty',
                difficultyGrades: 1,
                until: 'minor-wound',
              },
              {
                type:
                  'drop-held-item',
                unlessStrapped: true,
              },
              {
                type:
                  'first-aid-or-healing-may-restore-consciousness',
              },
              {
                type:
                  'cannot-rejoin-combat-until-further-healing',
              },
            ],
          });

        expect(
          result.instructions,
        ).toEqual([
          {
            type: 'permanent-scar',
            locationId: 'right-arm',
          },
          {
            type:
              'gm-location-use-penalty',
            locationId: 'right-arm',
            difficultyGrades: 1,
            until: 'minor-wound',
          },
          {
            type: 'drop-held-item',
            locationId: 'right-arm',
            unlessStrapped: true,
          },
          {
            type:
              'first-aid-or-healing-may-restore-consciousness',
            locationId: 'right-arm',
          },
          {
            type:
              'cannot-rejoin-combat-until-further-healing',
            locationId: 'right-arm',
          },
        ]);
      },
    );

    it(
  'never clears an existing severed flag',
  () => {
    const location: HitLocationState = {
      ...makeRightArm(),
      severed: true,
    };

    const result =
      translateMythrasWoundEffects({
        updatedLocation: location,
        effects: [
          {
            type:
              'catastrophic-limb-injury',
            injuryType: 'transfixed',
          },
        ],
      });

    expect(
      result.updatedLocation.severed,
    ).toBe(true);
  },
);
  },
);