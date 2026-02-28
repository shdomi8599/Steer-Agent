# 🏗️ Architecture — @steer-agent/core

> **Version**: 1.0  
> **Last Updated**: 2026-03-01  
> **Core Principle**: Coach an AI agent in real-time without stopping it — like adjusting the steering wheel while the car is moving.

---

## 1. Overview

### What This Library Does

`@steer-agent/core` is **not** an agent. It's a middleware that adds **coaching-style steering** to any existing AI agent loop.

```
┌──────────────────────────────────────────────────┐
│  Any Agent (Roo Code, Cline, custom, etc.)       │
│  ┌────────────────────────────────────────────┐  │
│  │  Agent Loop                                │  │
│  │  [Plan] → [Step 1] → [Step 2] → [Step 3]  │  │
│  │              ↑           ↑           ↑      │  │
│  │         ┌────┴───────────┴───────────┴──┐  │  │
│  │         │     @steer-agent/core         │  │  │
│  │         │  (check queue + inject advice) │  │  │
│  │         └───────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
│                        ↑                          │
│                  User's advice                    │
└──────────────────────────────────────────────────┘
```

### Two Steering Modes

| Mode           | Description                                         | When Applied              |
| -------------- | --------------------------------------------------- | ------------------------- |
| **Reactive**   | Real-time advice sent while the agent is working    | Next step after current   |
| **Preemptive** | Advice attached to a future planned step in advance | When that step is reached |

---

## 2. Module Structure

```
@steer-agent/core
├── index.ts                    # Entry point, re-exports all modules
│
├── session/
│   └── SteeringSession.ts      # Orchestrator coordinating all modules
│
├── queue/
│   └── SteeringQueue.ts        # Reactive advice queue management
│
├── plan/
│   └── PlanTracker.ts          # Agent plan tracking + preemptive advice mapping
│
├── injector/
│   └── SteeringInjector.ts     # Formats advice into LLM prompt injection text
│
├── hook/
│   └── LoopHook.ts             # Hook interface for agent loops
│
├── protocol/
│   ├── messages.ts             # Message type definitions
│   └── events.ts               # Event type definitions
│
└── types/
    └── index.ts                # Shared types
```

---

## 3. Data Flow

### 3.1 Reactive Steering

```
User                     SteeringQueue          LoopHook              Agent
  │                           │                     │                    │
  │  ① Send advice            │                     │                    │
  │  "Use UTF-8 encoding"    │                     │                    │
  │ ──────────────────────>   │                     │                    │
  │                           │  enqueue()          │                    │
  │                           │                     │                    │
  │  ◀── 📤 "sent" status    │                     │                    │
  │                           │                     │  ② Current step    │
  │                           │                     │     complete       │
  │                           │                     │ <────────────────  │
  │                           │  ③ drain()          │                    │
  │                           │ <────────────────── │                    │
  │                           │ ───────────────────>│                    │
  │                           │                     │  ④ Inject into     │
  │  ◀── ✅ "acknowledged"   │                     │     prompt         │
  │                           │                     │ ──────────────────>│
  │                           │                     │                    │
  │                           │                     │  ⑤ Execute next    │
  │                           │                     │     step (with     │
  │  ◀── 🎯 "applied"        │                     │     advice)        │
```

### 3.2 Preemptive Steering

```
User                     PlanTracker            LoopHook              Agent
  │                           │                     │                    │
  │                           │                     │  ① Plan created    │
  │                           │  setPlan()          │ <────────────────  │
  │                           │ <────────────────── │                    │
  │                           │                     │                    │
  │  ◀── 📋 Plan displayed   │                     │                    │
  │  [Step A] [Step B] [C]    │                     │                    │
  │                           │                     │                    │
  │  ② Attach to Step B      │                     │                    │
  │  "Use Vitest, not Jest"   │                     │                    │
  │ ──────────────────────>   │                     │                    │
  │                           │  annotate()         │                    │
  │  ◀── 📌 Advice pinned    │                     │                    │
  │                           │                     │                    │
  │                           │                     │  ③ Step A done,    │
  │                           │  ④ getAdviceFor     │     entering B     │
  │                           │    (stepB)          │                    │
  │                           │ <────────────────── │                    │
  │                           │ ───────────────────>│  ⑤ Inject + run B │
  │                           │                     │ ──────────────────>│
  │  ◀── 🎯 "applied"        │                     │                    │
```

### 3.3 Plan Changes

When the agent modifies its plan mid-execution, existing preemptive advice
is **remapped by intent**, not by step index:

