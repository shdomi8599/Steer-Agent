import type { SteeringQueue } from '../queue/SteeringQueue.js';
import type { PlanTracker } from '../plan/PlanTracker.js';
import type { SteeringInjector } from '../injector/SteeringInjector.js';
import type { AgentPlan, InjectionResult, PlanStepInput, StepInfo } from '../types/index.js';

/** Callbacks for LoopHook events */
export interface LoopHookCallbacks {
  onAdviceAcknowledged?: (messageIds: string[]) => void;
  onAdviceApplied?: (messageIds: string[]) => void;
  onStepStarted?: (step: StepInfo) => void;
  onStepCompleted?: (step: StepInfo) => void;
  onPlanCreated?: (plan: AgentPlan) => void;
  onPlanUpdated?: (result: ReturnType<PlanTracker['updatePlan']>) => void;
}

/**
 * A hook that integrates into the agent's execution loop.
 * Steering activates when an agent developer calls this hook's methods in their existing loop.
 *
 * Example Usage:
 *   const hook = session.getLoopHook();
 *
 *   for (const step of plan) {
 *     hook.onStepStart(step);
 *     const { injectionText } = hook.getInjection(step);
 *     const result = await executeLLM(prompt + injectionText);
 *     hook.onStepComplete(step);
 *   }
 */
export class LoopHook {
  private currentStep: StepInfo | null = null;
  private lastInjectedIds: string[] = [];

  constructor(
    private queue: SteeringQueue,
    private planTracker: PlanTracker,
    private injector: SteeringInjector,
    private callbacks?: LoopHookCallbacks
  ) {}

  /** Called when the agent starts a new step */
  onStepStart(step: StepInfo): void {
    this.currentStep = step;
    this.planTracker.markStepActive(step.id);
    this.callbacks?.onStepStarted?.(step);
  }

  /**
   * Called right before the agent triggers the LLM.
   * Returns formatted injection text combining both Reactive Queue and Preemptive advice.
   *
   * Calling this single method makes the steering logic work within the prompt.
   */
  getInjection(step: StepInfo): InjectionResult {
    // 1. Dequeue messages from the Reactive queue
    const reactiveMessages = this.queue.drain();

    // 2. Fetch Preemptive advice
    const preemptiveMessages = this.planTracker.getAdviceForStep(step.id);

    // 3. Format into injection text
    const result = this.injector.format({
      reactiveMessages,
      preemptiveMessages,
      currentStepDescription: step.description,
    });

    // 4. Update status to 'acknowledged'
    for (const id of result.includedMessageIds) {
      this.queue.updateStatus(id, 'acknowledged');
    }
    this.lastInjectedIds = result.includedMessageIds;

    // 5. Emit callback
    if (result.includedMessageIds.length > 0) {
      this.callbacks?.onAdviceAcknowledged?.(result.includedMessageIds);
    }

    return result;
  }

  /** Called when the agent completes a step */
  onStepComplete(step: StepInfo): void {
    this.planTracker.markStepCompleted(step.id);

    // Transition the status of the last injected advice to 'applied'
    for (const id of this.lastInjectedIds) {
      this.queue.updateStatus(id, 'applied');
    }

    if (this.lastInjectedIds.length > 0) {
      this.callbacks?.onAdviceApplied?.(this.lastInjectedIds);
    }

    this.lastInjectedIds = [];
    this.currentStep = null;
    this.callbacks?.onStepCompleted?.(step);
  }

  /** Called when the agent creates a plan */
  onPlanCreated(steps: PlanStepInput[]): AgentPlan {
    const plan = this.planTracker.setPlan(steps);
    this.callbacks?.onPlanCreated?.(plan);
    return plan;
  }

  /** Called when the agent updates its existing plan */
  onPlanUpdated(newSteps: PlanStepInput[]): void {
    const result = this.planTracker.updatePlan(newSteps);
    this.callbacks?.onPlanUpdated?.(result);
  }

  /** Info about the currently running step */
  getCurrentStep(): StepInfo | null {
    return this.currentStep;
  }
}
