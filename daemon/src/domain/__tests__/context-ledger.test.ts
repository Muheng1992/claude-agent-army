// src/domain/__tests__/context-ledger.test.ts
// WHY: ContextLedger tracks all artifacts and decisions -- correctness is essential

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  createLedger,
  addArtifact,
  addDecision,
  getArtifactsForTask,
  getRelevantDecisions,
  createArtifact,
} from '../context-ledger.js';
import type { ContextLedger, Artifact, Decision } from '../context-ledger.js';

describe('createLedger', () => {
  it('should create a ledger with the given missionId', () => {
    const ledger = createLedger('mission-123');
    assert.equal(ledger.missionId, 'mission-123');
  });

  it('should have empty sessions array', () => {
    const ledger = createLedger('m1');
    assert.deepStrictEqual(ledger.sessions, []);
  });

  it('should have empty artifacts array', () => {
    const ledger = createLedger('m1');
    assert.deepStrictEqual(ledger.artifacts, []);
  });

  it('should have empty decisions array', () => {
    const ledger = createLedger('m1');
    assert.deepStrictEqual(ledger.decisions, []);
  });
});

describe('createArtifact', () => {
  it('should create artifact with generated id', () => {
    const artifact = createArtifact({
      sessionId: 'sess-1',
      taskId: 'task-1',
      type: 'code',
      content: 'hello',
    });
    assert.ok(artifact.id.startsWith('artifact-'));
    assert.equal(artifact.sessionId, 'sess-1');
    assert.equal(artifact.taskId, 'task-1');
    assert.equal(artifact.type, 'code');
    assert.equal(artifact.content, 'hello');
    assert.ok(artifact.createdAt);
  });

  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const artifact = createArtifact({
        sessionId: 'sess-1',
        taskId: 'task-1',
        type: 'code',
        content: 'hello',
      });
      ids.add(artifact.id);
    }
    assert.equal(ids.size, 100);
  });
});

// WHY: Since ContextLedger is a plain interface (value object), test
// the immutable usage patterns that consuming code relies on
describe('ContextLedger immutable operations', () => {
  const sampleArtifact: Artifact = {
    id: 'art-1',
    sessionId: 'sess-1',
    taskId: 'task-1',
    type: 'code',
    content: 'console.log("hello")',
    createdAt: '2026-03-31T00:00:00Z',
  };

  it('addArtifact should return new ledger with artifact added', () => {
    const ledger = createLedger('m1');
    const updated = addArtifact(ledger, sampleArtifact);
    assert.equal(updated.artifacts.length, 1);
    assert.equal(updated.artifacts[0].id, 'art-1');
    // Original is unchanged
    assert.equal(ledger.artifacts.length, 0);
  });

  it('addArtifact should preserve existing artifacts', () => {
    let ledger = createLedger('m1');
    ledger = addArtifact(ledger, sampleArtifact);
    const second: Artifact = {
      ...sampleArtifact,
      id: 'art-2',
      type: 'decision',
    };
    const updated = addArtifact(ledger, second);
    assert.equal(updated.artifacts.length, 2);
    assert.equal(updated.artifacts[0].id, 'art-1');
    assert.equal(updated.artifacts[1].id, 'art-2');
  });

  it('getArtifactsForTask should filter by taskId', () => {
    let ledger = createLedger('m1');
    ledger = addArtifact(ledger, sampleArtifact);
    ledger = addArtifact(ledger, {
      ...sampleArtifact,
      id: 'art-2',
      taskId: 'task-2',
    });
    ledger = addArtifact(ledger, {
      ...sampleArtifact,
      id: 'art-3',
      taskId: 'task-1',
    });

    const task1Artifacts = getArtifactsForTask(ledger, 'task-1');
    assert.equal(task1Artifacts.length, 2);
    assert.ok(task1Artifacts.every((a) => a.taskId === 'task-1'));

    const task2Artifacts = getArtifactsForTask(ledger, 'task-2');
    assert.equal(task2Artifacts.length, 1);
  });

  it('getArtifactsForTask should return empty for non-existent task', () => {
    const ledger = createLedger('m1');
    const artifacts = getArtifactsForTask(ledger, 'non-existent');
    assert.deepStrictEqual(artifacts, []);
  });

  it('getRelevantDecisions should filter by taskId', () => {
    const decision1: Decision = {
      id: 'dec-1',
      sessionId: 'sess-1',
      taskId: 'task-1',
      summary: 'Use approach A',
      rationale: 'Because of X',
      affectedFiles: [],
      createdAt: '2026-03-31T00:00:00Z',
    };
    const decision2: Decision = {
      ...decision1,
      id: 'dec-2',
      taskId: 'task-2',
    };
    const ledger: ContextLedger = {
      ...createLedger('m1'),
      decisions: [decision1, decision2],
    };

    const result = getRelevantDecisions(ledger, 'task-1');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'dec-1');
  });

  it('getRelevantDecisions should return empty when no decisions', () => {
    const ledger = createLedger('m1');
    const result = getRelevantDecisions(ledger, 'task-1');
    assert.deepStrictEqual(result, []);
  });
});
