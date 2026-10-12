import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  Character,
  TokenEntity,
} from '../../src/app/types';

import type {
  TokenUpdates,
} from '../../src/app/types/viewState';

import {
  MythrasCombatService,
  type MythrasCombatStore,
  type ResolveAndApplyMythrasHitInput,
} from '../../src/app/services/MythrasCombatService';

import {
  createViewAtlasStore,
} from '../../src/app/storeFactory';

import {
  getHistoryStore,
} from '../../src/app/stores/history';

import {
  createInMemoryApp,
} from '../mocks/inMemoryVault';

function makeCharacter(): Character {
  return {
    id: 'target',
    kind: 'character',
    name: 'Test Fighter',
    x: 0,
    y: 0,
    imagePath: 'fighter.png',

    locationHealth: {
      system: 'mythras',
      die: 20,
      anatomyId: 'mythras-humanoid',
      locations: [
        {
          id: 'right-arm',
          name: 'Right Arm',
          roll: {
            min: 13,
            max: 15,
          },
          category: 'arm',
          hp: {
            current: 5,
            max: 5,
          },
          armor: 0,
        },
      ],
    },
  };
}
function makeLegCharacter(): Character {
  return {
    id: 'target',
    kind: 'character',
    name: 'Test Fighter',
    x: 0,
    y: 0,
    imagePath: 'fighter.png',

    locationHealth: {
      system: 'mythras',
      die: 20,
      anatomyId: 'mythras-humanoid',
      locations: [
        {
          id: 'right-leg',
          name: 'Right Leg',
          roll: {
            min: 1,
            max: 3,
          },
          category: 'leg',
          hp: {
            current: 5,
            max: 5,
          },
          armor: 0,
        },
      ],
    },
  };
}

function makeBaseHitInput(): Omit<
  ResolveAndApplyMythrasHitInput,
  'tokenId'
> {
  return {
    locationRoll: 14,
    incomingDamage: 1,
    attackSkill: 70,
    attackRoll: 40,
    healingRate: 2,
  };
}

function makeStore(
  startingToken: TokenEntity,
) {
  const tokens: Record<
    string,
    TokenEntity
  > = {
    [startingToken.id]:
      structuredClone(startingToken),
  };

  const updateToken = vi.fn(
    (
      id: string,
      updates: TokenUpdates,
    ) => {
      const token = tokens[id];

      if (!token) return;

      Object.assign(
        token,
        updates,
      );
    },
  );

  const setTokensCondition = vi.fn(
    (
      tokenIds: string[],
      conditionId: string,
      active: boolean,
    ) => {
      for (const tokenId of tokenIds) {
        const token = tokens[tokenId];

        if (!token) continue;

        const current =
          token.conditions ?? [];

        if (active) {
          if (
            !current.includes(
              conditionId,
            )
          ) {
            token.conditions = [
              ...current,
              conditionId,
            ];
          }

          continue;
        }

        token.conditions =
          current.filter(
            (id) =>
              id !== conditionId,
          );
      }
    },
  );

  const state = {
    objects: {
      tokens,
    },
    updateToken,
    setTokensCondition,
  };

  /*
   * The production service deliberately depends on
   * only a narrow slice of ViewAtlasState.
   *
   * The real Atlas objects collection contains more
   * branches than this test needs, so the fake store
   * supplies only the behavior exercised here.
   */
  const store = {
    getState: () => state,
  } as unknown as MythrasCombatStore;

  return {
    store,
    tokens,
    updateToken,
    setTokensCondition,
  };
}

function makeHistoryStore(
  startingCharacter: Character,
) {
  const { app } = createInMemoryApp();

  const store =
    createViewAtlasStore(
      app,
      `mythras-combat-${Math.random()}`,
    );

  store.setState({
    persistenceEnabled: false,

    objects: {
      ...store.getState().objects,

      tokens: {
        [startingCharacter.id]:
          structuredClone(
            startingCharacter,
          ),
      },
    },
  });

  const history =
    getHistoryStore(store);

  if (!history) {
    throw new Error(
      'Expected Atlas history store.',
    );
  }

  /*
   * Seeding the token above is itself a tracked store
   * write. Clear that setup history so the test starts
   * at exactly zero user edits.
   */
  history.getState().clear();

  return {
    store,
    history,
  };
}
function requireCharacter(
  token: TokenEntity | undefined,
): Character {
  if (
    !token ||
    token.kind !== 'character'
  ) {
    throw new Error(
      'Expected test token to be a character.',
    );
  }

  return token;
}

