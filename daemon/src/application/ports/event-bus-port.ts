// src/application/ports/event-bus-port.ts
// WHY: Port 定義在 application 層，讓 use case 可以 emit 事件而不依賴 infrastructure

import type { DaemonEvent } from "../../domain/daemon-event.js";

export type EventHandler = (event: DaemonEvent) => void;

export interface EventBusPort {
  /** 發射事件，所有 subscribers 同步接收 */
  emit(event: DaemonEvent): void;

  /** 訂閱所有事件 */
  subscribe(handler: EventHandler): void;

  /** 取消訂閱 */
  unsubscribe(handler: EventHandler): void;
}
