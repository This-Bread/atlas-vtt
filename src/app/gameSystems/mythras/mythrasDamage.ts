/**
 * Core Mythras damage and wound calculations.
 *
 * This file handles:
 * - armor reduction
 * - hit-location HP loss
 * - wound severity
 *
 * Serious/Major Wound consequences are handled separately.
 */

export type WoundSeverity =
  | 'none'
  | 'minor'
  | 'serious'
  | 'major';

export interface LocationDamageInput {
  /**
   * Location HP immediately before this damage is applied.
   */
  currentHp: number;

  /**
   * Normal maximum HP of the location.
   */
  maxHp: number;

  /**
   * Damage reaching the location before armor is applied.
   *
   * Weapon damage modifiers, magical modifications, parries,
   * and similar effects should already have been resolved
   * before this value reaches this function.
   */
  incomingDamage: number;

  /**
   * Effective Armor Points protecting this location.
   */
  armorPoints: number;
}

export interface LocationDamageResult {
  incomingDamage: number;
  armorPoints: number;

  /**
   * Damage stopped by armor.
   */
  blockedDamage: number;

  /**
   * Damage actually removed from location HP.
   */
  hpDamage: number;

  previousHp: number;
  currentHp: number;
  maxHp: number;

  woundSeverity: WoundSeverity;
}

/**
 * Calculates how much damage remains after armor.
 */
export function calculateDamageAfterArmor(
  incomingDamage: number,
  armorPoints: number,
): number {
  return Math.max(0, incomingDamage - armorPoints);
}

/**
 * Determines the current wound severity of a hit location.
 */
export function classifyWoundSeverity(
  currentHp: number,
  maxHp: number,
): WoundSeverity {
  if (currentHp >= maxHp) {
    return 'none';
  }

  if (currentHp > 0) {
    return 'minor';
  }

  if (currentHp > -maxHp) {
    return 'serious';
  }

  return 'major';
}

/**
 * Resolves armor, HP loss, and resulting wound severity
 * for one hit location.
 *
 * Location HP is deliberately NOT clamped at zero.
 */
export function resolveLocationDamage(
  input: LocationDamageInput,
): LocationDamageResult {
  const hpDamage = calculateDamageAfterArmor(
    input.incomingDamage,
    input.armorPoints,
  );

  const currentHp = input.currentHp - hpDamage;

  return {
    incomingDamage: input.incomingDamage,
    armorPoints: input.armorPoints,
    blockedDamage: input.incomingDamage - hpDamage,
    hpDamage,
    previousHp: input.currentHp,
    currentHp,
    maxHp: input.maxHp,
    woundSeverity: classifyWoundSeverity(
      currentHp,
      input.maxHp,
    ),
  };
}