import { AgentPlan, PlanStep } from '../types/index.js';
import type { SteeringMessage } from './messages.js';

/** Event map emitted by SteeringSession */
export interface SteeringEventMap {
  // Advice status changes
  'advice:sent': SteeringMessage;
  'advice:queued': SteeringMessage;
  'advice:acknowledged': SteeringMessage;
  'advice:applied': SteeringMessage;
  'advice:expired': SteeringMessage;
  'advice:removed': SteeringMessage;

  // Plan-related
  'plan:created': AgentPlan;
  'plan:updated': { oldPlan: AgentPlan; newPlan: AgentPlan };
  'plan:step:started': PlanStep;
  'plan:step:completed': PlanStep;

  // Advice affected by plan changes
  'advice:remapped': { advice: SteeringMessage; oldStepId: string; newStepId: string };
  'advice:orphaned': SteeringMessage;
}

/** Union type of event names */
export type SteeringEventName = keyof SteeringEventMap;
