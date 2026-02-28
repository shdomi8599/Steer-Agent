import { SteeringQueue } from '../queue/SteeringQueue.js';
import { PlanTracker } from '../plan/PlanTracker.js';
import { SteeringInjector } from '../injector/SteeringInjector.js';
import { LoopHook } from '../hook/LoopHook.js';
import type { SteeringMessage, SteeringStatus, SteeringType } from '../protocol/messages.js';
import type { SteeringEventMap, SteeringEventName } from '../protocol/events.js';
import type { AgentPlan, SteeringSessionOptions } from '../types/index.js';

type EventListener<T extends SteeringEventName> = (payload: SteeringEventMap[T]) => void;

/**
 * The main session coordinating all modules.
 * Agent developers can simply instantiate this to enable steering behavior.
 *
 * @example
 * ```typescript
 * import { SteeringSession } from '@steer-agent/core';
 *
 * const session = new SteeringSession();
 * const hook = session.getLoopHook();
 *
 * // Add advice from the UI
 * session.addReactiveAdvice("Specify UTF-8 encoding");
 * session.addPreemptiveAdvice(stepId, "Use Vitest instead");
 *
 * // Subscribe to events
 * session.on('advice:applied', (msg) => console.log('Applied:', msg.content));
 * ```
 */
export class SteeringSession {
  private queue: SteeringQueue;
  private planTracker: PlanTracker;
  private injector: SteeringInjector;
  private loopHook: LoopHook;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor(options?: SteeringSessionOptions) {
    this.queue = new SteeringQueue({
      maxSize: options?.maxQueueSize,
      ttl: options?.adviceTTL,
    });

    this.planTracker = new PlanTracker();

    this.injector = new SteeringInjector({
      customFormatter: options?.customFormatter,
    });

    this.loopHook = new LoopHook(this.queue, this.planTracker, this.injector, {
      onAdviceAcknowledged: (ids) => {
        for (const id of ids) {
          const msg = this.queue.getMessage(id) || this.findPreemptiveMessage(id);
          if (msg) this.emit('advice:acknowledged', msg);
        }
      },
      onAdviceApplied: (ids) => {
        for (const id of ids) {
          const msg = this.queue.getMessage(id) || this.findPreemptiveMessage(id);
          if (msg) this.emit('advice:applied', msg);
        }
      },
      onStepStarted: (step) => {
        const planStep = this.planTracker.getStep(step.id);
        if (planStep) this.emit('plan:step:started', planStep);
      },
      onStepCompleted: (step) => {
        const planStep = this.planTracker.getStep(step.id);
        if (planStep) this.emit('plan:step:completed', planStep);
      },
      onPlanCreated: (plan) => {
        this.emit('plan:created', plan);
      },
      onPlanUpdated: (result) => {
        const oldPlan = this.planTracker.getCurrentPlan();
        this.emit('plan:updated', {
          oldPlan: oldPlan!,
          newPlan: result.plan,
        });
        for (const r of result.remapped) {
          this.emit('advice:remapped', {
            advice: r.advice,
            oldStepId: r.from,
            newStepId: r.to,
          });
        }
        for (const orphan of result.orphaned) {
          this.emit('advice:orphaned', orphan);
        }
      },
    });
  }

  // ─── User → System (Called by UI layer) ───

  /** Add Reactive advice (Real-time coaching during agent work) */
  addReactiveAdvice(content: string): SteeringMessage {
    const currentStep = this.loopHook.getCurrentStep();
    const message = this.queue.enqueue(content, currentStep?.id);
    this.emit('advice:sent', message);
    this.emit('advice:queued', message);
    return message;
  }

  /** Add Preemptive advice (Attach advice for future steps) */
  addPreemptiveAdvice(stepId: string, content: string): SteeringMessage | null {
    const message = this.planTracker.annotate(stepId, content);
    if (message) {
      this.emit('advice:sent', message);
      this.emit('advice:queued', message);
    }
    return message;
  }

  /** Remove advice (only if it hasn't been applied yet) */
  removeAdvice(messageId: string): boolean {
    // Attempt removing from Reactive queue
    if (this.queue.remove(messageId)) {
      const msg = this.queue.getMessage(messageId);
      if (msg) this.emit('advice:removed', msg);
      return true;
    }
    // Attempt removing from Preemptive tracker
    return this.planTracker.removeAdvice(messageId);
  }

  // ─── System → Agent (Called by agent loop) ───

  /** Return the hook for the agent loop */
  getLoopHook(): LoopHook {
    return this.loopHook;
  }

  // ─── Queries (For UI display) ───

  /** Return all Reactive advice messages */
  getReactiveMessages(filter?: { status?: SteeringStatus }): SteeringMessage[] {
    return this.queue.getAllMessages(filter);
  }

  /** Return the current plan */
  getPlan(): AgentPlan | null {
    return this.planTracker.getCurrentPlan();
  }

  /** Return all combined advice (Reactive + Preemptive) */
  getAllMessages(filter?: { status?: SteeringStatus; type?: SteeringType }): SteeringMessage[] {
    const reactive = this.queue.getAllMessages(
      filter?.status ? { status: filter.status } : undefined
    );
    const plan = this.planTracker.getCurrentPlan();
    const preemptive: SteeringMessage[] = [];

    if (plan) {
      for (const step of plan.steps) {
        for (const advice of step.attachedAdvice) {
          if (!filter?.status || advice.status === filter.status) {
            preemptive.push(advice);
          }
        }
      }
    }

    if (filter?.type === 'reactive') return reactive;
    if (filter?.type === 'preemptive') return preemptive;
    return [...reactive, ...preemptive];
  }

  /** Fetch session statistics */
  getStats(): {
    totalAdvice: number;
    applied: number;
    pending: number;
    expired: number;
    acknowledged: number;
  } {
    const all = this.getAllMessages();
    return {
      totalAdvice: all.length,
      applied: all.filter((m) => m.status === 'applied').length,
      pending: all.filter((m) => m.status === 'queued' || m.status === 'sent').length,
      expired: all.filter((m) => m.status === 'expired').length,
      acknowledged: all.filter((m) => m.status === 'acknowledged').length,
    };
  }

  // ─── Event System ───

  /** Subscribe to events */
  on<T extends SteeringEventName>(event: T, listener: EventListener<T>): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  /** Unsubscribe from events */
  off<T extends SteeringEventName>(event: T, listener: EventListener<T>): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  /** Emit an event */
  private emit<T extends SteeringEventName>(event: T, payload: SteeringEventMap[T]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          (listener as EventListener<T>)(payload);
        } catch (error) {
          console.error(`[SteeringSession] Error in event listener for "${event}":`, error);
        }
      }
    }
  }

  // ─── Internal Helpers ───

  private findPreemptiveMessage(messageId: string): SteeringMessage | undefined {
    const plan = this.planTracker.getCurrentPlan();
    if (!plan) return undefined;
    for (const step of plan.steps) {
      const advice = step.attachedAdvice.find((a) => a.id === messageId);
      if (advice) return advice;
    }
    return undefined;
  }
}
