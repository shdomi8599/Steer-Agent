# 🧭 Steer-Agent Demo CLI

An interactive terminal demo that simulates an AI agent loop with real-time steering support.  
No API keys or external services needed — everything runs locally.

## Quick Start

```bash
# From the repo root
cd examples/demo-cli
npm install
npm run demo
```

## How It Works

The demo runs a **simulated agent** that executes 4 steps with a short delay each.  
While the agent is "working", you can type steering advice in real-time.

```
🤖 Agent creates a plan:
  ⬚ Step 1: Analyze project structure     (6s)
  ⬚ Step 2: Create component files        (7s)
  ⬚ Step 3: Write unit tests              (6s)
  ⬚ Step 4: Refactor and optimize         (5s)

🧭 >  ← You type advice here while the agent works
```

## Commands

| Command        | Description                                         | Example                               |
| -------------- | --------------------------------------------------- | ------------------------------------- |
| `any text`     | Send **reactive** advice (applies to the next step) | `Use TypeScript strict mode`          |
| `/steer N msg` | Attach **preemptive** advice to step N              | `/steer 3 Use Vitest instead of Jest` |
| `/plan`        | Show the current plan with step statuses            | `/plan`                               |
| `/stats`       | Show session statistics                             | `/stats`                              |

## Test Scenarios

### 1. Reactive Steering

While Step 1 is running, type:

```
Use TypeScript strict mode
```

→ You'll see it queued, then injected into Step 2's prompt.

### 2. Preemptive Steering

While Step 1 or 2 is running, type:

```
/steer 3 Use Vitest instead of Jest
```

→ The advice is pinned to Step 3. When the agent reaches Step 3, it gets injected.

### 3. Multiple Advice

Send several messages during a single step:

```
Components should use PascalCase
Add proper TypeScript interfaces
Use barrel exports
```

→ All 3 are batched and injected together into the next step.

### 4. Check Plan & Stats

At any time:

```
/plan     → See which steps are pending/active/completed
/stats    → See how many advice messages were sent/applied/expired
```

## What to Look For

- **📬 Reactive advice queued** — Your message entered the queue
- **📌 Preemptive advice attached** — Your message is pinned to a future step
- **✅ Agent acknowledged** — The agent picked up your advice
- **🎯 Advice applied** — The agent completed the step with your advice
- **Injection preview** — The exact text that would be injected into an LLM prompt
