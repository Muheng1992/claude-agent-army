// src/domain/__tests__/task-graph.test.ts
// WHY: TaskGraph is the most critical domain logic -- DAG operations must be correct

import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  createTaskGraph,
  getReadyTasks,
  markCompleted,
  markFailed,
  getTopologicalOrder,
  isTerminal,
} from '../task-graph.js';
import type { TaskStatus } from '../task.js';
import { DomainError } from '../errors.js';

describe('TaskGraph', () => {
  describe('createTaskGraph', () => {
    it('should create an empty graph with no tasks', () => {
      const graph = createTaskGraph([]);
      assert.deepStrictEqual(getReadyTasks(graph), []);
      assert.equal(graph.nodes.size, 0);
    });

    it('should create a graph with independent tasks', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: [] },
      ]);
      assert.equal(graph.nodes.size, 2);
    });

    it('should create a graph with dependent tasks', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
      ]);
      assert.equal(graph.nodes.size, 2);
      const nodeB = graph.nodes.get('b');
      assert.deepStrictEqual(nodeB?.dependencies, ['a']);
    });

    it('should throw DomainError when cycle is detected', () => {
      assert.throws(
        () =>
          createTaskGraph([
            { id: 'a', status: 'pending', dependencies: ['b'] },
            { id: 'b', status: 'pending', dependencies: ['a'] },
          ]),
        (err) => {
          assert.ok(err instanceof DomainError);
          assert.equal(err.code, 'CYCLE_DETECTED');
          return true;
        }
      );
    });

    it('should throw on a 3-node cycle', () => {
      assert.throws(
        () =>
          createTaskGraph([
            { id: 'a', status: 'pending', dependencies: ['c'] },
            { id: 'b', status: 'pending', dependencies: ['a'] },
            { id: 'c', status: 'pending', dependencies: ['b'] },
          ]),
        (err) => err instanceof DomainError
      );
    });

    it('should build correct dependents (reverse links)', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
        { id: 'c', status: 'pending', dependencies: ['a'] },
      ]);
      const nodeA = graph.nodes.get('a');
      assert.ok(nodeA);
      assert.ok(nodeA.dependents.includes('b'));
      assert.ok(nodeA.dependents.includes('c'));
      assert.equal(nodeA.dependents.length, 2);
    });
  });

  describe('getReadyTasks', () => {
    it('should return all tasks when none have dependencies', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: [] },
        { id: 'c', status: 'pending', dependencies: [] },
      ]);
      const ready = getReadyTasks(graph);
      assert.equal(ready.length, 3);
      assert.ok(ready.includes('a'));
      assert.ok(ready.includes('b'));
      assert.ok(ready.includes('c'));
    });

    it('should return only tasks whose deps are completed', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'completed', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
        { id: 'c', status: 'pending', dependencies: ['a', 'b'] },
      ]);
      const ready = getReadyTasks(graph);
      // 'b' is ready (dep 'a' completed), 'c' is not (dep 'b' pending)
      assert.deepStrictEqual(ready, ['b']);
    });

    it('should not include non-pending tasks', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'running', dependencies: [] },
        { id: 'b', status: 'completed', dependencies: [] },
        { id: 'c', status: 'pending', dependencies: [] },
      ]);
      const ready = getReadyTasks(graph);
      assert.deepStrictEqual(ready, ['c']);
    });

    it('should return empty for empty graph', () => {
      const graph = createTaskGraph([]);
      assert.deepStrictEqual(getReadyTasks(graph), []);
    });

    it('should not return tasks whose deps are failed', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'failed', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
      ]);
      const ready = getReadyTasks(graph);
      assert.deepStrictEqual(ready, []);
    });
  });

  describe('markCompleted', () => {
    it('should return new graph with task marked completed', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
      ]);
      const updated = markCompleted(graph, 'a');
      assert.equal(updated.nodes.get('a')?.status, 'completed');
      // Original graph is unchanged (immutability)
      assert.equal(graph.nodes.get('a')?.status, 'pending');
    });

    it('should make downstream tasks ready after completion', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
      ]);
      const updated = markCompleted(graph, 'a');
      const ready = getReadyTasks(updated);
      assert.deepStrictEqual(ready, ['b']);
    });

    it('should not make downstream ready if other deps remain', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: [] },
        { id: 'c', status: 'pending', dependencies: ['a', 'b'] },
      ]);
      const updated = markCompleted(graph, 'a');
      const ready = getReadyTasks(updated);
      // c still depends on b (pending), so only b is ready
      assert.ok(ready.includes('b'));
      assert.ok(!ready.includes('c'));
    });
  });

  describe('markFailed', () => {
    it('should return new graph with task marked failed', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
      ]);
      const updated = markFailed(graph, 'a');
      assert.equal(updated.nodes.get('a')?.status, 'failed');
    });

    it('should cascade abandon to downstream pending tasks', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
        { id: 'c', status: 'pending', dependencies: ['b'] },
      ]);
      const updated = markFailed(graph, 'a');
      assert.equal(updated.nodes.get('a')?.status, 'failed');
      assert.equal(updated.nodes.get('b')?.status, 'abandoned');
      assert.equal(updated.nodes.get('c')?.status, 'abandoned');
    });
  });

  describe('getTopologicalOrder', () => {
    it('should return correct order for linear chain', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
        { id: 'c', status: 'pending', dependencies: ['b'] },
      ]);
      const order = getTopologicalOrder(graph);
      assert.deepStrictEqual(order, ['a', 'b', 'c']);
    });

    it('should return valid order for diamond DAG', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'pending', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
        { id: 'c', status: 'pending', dependencies: ['a'] },
        { id: 'd', status: 'pending', dependencies: ['b', 'c'] },
      ]);
      const order = getTopologicalOrder(graph);
      // 'a' must come first, 'd' must come last
      assert.equal(order[0], 'a');
      assert.equal(order[order.length - 1], 'd');
      assert.equal(order.length, 4);
      // b and c must come after a but before d
      assert.ok(order.indexOf('b') > order.indexOf('a'));
      assert.ok(order.indexOf('c') > order.indexOf('a'));
    });

    it('should return empty array for empty graph', () => {
      const graph = createTaskGraph([]);
      assert.deepStrictEqual(getTopologicalOrder(graph), []);
    });
  });

  describe('isTerminal', () => {
    it('should return true when all tasks are completed', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'completed', dependencies: [] },
        { id: 'b', status: 'completed', dependencies: ['a'] },
      ]);
      assert.equal(isTerminal(graph), true);
    });

    it('should return true when all tasks are abandoned', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'abandoned', dependencies: [] },
        { id: 'b', status: 'abandoned', dependencies: [] },
      ]);
      assert.equal(isTerminal(graph), true);
    });

    it('should return true for mixed completed/abandoned/failed', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'completed', dependencies: [] },
        { id: 'b', status: 'abandoned', dependencies: [] },
        { id: 'c', status: 'failed', dependencies: [] },
      ]);
      assert.equal(isTerminal(graph), true);
    });

    it('should return false when any task is pending', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'completed', dependencies: [] },
        { id: 'b', status: 'pending', dependencies: ['a'] },
      ]);
      assert.equal(isTerminal(graph), false);
    });

    it('should return false when any task is running', () => {
      const graph = createTaskGraph([
        { id: 'a', status: 'running', dependencies: [] },
      ]);
      assert.equal(isTerminal(graph), false);
    });

    it('should return true for empty graph', () => {
      const graph = createTaskGraph([]);
      assert.equal(isTerminal(graph), true);
    });
  });
});
