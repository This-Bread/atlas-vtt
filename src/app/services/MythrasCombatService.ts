import type {
  ViewAtlasState,
} from '../storeFactory';

import {
  resolveHumanoidHit,
  type HumanoidHitResolutionResult,
  type ResolveHumanoidHitInput,
} from '../gameSystems/mythras/mythrasHitResolution';

import {
  translateMythrasWoundEffects,
  type MythrasEffectTranslation,
  type MythrasPersistentCondition,
} from '../gameSystems/mythras/mythrasEffectTranslation';

import {
  runHistoryTransaction,
} from '../stores/history';

/**
 * The subset of the Atlas view store required by
 * Mythras combat.
 *
 * Keeping this dependency narrow makes the service
 * easier to unit-test and avoids coupling Mythras
 * combat to unrelated Atlas state.
 */
export interface MythrasCombatStore {
  getState(): Pick<
    ViewAtlasState,
    | 'objects'
    | 'updateToken'
    | 'setTokensCondition'
  >;
}

/**
 * Atlas condition IDs used to represent persistent
 * Mythras character states.
 *
 * The pure Mythras rules/translation layer uses
 * semantic names such as "prone". Atlas-specific
 * IDs are introduced only here, at the adapter layer.
 */
export const MYTHRAS_ATLAS_CONDITION_IDS = {
  prone: 'mythras-prone',
  unconscious: 'mythras-unconscious',
  incapacitated: 'mythras-incapacitated',
  dead: 'mythras-dead',
} as const satisfies Record<
  MythrasPersistentCondition,
  string
>;

/**
 * Input supplied by Atlas/UI code.
 *
 * locationHealth is deliberately omitted because the
 * service always reads the current value from the live
 * Atlas character.
 */
export interface ResolveAndApplyMythrasHitInput
  extends Omit<
    ResolveHumanoidHitInput,
    'locationHealth'
  > {
  tokenId: string;
}

/**
 * Result returned to the caller.
 *
 * A result can contain an application plan without
 * actually having changed Atlas. This is useful for
 * pending Endurance tests and rerolls, where the UI
 * needs to understand the consequences known so far.
 */
export interface MythrasCombatHitResult {
  resolution: HumanoidHitResolutionResult;

  applicationPlan:
    MythrasEffectTranslation | null;

  /**
   * True only when the completed resolution has been
   * committed to the Atlas token.
   */
  applied: boolean;
}

/**
 * Only completed Mythras hit results may alter the
 * Atlas token.
 *
 * Pending injury choices, pending Endurance tests,
 * and rerolls must leave the character unchanged.
 */
function isFinalizedHit(
  resolution: HumanoidHitResolutionResult,
): boolean {
  switch (resolution.status) {
    case 'complete-no-test':
    case 'complete-endurance-win':
    case 'complete-endurance-loss':
      return true;

    case 'pending-major-limb-injury':
    case 'pending-endurance-test':
    case 'reroll-required':
      return false;
  }
}

/**
 * Atlas-facing adapter for the pure Mythras combat
 * rules.
 *
 * Responsibilities:
 *
 * - locate and validate the target Atlas character;
 * - resolve the hit using the pure Mythras rules;
 * - translate wound effects into persistent location
 *   state, semantic Conditions, timers and
 *   instructions;
 * - apply only finalized results;
 * - group all Atlas mutations into one undo step.
 *
 * This service does not roll dice, persist timed
 * effects, manipulate equipment, or write wounds back
 * to Obsidian notes.
 */
export class MythrasCombatService {
  public constructor(
    private readonly store: MythrasCombatStore,
  ) {}

  public resolveAndApplyHit(
    input: ResolveAndApplyMythrasHitInput,
  ): MythrasCombatHitResult {
    const state = this.store.getState();

    const token =
      state.objects.tokens[input.tokenId];

    if (!token) {
      throw new Error(
        `Token not found: ${input.tokenId}`,
      );
    }

    if (token.kind !== 'character') {
      throw new Error(
        'Mythras combat requires a character token.',
      );
    }

    if (!token.locationHealth) {
      throw new Error(
        'Character has no location health state.',
      );
    }

    if (
      token.locationHealth.system !== 'mythras'
    ) {
      throw new Error(
        'Character is not using Mythras location health.',
      );
    }

    const {
      tokenId: _tokenId,
      ...hitInput
    } = input;

    const resolution =
      resolveHumanoidHit({
        ...hitInput,
        locationHealth:
          token.locationHealth,
      });

    const applicationPlan =
      resolution.woundResolution
        ? translateMythrasWoundEffects({
            updatedLocation:
              resolution.updatedLocation,
            effects:
              resolution.woundResolution.effects,
          })
        : null;

    /*
     * A pending resolution may already have useful
     * immediate effects in its application plan, but
     * those effects must not be written to Atlas until
     * the hit is fully resolved.
     */
    if (!isFinalizedHit(resolution)) {
      return {
        resolution,
        applicationPlan,
        applied: false,
      };
    }

    /*
     * A completed hit should always have passed
     * through wound resolution. Treat the absence of
     * an application plan as an internal contract
     * violation rather than silently applying only HP.
     */
    if (!applicationPlan) {
      throw new Error(
        'Completed Mythras hit has no wound application plan.',
      );
    }

    /*
     * Start from the character's current complete
     * location-health state and replace only the
     * location affected by this hit.
     *
     * The translator's updatedLocation contains both
     * the HP result and persistent anatomical flags
     * such as disabled/severed.
     */
    const updatedLocationHealth = {
      ...token.locationHealth,

      locations:
        token.locationHealth.locations.map(
          (location) =>
            location.id ===
            applicationPlan.updatedLocation.id
              ? applicationPlan.updatedLocation
              : location,
        ),
    };

    /*
     * One resolved attack is one logical Atlas edit.
     *
     * HP/location changes and all persistent
     * Conditions therefore belong to the same history
     * transaction and should be reversed by one Undo.
     */
    runHistoryTransaction(
      this.store,
      () => {
        const liveState =
          this.store.getState();

        liveState.updateToken(
          input.tokenId,
          {
            locationHealth:
              updatedLocationHealth,
          },
        );

        for (
          const condition
          of applicationPlan
            .persistentConditions
        ) {
          liveState.setTokensCondition(
            [input.tokenId],
            MYTHRAS_ATLAS_CONDITION_IDS[
              condition
            ],
            true,
          );
        }
      },
    );

    return {
      resolution,
      applicationPlan,
      applied: true,
    };
  }
}