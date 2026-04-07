// Domain Layer — TaskGraph DAG with Topological Sort (Kahn's Algorithm)

import { type TaskStatus } from "./task.js";
import { cycleDetected, taskNotFound } from "./errors.js";

export interface TaskNode {
  readonly taskId: string;
  readonly status: TaskStatus;
  readonly dependencies: string[];
  readonly dependents: string[];
}

export interface TaskGraph {
  readonly nodes: ReadonlyMap<string, TaskNode>;
}

export function createTaskGraph(
  tasks: Array<{ id: string; status: TaskStatus; dependencies: string[] }>
): TaskGraph {
  const nodes = new Map<string, TaskNode>();

  for (const task of tasks) {
    nodes.set(task.id, {
      taskId: task.id,
      status: task.status,
      dependencies: [...task.dependencies],
      dependents: [],
    });
  }

  // WHY: 二次遍歷建立反向邊，讓 markFailed 能快速找到下游 tasks
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const depNode = nodes.get(depId);
      if (depNode) {
        nodes.set(depId, {
          ...depNode,
          dependents: [...depNode.dependents, task.id],
        });
      }
    }
  }

  const graph: TaskGraph = { nodes };

  if (hasCycle(graph)) {
    throw cycleDetected();
  }

  return graph;
}

export function getReadyTasks(graph: TaskGraph): string[] {
  const ready: string[] = [];

  for (const [taskId, node] of graph.nodes) {
    if (node.status !== "pending") continue;

    const allDepsCompleted = node.dependencies.every((depId) => {
      const dep = graph.nodes.get(depId);
      return dep !== undefined && dep.status === "completed";
    });

    if (allDepsCompleted) {
      ready.push(taskId);
    }
  }

  return ready.sort();
}

export function markCompleted(graph: TaskGraph, taskId: string): TaskGraph {
  const node = graph.nodes.get(taskId);
  if (!node) throw taskNotFound(taskId);

  const updated = new Map(graph.nodes);
  updated.set(taskId, { ...node, status: "completed" });

  return { nodes: updated };
}

export function markFailed(graph: TaskGraph, taskId: string): TaskGraph {
  const node = graph.nodes.get(taskId);
  if (!node) throw taskNotFound(taskId);

  const updated = new Map(graph.nodes);
  updated.set(taskId, { ...node, status: "failed" });

  // WHY: 級聯標記所有下游 tasks 為 abandoned，因為它們的依賴已無法滿足
  const toAbandon = collectDownstream(graph, taskId);
  for (const downstreamId of toAbandon) {
    const downstream = updated.get(downstreamId);
    if (downstream && downstream.status === "pending") {
      updated.set(downstreamId, { ...downstream, status: "abandoned" });
    }
  }

  return { nodes: updated };
}

function collectDownstream(graph: TaskGraph, taskId: string): string[] {
  const visited = new Set<string>();
  const queue: string[] = [];

  const startNode = graph.nodes.get(taskId);
  if (!startNode) return [];

  for (const dep of startNode.dependents) {
    queue.push(dep);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const currentNode = graph.nodes.get(current);
    if (currentNode) {
      for (const dep of currentNode.dependents) {
        queue.push(dep);
      }
    }
  }

  return Array.from(visited);
}

export function hasCycle(graph: TaskGraph): boolean {
  const order = topologicalSort(graph);
  return order === null;
}

export function getTopologicalOrder(graph: TaskGraph): string[] {
  const order = topologicalSort(graph);
  if (order === null) {
    throw cycleDetected();
  }
  return order;
}

function topologicalSort(graph: TaskGraph): string[] | null {
  const inDegree = new Map<string, number>();
  for (const [taskId, node] of graph.nodes) {
    inDegree.set(taskId, node.dependencies.length);
  }

  const queue: string[] = [];
  for (const [taskId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(taskId);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    queue.sort();
    const current = queue.shift()!;
    result.push(current);

    const node = graph.nodes.get(current);
    if (!node) continue;

    for (const dependentId of node.dependents) {
      const currentDegree = inDegree.get(dependentId) ?? 0;
      const newDegree = currentDegree - 1;
      inDegree.set(dependentId, newDegree);
      if (newDegree === 0) {
        queue.push(dependentId);
      }
    }
  }

  if (result.length !== graph.nodes.size) {
    return null;
  }

  return result;
}

// WHY: DAG 的最大平行寬度決定 mission 需要多少個 concurrent sessions
export function getMaxParallelWidth(graph: TaskGraph): number {
  const order = topologicalSort(graph);
  if (!order || order.length === 0) return 1;

  // 計算每個 node 的 depth（最長路徑）
  const depth = new Map<string, number>();
  for (const taskId of order) {
    const node = graph.nodes.get(taskId)!;
    let maxDepDep = -1;
    for (const dep of node.dependencies) {
      maxDepDep = Math.max(maxDepDep, depth.get(dep) ?? 0);
    }
    depth.set(taskId, maxDepDep + 1);
  }

  // 統計每層的節點數，取最大值
  const levelCount = new Map<number, number>();
  for (const d of depth.values()) {
    levelCount.set(d, (levelCount.get(d) ?? 0) + 1);
  }

  let maxWidth = 1;
  for (const count of levelCount.values()) {
    maxWidth = Math.max(maxWidth, count);
  }
  return maxWidth;
}

// AI-INVARIANT: Terminal means no more work can be done — all tasks are in a final state
export function isTerminal(graph: TaskGraph): boolean {
  for (const [, node] of graph.nodes) {
    if (
      node.status !== "completed" &&
      node.status !== "abandoned" &&
      node.status !== "failed"
    ) {
      return false;
    }
  }
  return true;
}

export function updateNodeStatus(
  graph: TaskGraph,
  taskId: string,
  status: TaskStatus
): TaskGraph {
  const node = graph.nodes.get(taskId);
  if (!node) throw taskNotFound(taskId);

  const updated = new Map(graph.nodes);
  updated.set(taskId, { ...node, status });

  return { nodes: updated };
}
