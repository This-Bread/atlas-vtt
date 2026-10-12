/**
 * Generic data structures for tokens that track health by body location.
 *
 * These types deliberately contain no Mythras-specific wound rules.
 * Mythras will use this data model, but Atlas itself only needs to know
 * that a token can have independently tracked locations.
 */

/**
 * Broad anatomical categories.
 *
 * These are useful for rules that care about the general kind of
 * body part without hard-coding specific anatomies.
 */
export type LocationCategory =
  | 'head'
  | 'torso'
  | 'arm'
  | 'leg'
  | 'limb'
  | 'wing'
  | 'tail'
  | 'other';

/**
 * Inclusive range used when a die roll selects a hit location.
 *
 * Example:
 * Right Leg on the standard Mythras humanoid table is 1-3,
 * so min = 1 and max = 3.
 */
export interface HitLocationRange {
  min: number;
  max: number;
}

/**
 * State for one independently tracked body location.
 */
export interface HitLocationState {
  /**
   * Stable machine-readable identifier.
   *
   * Example: "right-arm"
   */
  id: string;

  /**
   * Human-readable name shown in the UI.
   *
   * Example: "Right Arm"
   */
  name: string;

  /**
   * Die-roll range that selects this location.
   */
  roll: HitLocationRange;

  /**
   * Current and maximum hit points for this location.
   *
   * current is intentionally allowed to become negative.
   */
  hp: {
    current: number;
    max: number;
  };

  /**
   * Current armor points protecting this location.
   */
  armor: number;

  /**
   * General anatomical category used by rules and UI.
   */
  category?: LocationCategory;

  /**
   * Optional state flags for future wound handling.
   */
  disabled?: boolean;
  severed?: boolean;
}

/**
 * Complete location-based health state belonging to a token.
 */
export interface LocationHealthState {
  /**
   * Rules system interpreting this health data.
   *
   * Example: "mythras"
   */
  system: string;

  /**
   * Number of sides on the location die.
   *
   * Standard Mythras humanoids use a d20, so die = 20.
   */
  die: number;

  /**
   * Optional identifier for the anatomy template that created
   * these locations.
   *
   * Example: "mythras-humanoid"
   */
  anatomyId?: string;

  /**
   * Every independently tracked location on the creature.
   */
  locations: HitLocationState[];
}