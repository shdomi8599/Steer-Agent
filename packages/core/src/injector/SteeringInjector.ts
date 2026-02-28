import type { SteeringMessage } from '../protocol/messages.js';
import type { InjectionResult } from '../types/index.js';

/** Convert time elapsed into a human-readable format */
function timeSince(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Formats advice messages into text to be injected into the agent's prompt.
 * Consolidates Reactive and Preemptive advice into a single injection block.
 */
export class SteeringInjector {
  private maxMessages: number;
  private customFormatter?: (reactive: SteeringMessage[], preemptive: SteeringMessage[]) => string;

  constructor(options?: {
    maxMessages?: number;
    customFormatter?: (reactive: SteeringMessage[], preemptive: SteeringMessage[]) => string;
  }) {
    this.maxMessages = options?.maxMessages ?? 5;
    this.customFormatter = options?.customFormatter;
  }

  /**
   * Consolidate Reactive and Preemptive advice into a single injection text format.
   */
  format(options: {
    reactiveMessages: SteeringMessage[];
    preemptiveMessages: SteeringMessage[];
    currentStepDescription?: string;
  }): InjectionResult {
    const { reactiveMessages, preemptiveMessages, currentStepDescription } = options;

    // Return an empty result if there is no advice
    if (reactiveMessages.length === 0 && preemptiveMessages.length === 0) {
      return {
        injectionText: '',
        includedMessageIds: [],
        hasAdvice: false,
      };
    }

    // Use a custom formatter if provided
    if (this.customFormatter) {
      const text = this.customFormatter(reactiveMessages, preemptiveMessages);
      return {
        injectionText: text,
        includedMessageIds: [
          ...reactiveMessages.map((m) => m.id),
          ...preemptiveMessages.map((m) => m.id),
        ],
        hasAdvice: true,
      };
    }

    // Limit the number of messages (prioritize the most recent)
    const trimmedReactive = reactiveMessages.slice(-this.maxMessages);
    const trimmedPreemptive = preemptiveMessages.slice(-this.maxMessages);

    const includedIds: string[] = [];
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════');
    lines.push('[STEERING ADVICE FROM USER]');
    lines.push(
      'The user is collaborating with you in real-time and has sent coaching advice.'
    );
    lines.push(
      'Consider the following advice for your current/next action.'
    );
    lines.push(
      'Follow it when relevant, but use your judgment if it conflicts with the current context.'
    );
    lines.push('───────────────────────────────────────');

    // Reactive advice
    if (trimmedReactive.length > 0) {
      lines.push('');
      lines.push('── Real-time Advice (sent during your current work) ──');
      for (const msg of trimmedReactive) {
        const time = timeSince(msg.createdAt);
        const stepInfo = msg.agentStepAtCreation
          ? `, during step: "${msg.agentStepAtCreation}"`
          : '';
        lines.push(`• [${time}${stepInfo}] "${msg.content}"`);
        includedIds.push(msg.id);
      }
    }

    // Preemptive advice
    if (trimmedPreemptive.length > 0) {
      lines.push('');
      const stepDesc = currentStepDescription
        ? ` ("${currentStepDescription}")`
        : '';
      lines.push(
        `── Pre-attached Advice (left by user for this specific step${stepDesc}) ──`
      );
      for (const msg of trimmedPreemptive) {
        lines.push(`• "${msg.content}"`);
        includedIds.push(msg.id);
      }
    }

    lines.push('');
    lines.push('═══════════════════════════════════════');

    return {
      injectionText: lines.join('\n'),
      includedMessageIds: includedIds,
      hasAdvice: true,
    };
  }
}