describe(
  'MythrasCombatService',
  () => {
    it(
      'rejects a missing target token',
      () => {
        const fixture =
          makeStore(makeCharacter());

        delete fixture.tokens.target;

        const service =
          new MythrasCombatService(
            fixture.store,
          );

        expect(() =>
          service.resolveAndApplyHit({
            tokenId: 'missing',
            ...makeBaseHitInput(),
          }),
        ).toThrow(
          'Token not found: missing',
        );
      },
    );

    it(
      'rejects a non-character token',
      () => {
        const token: TokenEntity = {
          id: 'target',
          kind: 'token',
          x: 0,
          y: 0,
          imagePath: 'marker.png',
        };

        const fixture =
          makeStore(token);

        const service =
          new MythrasCombatService(
            fixture.store,
          );

        expect(() =>
          service.resolveAndApplyHit({
            tokenId: 'target',
            ...makeBaseHitInput(),
          }),
        ).toThrow(
          'Mythras combat requires a character token.',
        );
      },
    );

    it(
      'rejects a character without location health',
      () => {
        const character =
          makeCharacter();

        delete character.locationHealth;

        const fixture =
          makeStore(character);

        const service =
          new MythrasCombatService(
            fixture.store,
          );

        expect(() =>
          service.resolveAndApplyHit({
            tokenId: 'target',
            ...makeBaseHitInput(),
          }),
        ).toThrow(
          'Character has no location health state.',
        );
      },
    );

    it(
      'rejects non-Mythras location health',
      () => {
        const character =
          makeCharacter();

        if (!character.locationHealth) {
          throw new Error(
            'Expected location health.',
          );
        }

        character.locationHealth.system =
          'other-system';

        const fixture =
          makeStore(character);

        const service =
          new MythrasCombatService(
            fixture.store,
          );

        expect(() =>
          service.resolveAndApplyHit({
            tokenId: 'target',
            ...makeBaseHitInput(),
          }),
        ).toThrow(
          'Character is not using Mythras location health.',
        );
      },
    );

    it(
      'does not mutate Atlas while a Major limb injury type is pending',
      () => {
        const fixture =
          makeStore(makeCharacter());

        const service =
          new MythrasCombatService(
            fixture.store,
          );

        const result =
          service.resolveAndApplyHit({
            tokenId: 'target',
            ...makeBaseHitInput(),
            incomingDamage: 10,
          });

        expect(
          result.resolution.status,
        ).toBe(
          'pending-major-limb-injury',
        );

        expect(result.applied).toBe(
          false,
        );

        expect(
          result.applicationPlan,
        ).toBeNull();

        expect(
          fixture.updateToken,
        ).not.toHaveBeenCalled();

        expect(
          fixture.setTokensCondition,
        ).not.toHaveBeenCalled();

        const character =
          requireCharacter(
            fixture.tokens.target,
          );

        expect(
          character.locationHealth
            ?.locations[0]?.hp.current,
        ).toBe(5);
      },
    );

    it(
      'does not mutate Atlas while an Endurance test is pending',
      () => {
        const fixture =
          makeStore(makeCharacter());

        const service =
          new MythrasCombatService(
            fixture.store,
          );

        const result =
          service.resolveAndApplyHit({
            tokenId: 'target',
            ...makeBaseHitInput(),
            incomingDamage: 5,
          });

        expect(
          result.resolution.status,
        ).toBe(
          'pending-endurance-test',
        );

        expect(result.applied).toBe(
          false,
        );

        /*
         * Serious wounds already have immediate
         * consequences, so a semantic plan exists even
         * though nothing is allowed to mutate Atlas yet.
         */
        expect(
          result.applicationPlan,
        ).not.toBeNull();

        expect(
          fixture.updateToken,
        ).not.toHaveBeenCalled();

        expect(
          fixture.setTokensCondition,
        ).not.toHaveBeenCalled();

        const character =
          requireCharacter(
            fixture.tokens.target,
          );

        expect(
          character.locationHealth
            ?.locations[0]?.hp.current,
        ).toBe(5);
      },
    );

    it(
      'applies a completed Minor wound',
      () => {
        const fixture =
          makeStore(makeCharacter());

        const service =
          new MythrasCombatService(
            fixture.store,
          );

        const result =
          service.resolveAndApplyHit({
            tokenId: 'target',
            ...makeBaseHitInput(),
          });

        expect(
          result.resolution.status,
        ).toBe(
          'complete-no-test',
        );

        expect(result.applied).toBe(
          true,
        );

        expect(
          fixture.updateToken,
        ).toHaveBeenCalledTimes(1);

        expect(
          fixture.setTokensCondition,
        ).not.toHaveBeenCalled();

        const character =
          requireCharacter(
            fixture.tokens.target,
          );

        expect(
          character.locationHealth
            ?.locations[0]?.hp.current,
        ).toBe(4);
      },
    );

    it(
      'persists a disabled arm after a failed Serious-wound Endurance test',
      () => {
        const fixture =
          makeStore(makeCharacter());

        const service =
          new MythrasCombatService(
            fixture.store,
          );

        const result =
          service.resolveAndApplyHit({
            tokenId: 'target',
            ...makeBaseHitInput(),

            incomingDamage: 5,

            enduranceSkill: 60,
            enduranceRoll: 70,
          });

        expect(
          result.resolution.status,
        ).toBe(
          'complete-endurance-loss',
        );

        expect(result.applied).toBe(
          true,
        );

        expect(
          fixture.updateToken,
        ).toHaveBeenCalledTimes(1);

        const character =
          requireCharacter(
            fixture.tokens.target,
          );

        const arm =
          character.locationHealth
            ?.locations[0];

        expect(
          arm?.hp.current,
        ).toBe(0);

        expect(
          arm?.disabled,
        ).toBe(true);

        expect(
          result.applicationPlan
            ?.instructions,
        ).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type:
                'drop-held-item',
              locationId:
                'right-arm',
            }),
          ]),
        );
      },
    );

    it(
      'does not apply a hit when the wound opposed test requires a reroll',
      () => {
        const fixture =
          makeStore(makeCharacter());

        const service =
          new MythrasCombatService(
            fixture.store,
          );

        const result =
          service.resolveAndApplyHit({
            tokenId: 'target',
            ...makeBaseHitInput(),

            incomingDamage: 5,

            attackSkill: 70,
            attackRoll: 50,

            enduranceSkill: 130,
            enduranceRoll: 96,
          });

        expect(
          result.resolution.status,
        ).toBe(
          'reroll-required',
        );

        expect(result.applied).toBe(
          false,
        );

        expect(
          fixture.updateToken,
        ).not.toHaveBeenCalled();

        expect(
          fixture.setTokensCondition,
        ).not.toHaveBeenCalled();

        const character =
          requireCharacter(
            fixture.tokens.target,
          );

        expect(
          character.locationHealth
            ?.locations[0]?.hp.current,
        ).toBe(5);
      },
    );

    it(
        'applies a severed Major leg wound and its persistent conditions',
        () => {
            const fixture =
            makeStore(makeLegCharacter());

            const service =
            new MythrasCombatService(
                fixture.store,
            );

            const result =
            service.resolveAndApplyHit({
                tokenId: 'target',

                locationRoll: 2,
                incomingDamage: 10,

                attackSkill: 70,
                attackRoll: 40,

                enduranceSkill: 60,
                enduranceRoll: 70,

                healingRate: 2,

                majorLimbInjuryType:
                'severed',
            });

            expect(
            result.resolution.status,
            ).toBe(
            'complete-endurance-loss',
            );

            expect(result.applied).toBe(true);

            expect(
            fixture.updateToken,
            ).toHaveBeenCalledTimes(1);

            const character =
            requireCharacter(
                fixture.tokens.target,
            );

            const leg =
            character.locationHealth
                ?.locations[0];

            /*
            * Starting HP 5, taking 10 damage:
            *
            * 5 - 10 = -5
            *
            * That is exactly the Major Wound
            * threshold for a 5 HP location.
            */
            expect(
            leg?.hp.current,
            ).toBe(-5);

            expect(
            leg?.disabled,
            ).toBe(true);

            expect(
            leg?.severed,
            ).toBe(true);

            /*
            * Major limb:
            *
            * - fall prone
            * - incapacitated
            *
            * Failed Endurance:
            *
            * - unconscious
            */
            expect(
            character.conditions,
            ).toEqual(
            expect.arrayContaining([
                'mythras-prone',
                'mythras-incapacitated',
                'mythras-unconscious',
            ]),
            );

            expect(
            fixture.setTokensCondition,
            ).toHaveBeenCalledWith(
            ['target'],
            'mythras-prone',
            true,
            );

            expect(
            fixture.setTokensCondition,
            ).toHaveBeenCalledWith(
            ['target'],
            'mythras-incapacitated',
            true,
            );

            expect(
            fixture.setTokensCondition,
            ).toHaveBeenCalledWith(
            ['target'],
            'mythras-unconscious',
            true,
            );

            /*
            * A severed limb must be treated within
            * 5 × Healing Rate minutes.
            *
            * Healing Rate 2 → 10 minutes.
            */
            expect(
            result.applicationPlan
                ?.timedEffects,
            ).toEqual(
            expect.arrayContaining([
                {
                type:
                    'treatment-deadline',
                locationId:
                    'right-leg',
                amount: 10,
                unit: 'minutes',
                consequence: 'death',
                },
            ]),
            );

            expect(
            result.applicationPlan
                ?.instructions,
            ).toEqual(
            expect.arrayContaining([
                {
                type:
                    'catastrophic-limb-injury',
                locationId:
                    'right-leg',
                injuryType:
                    'severed',
                },
                {
                type:
                    'treatment-deadline',
                locationId:
                    'right-leg',
                amount: 10,
                unit: 'minutes',
                consequence: 'death',
                },
            ]),
            );
        },
    );

    it(
        'records one completed attack as one undo step and restores it with undo and redo',
        () => {
            const {
            store,
            history,
            } = makeHistoryStore(
            makeLegCharacter(),
            );

            const service =
            new MythrasCombatService(
                store,
            );

            expect(
            history.getState().pastStates,
            ).toHaveLength(0);

            const result =
            service.resolveAndApplyHit({
                tokenId: 'target',

                locationRoll: 2,
                incomingDamage: 10,

                attackSkill: 70,
                attackRoll: 40,

                enduranceSkill: 60,
                enduranceRoll: 70,

                healingRate: 2,

                majorLimbInjuryType:
                'severed',
            });

            expect(result.applied).toBe(true);

            /*
            * updateToken + several Condition writes must be
            * grouped by MythrasCombatService into ONE logical
            * Atlas history step.
            */
            expect(
            history.getState().pastStates,
            ).toHaveLength(1);

            const wounded =
            requireCharacter(
                store.getState()
                .objects.tokens.target,
            );

            const woundedLeg =
            wounded.locationHealth
                ?.locations[0];

            expect(
            woundedLeg?.hp.current,
            ).toBe(-5);

            expect(
            woundedLeg?.disabled,
            ).toBe(true);

            expect(
            woundedLeg?.severed,
            ).toBe(true);

            expect(
            wounded.conditions,
            ).toEqual(
            expect.arrayContaining([
                'mythras-prone',
                'mythras-incapacitated',
                'mythras-unconscious',
            ]),
            );

            /*
            * One Undo should reverse the WHOLE attack,
            * including both location health and Conditions.
            */
            history.getState().undo();

            expect(
            history.getState().pastStates,
            ).toHaveLength(0);

            const restored =
            requireCharacter(
                store.getState()
                .objects.tokens.target,
            );

            const restoredLeg =
            restored.locationHealth
                ?.locations[0];

            expect(
            restoredLeg?.hp.current,
            ).toBe(5);

            expect(
            restoredLeg?.disabled,
            ).toBeUndefined();

            expect(
            restoredLeg?.severed,
            ).toBeUndefined();

            expect(
            restored.conditions,
            ).toBeUndefined();

            /*
            * Redo should restore the entire completed attack
            * as one operation as well.
            */
            history.getState().redo();

            const redone =
            requireCharacter(
                store.getState()
                .objects.tokens.target,
            );

            const redoneLeg =
            redone.locationHealth
                ?.locations[0];

            expect(
            redoneLeg?.hp.current,
            ).toBe(-5);

            expect(
            redoneLeg?.disabled,
            ).toBe(true);

            expect(
            redoneLeg?.severed,
            ).toBe(true);

            expect(
            redone.conditions,
            ).toEqual(
            expect.arrayContaining([
                'mythras-prone',
                'mythras-incapacitated',
                'mythras-unconscious',
            ]),
            );

            expect(
            history.getState().pastStates,
            ).toHaveLength(1);
        },
    );

    it(
        'records no history step while a Major limb injury type is pending',
        () => {
            const {
            store,
            history,
            } = makeHistoryStore(
            makeLegCharacter(),
            );

            const service =
            new MythrasCombatService(
                store,
            );

            const result =
            service.resolveAndApplyHit({
                tokenId: 'target',

                locationRoll: 2,
                incomingDamage: 10,

                attackSkill: 70,
                attackRoll: 40,

                healingRate: 2,
            });

            expect(
            result.resolution.status,
            ).toBe(
            'pending-major-limb-injury',
            );

            expect(result.applied).toBe(
            false,
            );

            expect(
            history.getState().pastStates,
            ).toHaveLength(0);

            const character =
            requireCharacter(
                store.getState()
                .objects.tokens.target,
            );

            expect(
            character.locationHealth
                ?.locations[0]?.hp.current,
            ).toBe(5);

            expect(
            character.conditions,
            ).toBeUndefined();
        },
    );
  },
);