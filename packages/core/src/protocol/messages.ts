// ─── Steering Message Types ───

/** The type of steering message */
export type SteeringType = 'reactive' | 'preemptive';

/** Current status of the advice */
export type SteeringStatus =
  | 'sent'          // 📤 Sent by the user
  | 'queued'        // ⏳ Waiting in the queue
  | 'acknowledged'  // ✅ Acknowledged by the agent
  | 'applied'       // 🎯 Applied to the next step
  | 'expired';      // ⏰ Expired (e.g., TTL passed or plan changed)

/** Steering message */
export interface SteeringMessage {
  id: string;
  type: SteeringType;
  content: string;
  status: SteeringStatus;

  // Metadata
  createdAt: number;
  acknowledgedAt?: number;
  appliedAt?: number;

  // Reactive-specific: The step the agent was performing when the advice was created
  agentStepAtCreation?: string;

  // Preemptive-specific
  targetStepId?: string;
  targetStepIntent?: string;
}
