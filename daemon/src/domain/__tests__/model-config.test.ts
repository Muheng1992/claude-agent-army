// src/domain/__tests__/model-config.test.ts
// WHY: Token estimation and recycle thresholds directly affect session lifecycle

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  estimateTokens,
  calculateRecycleThreshold,
  createDefaultRegistry,
  createRegistry,
  isKnownModel,
} from '../model-config.js';
import type { ModelRegistry } from '../model-config.js';

describe('estimateTokens', () => {
  it('should return 0 for empty string', () => {
    assert.equal(estimateTokens(''), 0);
  });

  it('should calculate Math.ceil(length / 4)', () => {
    // 20 chars => Math.ceil(20 / 4) = 5
    const text = 'a'.repeat(20);
    assert.equal(estimateTokens(text), 5);
  });

  it('should ceil fractional results', () => {
    // 10 chars => Math.ceil(10 / 4) = Math.ceil(2.5) = 3
    assert.equal(estimateTokens('a'.repeat(10)), 3);
    // 7 chars => Math.ceil(7 / 4) = Math.ceil(1.75) = 2
    assert.equal(estimateTokens('a'.repeat(7)), 2);
  });

  it('should handle single character', () => {
    // 1 char => Math.ceil(1 / 4) = Math.ceil(0.25) = 1
    assert.equal(estimateTokens('x'), 1);
  });

  it('should handle long text', () => {
    const text = 'a'.repeat(10_000);
    // 10000 / 4 = 2500
    assert.equal(estimateTokens(text), 2500);
  });
});

describe('calculateRecycleThreshold', () => {
  let registry: ModelRegistry;

  it('should calculate threshold for known model', () => {
    registry = createDefaultRegistry();
    // claude-opus-4-6: 200_000 * 0.75 = 150_000
    const threshold = calculateRecycleThreshold(registry, 'claude-opus-4-6');
    assert.equal(threshold, 150_000);
  });

  it('should calculate threshold for 1M context model', () => {
    registry = createDefaultRegistry();
    // claude-opus-4-6[1m]: 1_000_000 * 0.75 = 750_000
    const threshold = calculateRecycleThreshold(
      registry,
      'claude-opus-4-6[1m]'
    );
    assert.equal(threshold, 750_000);
  });

  it('should return null for unknown model', () => {
    registry = createDefaultRegistry();
    const threshold = calculateRecycleThreshold(registry, 'unknown-model');
    assert.equal(threshold, null);
  });

  it('should use custom model config when provided', () => {
    registry = createRegistry({
      'custom-model': {
        name: 'custom-model',
        contextWindowTokens: 500_000,
        recycleThresholdRatio: 0.8,
      },
    });
    // 500_000 * 0.8 = 400_000
    const threshold = calculateRecycleThreshold(registry, 'custom-model');
    assert.equal(threshold, 400_000);
  });

  it('should allow ratioOverride', () => {
    registry = createDefaultRegistry();
    // claude-opus-4-6: 200_000 * 0.8 = 160_000
    const threshold = calculateRecycleThreshold(registry, 'claude-opus-4-6', 0.8);
    assert.equal(threshold, 160_000);
  });

  it('should allow custom models to override defaults', () => {
    registry = createRegistry({
      'claude-opus-4-6': {
        name: 'claude-opus-4-6',
        contextWindowTokens: 400_000,
        recycleThresholdRatio: 0.7,
      },
    });
    // Override: 400_000 * 0.7 = 280_000
    const threshold = calculateRecycleThreshold(registry, 'claude-opus-4-6');
    assert.equal(threshold, 280_000);
  });
});

describe('createDefaultRegistry', () => {
  it('should include known default models', () => {
    const registry = createDefaultRegistry();
    assert.ok(registry.has('claude-opus-4-6'));
    assert.ok(registry.has('claude-opus-4-6[1m]'));
    assert.ok(registry.has('claude-sonnet-4-6'));
    assert.ok(registry.has('claude-haiku-4-5'));
  });
});

describe('isKnownModel', () => {
  it('should return true for known model', () => {
    const registry = createDefaultRegistry();
    assert.equal(isKnownModel(registry, 'claude-opus-4-6'), true);
  });

  it('should return false for unknown model', () => {
    const registry = createDefaultRegistry();
    assert.equal(isKnownModel(registry, 'unknown'), false);
  });
});
