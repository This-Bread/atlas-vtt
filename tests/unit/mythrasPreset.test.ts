import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  MYTHRAS,
} from '../../src/app/gameSystems/presets/mythras';

import {
  MYTHRAS_ATLAS_CONDITION_IDS,
} from '../../src/app/services/MythrasCombatService';

describe(
  'Mythras system preset',
  () => {
    it(
      'uses the condition ids expected by MythrasCombatService',
      () => {
        const ids =
          MYTHRAS.rules.conditions.map(
            (condition) =>
              condition.id,
          );

        expect(ids).toEqual([
          MYTHRAS_ATLAS_CONDITION_IDS.prone,
          MYTHRAS_ATLAS_CONDITION_IDS.unconscious,
          MYTHRAS_ATLAS_CONDITION_IDS.incapacitated,
          MYTHRAS_ATLAS_CONDITION_IDS.dead,
        ]);
      },
    );

    it(
      'defines the expected persistent combat conditions',
      () => {
        expect(
          MYTHRAS.rules.conditions.map(
            (condition) =>
              condition.name,
          ),
        ).toEqual([
          'Prone',
          'Unconscious',
          'Incapacitated',
          'Dead',
        ]);
      },
    );

    it(
      'does not define a generic HP resource',
      () => {
        expect(
          MYTHRAS.rules.resources,
        ).toEqual([]);
      },
    );
  },
);