// ─── @steer-agent/core ───
// Add real-time coaching-style steering to any AI agent loop.

// Session (Main entry point)
export { SteeringSession } from './session/SteeringSession.js';

// Modules
export { SteeringQueue } from './queue/SteeringQueue.js';
export { PlanTracker } from './plan/PlanTracker.js';
export { SteeringInjector } from './injector/SteeringInjector.js';
export { LoopHook } from './hook/LoopHook.js';

// Types
export type { SteeringMessage, SteeringType, SteeringStatus } from './protocol/messages.js';
export type { SteeringEventMap, SteeringEventName } from './protocol/events.js';
export type {
  AgentPlan,
  PlanStep,
  InjectionResult,
  SteeringSessionOptions,
  StepInfo,
  PlanStepInput,
} from './types/index.js';
