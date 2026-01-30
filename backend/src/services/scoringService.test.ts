import { describe, it, expect } from 'vitest';
import { calculateFantasyPoints } from './scoringService.js';
import { DEFAULT_SCORING_RULES } from '../config/index.js';

describe('calculateFantasyPoints', () => {
  it('should calculate points correctly with default rules', () => {
    const stats = {
      kills: 20,
      deaths: 15,
      assists: 5,
      damage: 3000,
      objectiveTime: 60,
      bombPlants: 2,
      bombDefuses: 1,
      firstBloods: 3,
    };

    const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

    // kills: 20 * 1.0 = 20
    // deaths: 15 * -0.5 = -7.5
    // assists: 5 * 0.25 = 1.25
    // damage: 3000/100 * 0.01 = 0.3
    // objectiveTime: 60 * 0.02 = 1.2
    // bombPlants: 2 * 2.0 = 4
    // bombDefuses: 1 * 2.0 = 2
    // firstBloods: 3 * 1.5 = 4.5

    expect(result.kills).toBe(20);
    expect(result.deaths).toBe(-7.5);
    expect(result.assists).toBe(1.25);
    expect(result.damage).toBeCloseTo(0.3, 2);
    expect(result.objectiveTime).toBeCloseTo(1.2, 2);
    expect(result.bombPlants).toBe(4);
    expect(result.bombDefuses).toBe(2);
    expect(result.firstBloods).toBe(4.5);
    expect(result.total).toBeCloseTo(25.75, 2);
  });

  it('should handle zero stats', () => {
    const stats = {
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      objectiveTime: 0,
      bombPlants: 0,
      bombDefuses: 0,
      firstBloods: 0,
    };

    const result = calculateFantasyPoints(stats, DEFAULT_SCORING_RULES);

    expect(result.total).toBe(0);
  });

  it('should work with custom scoring rules', () => {
    const stats = {
      kills: 10,
      deaths: 5,
      assists: 0,
      damage: 0,
      objectiveTime: 0,
      bombPlants: 0,
      bombDefuses: 0,
      firstBloods: 0,
    };

    const customRules = {
      ...DEFAULT_SCORING_RULES,
      killPoints: 2.0,
      deathPoints: -1.0,
    };

    const result = calculateFantasyPoints(stats, customRules);

    expect(result.kills).toBe(20); // 10 * 2.0
    expect(result.deaths).toBe(-5); // 5 * -1.0
    expect(result.total).toBe(15);
  });
});
