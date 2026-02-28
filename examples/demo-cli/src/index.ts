import * as readline from 'readline';
import { SteeringSession } from '@steer-agent/core';
import type { AgentPlan, SteeringMessage } from '@steer-agent/core';

// ─── Colors (ANSI escape codes) ───
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// ─── Status icons ───
const statusIcon: Record<string, string> = {
  sent: '📤',
  queued: '⏳',
  acknowledged: '✅',
  applied: '🎯',
  expired: '⏰',
};

const stepStatusIcon: Record<string, string> = {
  pending: '⬚',
  active: '🔄',
  completed: '✅',
  skipped: '⏭️',
  changed: '🔀',
};

// ─── Simulated agent plan ───
const SIMULATED_STEPS = [
  { description: 'Analyze project structure', intent: 'analysis', durationMs: 6000 },
  { description: 'Create component files', intent: 'coding', durationMs: 7000 },
  { description: 'Write unit tests', intent: 'testing', durationMs: 6000 },
  { description: 'Refactor and optimize', intent: 'refactoring', durationMs: 5000 },
];

function printHeader(): void {
  console.log('');
  console.log(`${c.bold}${c.cyan}🚀 Steer-Agent Demo CLI${c.reset}`);
  console.log(`${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.dim}Simulates an AI agent with real-time steering support.${c.reset}`);
  console.log(`${c.dim}Type advice while the agent works to see steering in action.${c.reset}`);
  console.log('');
  console.log(`${c.bold}Commands:${c.reset}`);
  console.log(`  ${c.cyan}any text${c.reset}          → Send reactive advice (next step)`);
  console.log(`  ${c.cyan}/steer N message${c.reset}  → Attach preemptive advice to step N`);
  console.log(`  ${c.cyan}/plan${c.reset}             → Show current plan`);
  console.log(`  ${c.cyan}/stats${c.reset}            → Show session statistics`);
  console.log(`${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log('');
}

function printPlan(plan: AgentPlan): void {
  console.log(`\n${c.bold}📋 Plan:${c.reset}`);
  for (const step of plan.steps) {
    const icon = stepStatusIcon[step.status] || '⬚';
    const adviceCount = step.attachedAdvice.length;
    const adviceBadge = adviceCount > 0
      ? ` ${c.yellow}[${adviceCount} advice attached]${c.reset}`
      : '';
    console.log(`  ${icon} Step ${step.order + 1}: ${step.description}${adviceBadge}`);
  }
  console.log('');
}

function printInjection(injectionText: string): void {
  if (!injectionText) return;
  console.log(`${c.dim}  ┌─── Injected into LLM prompt ───────────────────────────┐${c.reset}`);
  const lines = injectionText.split('\n');
  for (const line of lines) {
    console.log(`${c.dim}  │${c.reset} ${line}`);
  }
  console.log(`${c.dim}  └─────────────────────────────────────────────────────────┘${c.reset}`);
}

function printStats(session: SteeringSession): void {
  const stats = session.getStats();
  console.log(`\n${c.bold}📊 Session Statistics:${c.reset}`);
  console.log(`  Total advice sent:    ${stats.totalAdvice}`);
  console.log(`  ${statusIcon.applied} Applied:           ${stats.applied}`);
  console.log(`  ${statusIcon.queued} Pending:            ${stats.pending}`);
  console.log(`  ${statusIcon.acknowledged} Acknowledged:  ${stats.acknowledged}`);
  console.log(`  ${statusIcon.expired} Expired:           ${stats.expired}`);
  console.log('');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ───

async function main(): Promise<void> {
  printHeader();

  // Create session
  const session = new SteeringSession({ adviceTTL: 300_000, maxQueueSize: 20 });
  const hook = session.getLoopHook();

  // Subscribe to events
  session.on('advice:acknowledged', (msg: SteeringMessage) => {
    console.log(`  ${c.green}${statusIcon.acknowledged} Agent acknowledged: "${msg.content}"${c.reset}`);
  });

  session.on('advice:applied', (msg: SteeringMessage) => {
    console.log(`  ${c.green}${statusIcon.applied} Advice applied: "${msg.content}"${c.reset}`);
  });

  session.on('advice:orphaned', (msg: SteeringMessage) => {
    console.log(`  ${c.red}⚠️  Advice orphaned (plan changed): "${msg.content}"${c.reset}`);
  });

  // Create plan
  console.log(`${c.bold}🤖 Agent:${c.reset} I'll work on your task. Here's my plan:\n`);
  const plan = hook.onPlanCreated(
    SIMULATED_STEPS.map((s) => ({ description: s.description, intent: s.intent }))
  );
  printPlan(plan);

  // Setup readline for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.cyan}🧭 > ${c.reset}`,
  });

  // Handle user commands
  rl.on('line', (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    // /plan command
    if (trimmed === '/plan') {
      const currentPlan = session.getPlan();
      if (currentPlan) printPlan(currentPlan);
      rl.prompt();
      return;
    }

    // /stats command
    if (trimmed === '/stats') {
      printStats(session);
      rl.prompt();
      return;
    }

    // /steer N message command
    const steerMatch = trimmed.match(/^\/steer\s+(\d+)\s+(.+)$/);
    if (steerMatch) {
      const stepNum = parseInt(steerMatch[1], 10) - 1; // 1-indexed → 0-indexed
      const advice = steerMatch[2];
      const currentPlan = session.getPlan();

      if (!currentPlan || stepNum < 0 || stepNum >= currentPlan.steps.length) {
        console.log(`${c.red}  ❌ Invalid step number. Use 1-${currentPlan?.steps.length || '?'}${c.reset}`);
        rl.prompt();
        return;
      }

      const targetStep = currentPlan.steps[stepNum];
      if (targetStep.status === 'completed') {
        console.log(`${c.red}  ❌ Step ${stepNum + 1} is already completed.${c.reset}`);
        rl.prompt();
        return;
      }

      const msg = session.addPreemptiveAdvice(targetStep.id, advice);
      if (msg) {
        console.log(
          `${c.magenta}  📌 Preemptive advice attached to Step ${stepNum + 1} ("${targetStep.description}")${c.reset}`
        );
      }
      rl.prompt();
      return;
    }

    // Default: reactive advice
    const msg = session.addReactiveAdvice(trimmed);
    console.log(`${c.yellow}  📬 Reactive advice queued (${session.getStats().pending} pending)${c.reset}`);
    rl.prompt();
  });

  // Run the simulated agent loop
  rl.prompt();

  for (let i = 0; i < SIMULATED_STEPS.length; i++) {
    const simStep = SIMULATED_STEPS[i];
    const planStep = plan.steps[i];
    const stepInfo = { id: planStep.id, description: simStep.description };

    // Start step
    console.log(`\n${c.bold}${c.blue}🔄 Step ${i + 1}/${SIMULATED_STEPS.length}: ${simStep.description}...${c.reset} ${c.dim}(${simStep.durationMs / 1000}s)${c.reset}`);

    hook.onStepStart(stepInfo);

    // Simulate work (agent is "thinking")
    await sleep(simStep.durationMs);

    // Get injection (this is where steering happens!)
    const injection = hook.getInjection(stepInfo);

    if (injection.hasAdvice) {
      console.log(`\n  ${c.bold}⚡ ${injection.includedMessageIds.length} advice injected into this step:${c.reset}`);
      printInjection(injection.injectionText);
    }

    // Complete step
    hook.onStepComplete(stepInfo);
    console.log(`${c.green}${c.bold}  ✅ Step ${i + 1} complete${c.reset}`);

    rl.prompt();
  }

  // Done
  console.log(`\n${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.bold}${c.green}🎉 Agent completed all steps!${c.reset}`);
  printStats(session);

  rl.close();
  process.exit(0);
}

main().catch(console.error);
