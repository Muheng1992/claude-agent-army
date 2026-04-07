// src/infrastructure/event-bus.ts
// WHY: In-memory pub/sub 實作，支援事件歷史回補（供 SSE 新連線使用）

import type { DaemonEvent } from "../domain/daemon-event.js";
import type { EventBusPort, EventHandler } from "../application/ports/event-bus-port.js";

const MAX_RECENT_EVENTS = 500;

export class EventBus implements EventBusPort {
  private readonly handlers = new Set<EventHandler>();

  // CONTEXT: 環形緩衝區保留最近 500 筆事件，供新連線的 SSE client 回補
  private readonly recentEvents: DaemonEvent[] = [];

  emit(event: DaemonEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.shift();
    }

    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("[event-bus] Handler error:", err);
      }
    }
  }

  subscribe(handler: EventHandler): void {
    this.handlers.add(handler);
  }

  unsubscribe(handler: EventHandler): void {
    this.handlers.delete(handler);
  }

  /** 取得最近的事件（供 SSE 新連線回補） */
  getRecentEvents(): readonly DaemonEvent[] {
    return [...this.recentEvents];
  }

  /** 取得目前 subscriber 數量（用於 health check） */
  getSubscriberCount(): number {
    return this.handlers.size;
  }
}
