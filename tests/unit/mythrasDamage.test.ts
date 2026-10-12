import { describe, expect, it } from 'vitest';

import {
  calculateDamageAfterArmor,
  classifyWoundSeverity,
  resolveLocationDamage,
} from '../../src/app/gameSystems/mythras/mythrasDamage';

describe('Mythras armor', () => {
  it('subtracts armor points from incoming damage', () => {
    expect(calculateDamageAfterArmor(7, 3)).toBe(4);
  });

  it('reduces damage to zero when armor equals damage', () => {
    expect(calculateDamageAfterArmor(4, 4)).toBe(0);
  });

  it('never produces negative damage when armor exceeds damage', () => {
    expect(calculateDamageAfterArmor(3, 5)).toBe(0);
  });

  it('allows full damage through when there is no armor', () => {
    expect(calculateDamageAfterArmor(6, 0)).toBe(6);
  });
});

describe('Mythras wound severity', () => {
  it('has no wound at full HP', () => {
    expect(classifyWoundSeverity(5, 5)).toBe('none');
  });

  it('is minor while HP remains positive', () => {
    expect(classifyWoundSeverity(4, 5)).toBe('minor');
    expect(classifyWoundSeverity(1, 5)).toBe('minor');
  });

  it('becomes serious at exactly zero HP', () => {
    expect(classifyWoundSeverity(0, 5)).toBe('serious');
  });

  it('remains serious before reaching negative maximum HP', () => {
    expect(classifyWoundSeverity(-1, 5)).toBe('serious');
    expect(classifyWoundSeverity(-4, 5)).toBe('serious');
  });

  it('becomes major at negative maximum HP', () => {
    expect(classifyWoundSeverity(-5, 5)).toBe('major');
  });

  it('remains major beyond negative maximum HP', () => {
    expect(classifyWoundSeverity(-8, 5)).toBe('major');
  });
});

describe('Mythras location damage', () => {
  it('applies armor before removing location HP', () => {
    const result = resolveLocationDamage({
      currentHp: 5,
      maxHp: 5,
      incomingDamage: 7,
      armorPoints: 3,
    });

    expect(result.blockedDamage).toBe(3);
    expect(result.hpDamage).toBe(4);
    expect(result.previousHp).toBe(5);
    expect(result.currentHp).toBe(1);
    expect(result.woundSeverity).toBe('minor');
  });

  it('produces a serious wound when damage reduces HP to zero', () => {
    const result = resolveLocationDamage({
      currentHp: 5,
      maxHp: 5,
      incomingDamage: 7,
      armorPoints: 2,
    });

    expect(result.currentHp).toBe(0);
    expect(result.woundSeverity).toBe('serious');
  });

  it('produces a major wound at negative maximum HP', () => {
    const result = resolveLocationDamage({
      currentHp: 5,
      maxHp: 5,
      incomingDamage: 10,
      armorPoints: 0,
    });

    expect(result.currentHp).toBe(-5);
    expect(result.woundSeverity).toBe('major');
  });

  it('does not clamp location HP at zero', () => {
    const result = resolveLocationDamage({
      currentHp: 2,
      maxHp: 5,
      incomingDamage: 8,
      armorPoints: 0,
    });

    expect(result.currentHp).toBe(-6);
    expect(result.woundSeverity).toBe('major');
  });

  it('does not change HP when armor blocks all damage', () => {
    const result = resolveLocationDamage({
      currentHp: 5,
      maxHp: 5,
      incomingDamage: 3,
      armorPoints: 4,
    });

    expect(result.hpDamage).toBe(0);
    expect(result.currentHp).toBe(5);
    expect(result.woundSeverity).toBe('none');
  });
});