```
Original plan:   [A] → [B:testing] → [C]
                         ↑ advice attached

Updated plan:    [A] → [B':testing] → [D] → [C]
                         ↑ advice remapped (same intent: "testing")
```

If a step's intent disappears from the new plan, the advice is marked as
`orphaned` and an event is emitted to notify the UI.

---

## 4. Integration Guide

### Minimal Integration — 3 Lines

```typescript
import { SteeringSession } from "@steer-agent/core";

// 1. Create a session
const steering = new SteeringSession();

// 2. Inside your agent loop (add 2 lines)
async function agentLoop(task: string) {
  const hook = steering.getLoopHook();

  const plan = generatePlan(task);
  hook.onPlanCreated(plan.steps);

  for (const step of plan.steps) {
    hook.onStepStart(step);

    // ★ This single line is the core: inject steering advice into the prompt
    const { injectionText } = hook.getInjection(step);

    const result = await callLLM(step.prompt + injectionText);

    hook.onStepComplete(step);
  }
}
```

### Adding Advice (From UI / External Input)

```typescript
// Reactive: send while the agent is working
steering.addReactiveAdvice("Use TypeScript strict mode");

// Preemptive: attach to a future step
const plan = steering.getPlan();
steering.addPreemptiveAdvice(plan.steps[2].id, "Use Vitest instead of Jest");

// Listen for status changes
steering.on("advice:applied", (msg) => {
  console.log(`✅ Applied: ${msg.content}`);
});
```

---

## 5. Injection Format

When advice exists, `getInjection()` returns text like this to be appended
to the agent's prompt:

```
═══════════════════════════════════════
[STEERING ADVICE FROM USER]
The user is collaborating with you in real-time and has sent coaching advice.
Consider the following advice for your current/next action.
Follow it when relevant, but use your judgment if it conflicts with the current context.
───────────────────────────────────────

── Real-time Advice (sent during your current work) ──
• [2m ago] "Use UTF-8 encoding explicitly"

── Pre-attached Advice (left by user for this specific step ("Write Tests")) ──
• "Use Vitest instead of Jest"
• "Target 80%+ test coverage"

═══════════════════════════════════════
```

When no advice is pending, `getInjection()` returns an empty string with
`hasAdvice: false` — zero overhead.

---

## 6. Event System

`SteeringSession` emits typed events for UI integration:

| Event                 | Payload                          | When                             |
| --------------------- | -------------------------------- | -------------------------------- |
| `advice:sent`         | `SteeringMessage`                | User sends advice                |
| `advice:queued`       | `SteeringMessage`                | Advice enters the queue          |
| `advice:acknowledged` | `SteeringMessage`                | Agent picks up the advice        |
| `advice:applied`      | `SteeringMessage`                | Agent completes step with advice |
| `advice:expired`      | `SteeringMessage`                | Advice TTL expired               |
| `plan:created`        | `AgentPlan`                      | Agent creates a plan             |
| `plan:updated`        | `{oldPlan, newPlan}`             | Agent modifies the plan          |
| `advice:remapped`     | `{advice, oldStepId, newStepId}` | Advice moved to new step         |
| `advice:orphaned`     | `SteeringMessage`                | Advice lost due to plan change   |

---

## 7. Key Design Decisions

### Agent-Agnostic

The library has zero dependencies on any specific agent framework.
It only provides a queue, a formatter, and a hook — the agent developer
chooses where to call them.

### No External Dependencies

`@steer-agent/core` uses only Node.js built-ins (`crypto` for UUID).
No LangChain, no LLM SDK, no framework lock-in.

### Intent-Based Remapping

Preemptive advice survives plan changes because it's linked to
**intent** (e.g., "testing"), not step index. This is critical because
agent plans are inherently dynamic.

### Token Cost Awareness

- 0 advice → 0 extra tokens (no injection text generated)
- 1-3 advice → ~50-150 tokens (negligible)
- 5+ advice → capped at most recent messages to control cost

---

## 8. Test Coverage

```
 ✓ tests/SteeringQueue.test.ts     (12 tests)
 ✓ tests/PlanTracker.test.ts       (8 tests)
 ✓ tests/SteeringSession.test.ts   (8 tests)
 ────────────────────────────────────
 Total: 28 tests passing
```

Key scenarios tested:

- Full reactive flow: enqueue → drain → inject → apply
- Full preemptive flow: annotate → reach step → inject
- Mixed reactive + preemptive injection
- Plan changes with intent-based remapping
- Orphaned advice on plan change
- TTL expiration and queue size limits
- Event emission verification
