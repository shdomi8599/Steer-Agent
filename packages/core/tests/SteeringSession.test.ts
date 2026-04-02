import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SteeringSession } from '../src/session/SteeringSession';

describe('SteeringSession (Integration test)', () => {
  let session: SteeringSession;

  beforeEach(() => {
    session = new SteeringSession({ adviceTTL: 60_000, maxQueueSize: 10 });
  });

  test('Add reactive advice → Emit event', () => {
    const sentHandler = vi.fn();
    session.on('advice:sent', sentHandler);

    const msg = session.addReactiveAdvice('Please specify UTF-8');

    expect(msg.type).toBe('reactive');
    expect(msg.status).toBe('queued');
    expect(sentHandler).toHaveBeenCalledWith(msg);
  });

  test('Overall flow: Reactive advice → Agent step → Injection → Application', () => {
    const hook = session.getLoopHook();
    const appliedHandler = vi.fn();
    session.on('advice:applied', appliedHandler);

    // 1. Create plan
    const plan = hook.onPlanCreated([
      { description: 'File analysis', intent: 'analysis' },
      { description: 'Coding', intent: 'coding' },
    ]);

    // 2. Start Step 1
    const step1 = { id: plan.steps[0].id, description: 'File analysis' };
    hook.onStepStart(step1);

    // 3. User adds reactive advice
    session.addReactiveAdvice('Please look at the src folder first');

    // 4. Step 1 completed, Start Step 2
    hook.onStepComplete(step1);
    const step2 = { id: plan.steps[1].id, description: 'Coding' };
    hook.onStepStart(step2);

    // 5. Get injection
    const injection = hook.getInjection(step2);

    expect(injection.hasAdvice).toBe(true);
    expect(injection.injectionText).toContain('Please look at the src folder first');
    expect(injection.includedMessageIds).toHaveLength(1);

    // 6. Step 2 completed
    hook.onStepComplete(step2);
    expect(appliedHandler).toHaveBeenCalled();
  });

  test('Preemptive advice → Injected when reaching the step', () => {
    const hook = session.getLoopHook();

    // 1. Create plan
    const plan = hook.onPlanCreated([
      { description: 'Analysis', intent: 'analysis' },
      { description: 'Write tests', intent: 'testing' },
    ]);

    // 2. User pre-attaches advice to test step
    const advice = session.addPreemptiveAdvice(plan.steps[1].id, 'Please use Vitest');
    expect(advice).not.toBeNull();

    // 3. Execute Step 1 (No advice)
    const step1 = { id: plan.steps[0].id, description: 'Analysis' };
    hook.onStepStart(step1);
    const injection1 = hook.getInjection(step1);
    expect(injection1.hasAdvice).toBe(false);
    hook.onStepComplete(step1);

    // 4. Execute Step 2 (Preemptive advice exists!)
    const step2 = { id: plan.steps[1].id, description: 'Write tests' };
    hook.onStepStart(step2);
    const injection2 = hook.getInjection(step2);

    expect(injection2.hasAdvice).toBe(true);
    expect(injection2.injectionText).toContain('Please use Vitest');
    expect(injection2.injectionText).toContain('Pre-attached Advice');
  });

  test('Simultaneous Reactive + Preemptive injection', () => {
    const hook = session.getLoopHook();

    // Create plan
    const plan = hook.onPlanCreated([
      { description: 'Coding', intent: 'coding' },
    ]);

    // Preemptive advice
    session.addPreemptiveAdvice(plan.steps[0].id, 'Use functional instead of classes');

    // Start Step
    const step = { id: plan.steps[0].id, description: 'Coding' };
    hook.onStepStart(step);

    // Reactive advice (added during step execution)
    session.addReactiveAdvice('Please use TypeScript');

    // Injection
    const injection = hook.getInjection(step);

    expect(injection.hasAdvice).toBe(true);
    expect(injection.injectionText).toContain('Use functional instead of classes');
    expect(injection.injectionText).toContain('Please use TypeScript');
    expect(injection.includedMessageIds).toHaveLength(2);
  });

  test('Empty injection if no advice', () => {
    const hook = session.getLoopHook();

    const plan = hook.onPlanCreated([
      { description: 'Analysis', intent: 'analysis' },
    ]);

    const step = { id: plan.steps[0].id, description: 'Analysis' };
    hook.onStepStart(step);
    const injection = hook.getInjection(step);

    expect(injection.hasAdvice).toBe(false);
    expect(injection.injectionText).toBe('');
    expect(injection.includedMessageIds).toHaveLength(0);
  });

  test('Session stats', () => {
    const hook = session.getLoopHook();

    const plan = hook.onPlanCreated([
      { description: 'Coding', intent: 'coding' },
    ]);

    session.addReactiveAdvice('Advice 1');
    session.addReactiveAdvice('Advice 2');
    session.addPreemptiveAdvice(plan.steps[0].id, 'Advice 3');

    const stats = session.getStats();
    expect(stats.totalAdvice).toBe(3);
    expect(stats.pending).toBe(3);
    expect(stats.applied).toBe(0);
  });

  test('plan:created event', () => {
    const hook = session.getLoopHook();
    const handler = vi.fn();
    session.on('plan:created', handler);

    hook.onPlanCreated([
      { description: 'Analysis', intent: 'analysis' },
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].steps).toHaveLength(1);
  });

  test('Delete advice', () => {
    const msg = session.addReactiveAdvice('Advice to be deleted');
    expect(session.removeAdvice(msg.id)).toBe(true);
    
    const remaining = session.getReactiveMessages({ status: 'queued' });
    expect(remaining.filter((m) => m.id === msg.id)).toHaveLength(0);
  });
});
