import { randomUUID } from 'crypto';
import type { SteeringMessage } from '../protocol/messages.js';
import type { AgentPlan, PlanStep, PlanStepInput } from '../types/index.js';

/**
 * Tracks the agent's plan and maps preemptive advice to specific steps.
 * Automatically remaps advice based on intent when the plan changes.
 */
export class PlanTracker {
  private currentPlan: AgentPlan | null = null;

  /** Called when the agent creates a new plan */
  setPlan(steps: PlanStepInput[]): AgentPlan {
    const plan: AgentPlan = {
      id: randomUUID(),
      version: 1,
      steps: steps.map((s, i) => ({
        id: randomUUID(),
        description: s.description,
        intent: s.intent,
        status: 'pending' as const,
        order: i,
        attachedAdvice: [],
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.currentPlan = plan;
    return plan;
  }

  /**
   * Called when the agent modifies its plan.
   * Remaps existing pending advice to new steps based on intent.
   */
  updatePlan(newSteps: PlanStepInput[]): {
    plan: AgentPlan;
    remapped: Array<{ advice: SteeringMessage; from: string; to: string }>;
    orphaned: SteeringMessage[];
  } {
    const oldPlan = this.currentPlan;

    // Collect existing advice (only those not yet applied)
    const pendingAdvice: Array<{ advice: SteeringMessage; oldStepId: string; intent: string }> = [];
    if (oldPlan) {
      for (const step of oldPlan.steps) {
        for (const advice of step.attachedAdvice) {
          if (advice.status === 'queued' || advice.status === 'sent') {
            pendingAdvice.push({
              advice,
              oldStepId: step.id,
              intent: advice.targetStepIntent || step.intent,
            });
          }
        }
      }
    }

    // Create the new plan
    const plan: AgentPlan = {
      id: oldPlan?.id ?? randomUUID(),
      version: (oldPlan?.version ?? 0) + 1,
      steps: newSteps.map((s, i) => ({
        id: randomUUID(),
        description: s.description,
        intent: s.intent,
        status: 'pending' as const,
        order: i,
        attachedAdvice: [],
      })),
      createdAt: oldPlan?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };

    // Intent-based remapping
    const remapped: Array<{ advice: SteeringMessage; from: string; to: string }> = [];
    const orphaned: SteeringMessage[] = [];

    for (const { advice, oldStepId, intent } of pendingAdvice) {
      // Find a new step with the same intent
      const newStep = plan.steps.find(
        (s) => s.intent === intent && s.attachedAdvice.length === 0
      );

      if (newStep) {
        advice.targetStepId = newStep.id;
        newStep.attachedAdvice.push(advice);
        remapped.push({ advice, from: oldStepId, to: newStep.id });
      } else {
        advice.status = 'expired';
        orphaned.push(advice);
      }
    }

    this.currentPlan = plan;

    return { plan, remapped, orphaned };
  }

  /** Attach preemptive advice to a specific step */
  annotate(stepId: string, content: string): SteeringMessage | null {
    if (!this.currentPlan) return null;

    const step = this.currentPlan.steps.find((s) => s.id === stepId);
    if (!step) return null;

    const message: SteeringMessage = {
      id: randomUUID(),
      type: 'preemptive',
      content,
      status: 'queued',
      createdAt: Date.now(),
      targetStepId: stepId,
      targetStepIntent: step.intent,
    };

    step.attachedAdvice.push(message);
    return message;
  }

  /** Get advice attached to a specific step when it is reached */
  getAdviceForStep(stepId: string): SteeringMessage[] {
    if (!this.currentPlan) return [];

    const step = this.currentPlan.steps.find((s) => s.id === stepId);
    if (!step) return [];

    return step.attachedAdvice.filter(
      (a) => a.status === 'queued' || a.status === 'sent'
    );
  }

  /** Return the current plan (for UI display) */
  getCurrentPlan(): AgentPlan | null {
    return this.currentPlan;
  }

  /** Change a step's status to active */
  markStepActive(stepId: string): void {
    if (!this.currentPlan) return;
    const step = this.currentPlan.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = 'active';
    }
  }

  /** Change a step's status to completed */
  markStepCompleted(stepId: string): void {
    if (!this.currentPlan) return;
    const step = this.currentPlan.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = 'completed';
    }
  }

  /** Get a specific step */
  getStep(stepId: string): PlanStep | undefined {
    return this.currentPlan?.steps.find((s) => s.id === stepId);
  }

  /** Remove advice (only if it hasn't been applied yet) */
  removeAdvice(messageId: string): boolean {
    if (!this.currentPlan) return false;

    for (const step of this.currentPlan.steps) {
      const index = step.attachedAdvice.findIndex((a) => a.id === messageId);
      if (index !== -1 && step.attachedAdvice[index].status !== 'applied') {
        step.attachedAdvice.splice(index, 1);
        return true;
      }
    }
    return false;
  }
}
