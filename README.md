# 🧭 Steer-Agent

> Coach your AI agent in real-time — without stopping it.

**Steer-Agent** adds coaching-style steering to any AI agent loop.  
Instead of stopping the agent to give feedback, send advice while it works — like a co-pilot adjusting course mid-flight.

```
Traditional:  USER → "Do X" → AGENT works... → STOP → "Actually do Y" → restart
Steer-Agent:  USER → "Do X" → AGENT works... → USER: "try Y instead" → AGENT adjusts → continues
```

## The Problem

Current AI coding agents (Cline, Roo Code, Cursor, etc.) only support two interaction patterns:

- **Stop & Restart** — Interrupt the agent entirely and give new instructions
- **Approve & Continue** — Wait for the agent to ask permission at each step

Neither lets you **coach** the agent while it's working. Steer-Agent fixes that.

## Two Steering Modes

### 🔄 Reactive Steering

Send advice while the agent is working. It gets picked up at the next step.

```typescript
// While the agent is executing Step 2...
steering.addReactiveAdvice("Use TypeScript strict mode");
// → Injected into Step 3's prompt
```

### 📌 Preemptive Steering

See the agent's plan and attach advice to future steps before they run.

```typescript
// Agent's plan: [Analyze] → [Code] → [Test] → [Refactor]
// Attach advice to the "Test" step now:
steering.addPreemptiveAdvice(testStepId, "Use Vitest instead of Jest");
// → Automatically injected when the agent reaches "Test"
```

## Quick Start

```bash
npm install @steer-agent/core
```

```typescript
import { SteeringSession } from "@steer-agent/core";

const steering = new SteeringSession();
const hook = steering.getLoopHook();

// In your agent loop:
for (const step of plan.steps) {
  hook.onStepStart(step);

  // ★ One line to enable steering
  const { injectionText } = hook.getInjection(step);

  const result = await callLLM(prompt + injectionText);
  hook.onStepComplete(step);
}
```

## Key Features

- **Agent-Agnostic** — Works with any agent loop (Roo Code, Cline, LangChain, custom)
- **Zero Dependencies** — Only Node.js built-ins. No framework lock-in
- **Two Steering Modes** — Reactive (real-time) + Preemptive (plan-ahead)
- **Event System** — Track advice status: 📤sent → ⏳queued → ✅acknowledged → 🎯applied
- **Plan-Aware** — Survives plan changes via intent-based advice remapping
- **Token Efficient** — Zero overhead when no advice is pending

## How It Works

```
┌────────────────────────────────────────────────┐
│  Your Agent                                    │
│  ┌──────────────────────────────────────────┐  │
│  │  Agent Loop                              │  │
│  │  [Plan] → [Step 1] → [Step 2] → ...     │  │
│  │              ↑           ↑               │  │
│  │         ┌────┴───────────┴────────┐      │  │
│  │         │   @steer-agent/core     │      │  │
│  │         │  check queue → inject   │      │  │
│  │         └─────────────────────────┘      │  │
│  └──────────────────────────────────────────┘  │
│                      ↑                          │
│                User's advice                    │
└────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed data flows and module design.

## Try the Demo

```bash
git clone https://github.com/shdomi8599/Steer-Agent.git
cd Steer-Agent/examples/demo-cli
npm install
npm run demo
```

An interactive CLI that simulates an agent loop — type advice while it runs and watch steering in action.

## Packages

| Package                                | Description               |
| -------------------------------------- | ------------------------- |
| [`@steer-agent/core`](./packages/core) | Core steering library     |
| [`demo-cli`](./examples/demo-cli)      | Interactive terminal demo |

## License

AGPL-3.0
