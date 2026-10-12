import type {
  SystemPreset,
} from '../../types/systemPresetTypes';

import {
  builtInPresetId,
  conditionsOf,
} from './presetHelpers';

/**
 * Mythras: location-based health and persistent combat states.
 *
 * Hit Points are tracked per hit location rather than through Atlas's
 * generic HP resource, so this preset intentionally defines no HP resource.
 *
 * These Conditions initially represent visible persistent states only.
 * Mythras-specific movement, action, initiative, and recovery behavior is
 * handled by the Mythras rules layer rather than generic Atlas effects.
 */
export const MYTHRAS: SystemPreset = {
  id: builtInPresetId('mythras'),
  name: 'Mythras',
  builtIn: true,

  rules: {
    gridDefaults: {
      unitType: 'meters',
      unitDistance: 1,
      measurementMode: 'metric',
      diagonalRule: 'equidistant',
      abstractRangeBands: [],
    },

    dice: {
      defaultRoll: '1d100',
      crit: 'roll-under',
    },

    conditions: conditionsOf(
      'mythras',
      [
        {
          name: 'Prone',
          color: '#d97706',
          icon: 'foot-trip',
        },
        {
          name: 'Unconscious',
          color: '#1e3a8a',
          icon: 'sleepy',
        },
        {
          name: 'Incapacitated',
          color: '#b91c1c',
          icon: 'knockout',
        },
        {
          name: 'Dead',
          color: '#450a0a',
          icon: 'bleeding-wound',
        },
      ],
    ),

    /*
     * Mythras uses per-location Hit Points through
     * Character.locationHealth.
     */
    resources: [],
  },
};