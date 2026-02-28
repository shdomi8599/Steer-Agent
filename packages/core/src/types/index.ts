import type { SteeringMessage } from '../protocol/messages.js';

// ─── Agent Plan Types ───

/** Individual step of an agent's plan */
export interface PlanStep {
  id: string;
  description: string;
  intent: string; // e.g., 'coding', 'testing', 'refactoring'
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'changed';
  order: number;

  /** Preemptive advice attached to this step */
  attachedAdvice: SteeringMessage[];
}

/** The agent's overall plan */
export interface AgentPlan {
  id: string;
  version: number;
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
}

// ─── Injection Types ───

/** Output of the SteeringInjector */
export interface InjectionResult {
  /** Text to inject into the agent's prompt */
  injectionText: string;
  /** List of message IDs included in the injection */
  includedMessageIds: string[];
  /** Whether any advice was injected */
  hasAdvice: boolean;
}

// ─── Session Options ───

/** Options for creating a SteeringSession */
export interface SteeringSessionOptions {
  /** Maximum retention time for advice (ms). Default: 300000 (5 minutes) */
  adviceTTL?: number;
  /** Maximum queue size. Default: 20 */
  maxQueueSize?: number;
  /** Language for the injection prompt. Default: 'en' */
  locale?: 'en' | 'ko' | 'ja' | 'zh';
  /** Custom formatter for the injection text */
  customFormatter?: (reactive: SteeringMessage[], preemptive: SteeringMessage[]) => string;
}

// ─── Step Input (Step info provided by the agent) ───

/** Step info passed to LoopHook by the agent */
export interface StepInfo {
  id: string;
  description: string;
  intent?: string;
}

/** Step info passed when creating a plan */
export interface PlanStepInput {
  description: string;
  intent: string;
}
