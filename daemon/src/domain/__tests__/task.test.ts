// src/domain/__tests__/task.test.ts
// WHY: Task state machine must enforce valid transitions to prevent illegal states

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { canTransitionTo, transitionTo, createTask } from '../task.js';
import type { Task, TaskStatus } from '../task.js';

function createTestTask(status: TaskStatus): Task {
  const task = createTask({
    id: 'task-1',
    missionId: 'mission-1',
    title: 'Test task',
    description: 'A test task',
    maxRetries: 2,
  });
  // WHY: Use spread to set arbitrary status for test scenarios
  return { ...task, status };
}

describe('Task state machine', () => {
  describe('canTransitionTo', () => {
    const validTransitions: Array<[TaskStatus, TaskStatus]> = [
      ['pending', 'assigned'],
      ['assigned', 'running'],
      ['running', 'verifying'],
      ['running', 'failed'],
      ['running', 'completed'],
      ['verifying', 'completed'],
      ['verifying', 'failed'],
      ['failed', 'retrying'],
      ['failed', 'abandoned'],
      ['retrying', 'running'],
    ];

    for (const [from, to] of validTransitions) {
      it(`should allow ${from} -> ${to}`, () => {
        assert.equal(canTransitionTo(from, to), true);
      });
    }

    const invalidTransitions: Array<[TaskStatus, TaskStatus]> = [
      ['pending', 'running'],
      ['pending', 'completed'],
      ['pending', 'failed'],
      ['assigned', 'completed'],
      ['assigned', 'failed'],
      ['running', 'pending'],
      ['running', 'assigned'],
      ['completed', 'pending'],
      ['completed', 'failed'],
      ['completed', 'running'],
      ['abandoned', 'pending'],
      ['abandoned', 'running'],
      ['failed', 'completed'],
      ['retrying', 'completed'],
      ['retrying', 'failed'],
    ];

    for (const [from, to] of invalidTransitions) {
      it(`should reject ${from} -> ${to}`, () => {
        assert.equal(canTransitionTo(from, to), false);
      });
    }
  });

  describe('transitionTo', () => {
    it('should return new Task with updated status on valid transition', () => {
      const task = createTestTask('pending');
      const result = transitionTo(task, 'assigned');
      assert.equal(result.status, 'assigned');
      // Original should be unchanged
      assert.equal(task.status, 'pending');
    });

    it('should throw on invalid transition', () => {
      const task = createTestTask('pending');
      assert.throws(() => transitionTo(task, 'completed'));
    });

    it('should preserve all other task properties', () => {
      const task = createTestTask('pending');
      const result = transitionTo(task, 'assigned');
      assert.equal(result.id, task.id);
      assert.equal(result.missionId, task.missionId);
      assert.equal(result.title, task.title);
      assert.equal(result.description, task.description);
      assert.deepStrictEqual(result.dependencies, task.dependencies);
      assert.equal(result.maxRetries, task.maxRetries);
    });

    it('should handle the full happy path lifecycle', () => {
      let task: Task = createTestTask('pending');
      task = transitionTo(task, 'assigned');
      task = transitionTo(task, 'running');
      task = transitionTo(task, 'verifying');
      task = transitionTo(task, 'completed');
      assert.equal(task.status, 'completed');
    });

    it('should handle the retry lifecycle', () => {
      let task: Task = createTestTask('pending');
      task = transitionTo(task, 'assigned');
      task = transitionTo(task, 'running');
      task = transitionTo(task, 'failed');
      task = transitionTo(task, 'retrying');
      task = transitionTo(task, 'running');
      assert.equal(task.status, 'running');
    });

    it('should handle the abandon lifecycle', () => {
      let task: Task = createTestTask('pending');
      task = transitionTo(task, 'assigned');
      task = transitionTo(task, 'running');
      task = transitionTo(task, 'failed');
      task = transitionTo(task, 'abandoned');
      assert.equal(task.status, 'abandoned');
    });

    it('should increment retryCount on retrying transition', () => {
      let task: Task = createTestTask('pending');
      task = transitionTo(task, 'assigned');
      task = transitionTo(task, 'running');
      task = transitionTo(task, 'failed');
      assert.equal(task.retryCount, 0);
      task = transitionTo(task, 'retrying');
      assert.equal(task.retryCount, 1);
    });
  });
});
