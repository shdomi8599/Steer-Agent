# @steer-agent/core

> Add real-time coaching-style steering to any AI agent loop.

[![npm version](https://img.shields.io/npm/v/@steer-agent/core)](https://www.npmjs.com/package/@steer-agent/core)
[![license](https://img.shields.io/npm/l/@steer-agent/core)](./LICENSE)

## Install

```bash
npm install @steer-agent/core
```

## Usage

### 1. Create a Session

```typescript
import { SteeringSession } from "@steer-agent/core";

const steering = new SteeringSession();
const hook = steering.getLoopHook();
```

### 2. Hook Into Your Agent Loop

```typescript
// Register the agent's plan
const plan = hook.onPlanCreated([
  { description: "Analyze codebase", intent: "analysis" },
  { description: "Write components", intent: "coding" },
  { description: "Write tests", intent: "testing" },
]);

// Agent loop
for (const step of plan.steps) {
  hook.onStepStart(step);

  // ★ This injects any pending steering advice into the prompt
  const { injectionText, hasAdvice } = hook.getInjection(step);

  const result = await callLLM(basePrompt + injectionText);

  hook.onStepComplete(step);
}
```

### 3. Send Advice (From UI or External Input)

```typescript
// Reactive: real-time advice, applied to the next step
steering.addReactiveAdvice("Use TypeScript strict mode");

// Preemptive: attach to a specific future step
steering.addPreemptiveAdvice(plan.steps[2].id, "Use Vitest instead of Jest");
```

### 4. Listen to Events

```typescript
steering.on("advice:applied", (msg) => {
  console.log(`Applied: ${msg.content}`);
});

steering.on("plan:updated", ({ oldPlan, newPlan }) => {
  console.log("Plan changed, advice remapped");
});
```

## API

### `SteeringSession`

| Method                                 | Description                             |
| -------------------------------------- | --------------------------------------- |
| `addReactiveAdvice(content)`           | Queue real-time advice                  |
| `addPreemptiveAdvice(stepId, content)` | Attach advice to a future step          |
| `removeAdvice(messageId)`              | Remove pending advice                   |
| `getLoopHook()`                        | Get the hook for agent loop integration |
| `getPlan()`                            | Get the current agent plan              |
| `getAllMessages(filter?)`              | Get all advice messages                 |
| `getStats()`                           | Get session statistics                  |
| `on(event, listener)`                  | Subscribe to events                     |

### `LoopHook`

| Method                    | Description                         |
| ------------------------- | ----------------------------------- |
| `onPlanCreated(steps)`    | Register the agent's plan           |
| `onPlanUpdated(newSteps)` | Update plan (triggers remapping)    |
| `onStepStart(step)`       | Mark step as active                 |
| `getInjection(step)`      | Get injection text for current step |
| `onStepComplete(step)`    | Mark step as complete               |

### Events

| Event                 | When                       |
| --------------------- | -------------------------- |
| `advice:sent`         | User sends advice          |
| `advice:queued`       | Advice enters queue        |
| `advice:acknowledged` | Agent picks up advice      |
| `advice:applied`      | Step completed with advice |
| `advice:expired`      | Advice TTL expired         |
| `plan:created`        | Agent creates a plan       |
| `plan:updated`        | Agent modifies plan        |
| `advice:remapped`     | Advice moved to new step   |
| `advice:orphaned`     | Advice lost (step removed) |

## Options

```typescript
const steering = new SteeringSession({
  adviceTTL: 300_000, // Max advice age in ms (default: 5 min)
  maxQueueSize: 20, // Max queue size (default: 20)
  locale: "en", // Injection text language
  customFormatter: (reactive, preemptive) => "...", // Custom format
});
```

## License

Apache-2.0
