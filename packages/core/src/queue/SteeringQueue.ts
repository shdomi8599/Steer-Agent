import { randomUUID } from 'crypto';
import type { SteeringMessage, SteeringStatus } from '../protocol/messages.js';

/**
 * A queue that manages Reactive steering messages.
 * The agent calls drain() between steps to fetch accumulated advice.
 */
export class SteeringQueue {
  private queue: SteeringMessage[] = [];
  private allMessages: Map<string, SteeringMessage> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(options?: { maxSize?: number; ttl?: number }) {
    this.maxSize = options?.maxSize ?? 20;
    this.ttl = options?.ttl ?? 300_000; // 5 minutes
  }

  /**
   * Add user's reactive advice to the queue.
   * @param content The advice content
   * @param currentStepId The ID of the step the agent was performing when advice was created
   */
  enqueue(content: string, currentStepId?: string): SteeringMessage {
    // Clean up expired messages
    this.expireOldMessages();

    // Queue size limit: remove the oldest message
    if (this.queue.length >= this.maxSize) {
      const removed = this.queue.shift();
      if (removed) {
        removed.status = 'expired';
      }
    }

    const message: SteeringMessage = {
      id: randomUUID(),
      type: 'reactive',
      content,
      status: 'queued',
      createdAt: Date.now(),
      agentStepAtCreation: currentStepId,
    };

    this.queue.push(message);
    this.allMessages.set(message.id, message);

    return message;
  }

  /**
   * Dequeue and clear all pending messages.
   * Called by the agent loop between steps.
   */
  drain(): SteeringMessage[] {
    this.expireOldMessages();
    const messages = [...this.queue];
    this.queue = [];
    return messages;
  }

  /** Number of messages waiting in the queue */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Check if the queue is not empty (for quick checks in the agent loop) */
  get hasMessages(): boolean {
    return this.queue.length > 0;
  }

  /** Update the status of a specific message */
  updateStatus(messageId: string, status: SteeringStatus): void {
    const message = this.allMessages.get(messageId);
    if (message) {
      message.status = status;
      if (status === 'acknowledged') {
        message.acknowledgedAt = Date.now();
      } else if (status === 'applied') {
        message.appliedAt = Date.now();
      }
    }
  }

  /** Get a specific message */
  getMessage(messageId: string): SteeringMessage | undefined {
    return this.allMessages.get(messageId);
  }

  /** Return all messages (can be filtered by status) */
  getAllMessages(filter?: { status?: SteeringStatus }): SteeringMessage[] {
    const messages = Array.from(this.allMessages.values());
    if (filter?.status) {
      return messages.filter((m) => m.status === filter.status);
    }
    return messages;
  }

  /** Remove a message (only if it's still in the queue) */
  remove(messageId: string): boolean {
    const index = this.queue.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.allMessages.delete(messageId);
      return true;
    }
    return false;
  }

  /** Process TTL expired messages */
  private expireOldMessages(): void {
    const now = Date.now();
    this.queue = this.queue.filter((m) => {
      if (now - m.createdAt > this.ttl) {
        m.status = 'expired';
        return false;
      }
      return true;
    });
  }
}
