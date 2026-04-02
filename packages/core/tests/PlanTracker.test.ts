import { describe, test, expect, beforeEach } from 'vitest';
import { PlanTracker } from '../src/plan/PlanTracker';

describe('PlanTracker', () => {
  let tracker: PlanTracker;

  beforeEach(() => {
    tracker = new PlanTracker();
  });

  test('Create plan', () => {
    const plan = tracker.setPlan([
      { description: 'File analysis', intent: 'analysis' },
      { description: 'Component creation', intent: 'coding' },
      { description: 'Write tests', intent: 'testing' },
    ]);

    expect(plan.steps).toHaveLength(3);
    expect(plan.version).toBe(1);
    expect(plan.steps[0].description).toBe('File analysis');
    expect(plan.steps[0].status).toBe('pending');
    expect(plan.steps[2].intent).toBe('testing');
  });

  test('Attach Preemptive advice to step', () => {
    const plan = tracker.setPlan([
      { description: 'File analysis', intent: 'analysis' },
      { description: 'Write tests', intent: 'testing' },
    ]);

    const stepId = plan.steps[1].id;
    const advice = tracker.annotate(stepId, 'Please use Vitest');

    expect(advice).not.toBeNull();
    expect(advice!.type).toBe('preemptive');
    expect(advice!.targetStepId).toBe(stepId);
    expect(advice!.targetStepIntent).toBe('testing');
  });

  test('Returns null when attaching advice to non-existent step', () => {
    tracker.setPlan([{ description: 'Analysis', intent: 'analysis' }]);
    const advice = tracker.annotate('non-existent', 'Advice');
    expect(advice).toBeNull();
  });

  test('Returns advice when reaching the step', () => {
    const plan = tracker.setPlan([
      { description: 'Analysis', intent: 'analysis' },
      { description: 'Testing', intent: 'testing' },
    ]);

    const stepId = plan.steps[1].id;
    tracker.annotate(stepId, 'Advice 1');
    tracker.annotate(stepId, 'Advice 2');

    const advice = tracker.getAdviceForStep(stepId);
    expect(advice).toHaveLength(2);
    expect(advice[0].content).toBe('Advice 1');
    expect(advice[1].content).toBe('Advice 2');
  });

  test('Step status transition', () => {
    const plan = tracker.setPlan([
      { description: 'Analysis', intent: 'analysis' },
    ]);

    const stepId = plan.steps[0].id;
    tracker.markStepActive(stepId);
    expect(tracker.getStep(stepId)?.status).toBe('active');

    tracker.markStepCompleted(stepId);
    expect(tracker.getStep(stepId)?.status).toBe('completed');
  });

  test('Intent-based remapping when plan changes', () => {
    const plan = tracker.setPlan([
      { description: 'Analysis', intent: 'analysis' },
      { description: 'Testing', intent: 'testing' },
    ]);

    // Attach advice to test step
    tracker.annotate(plan.steps[1].id, 'Please use Vitest');

    // Plan change (test step changed to a different description)
    const result = tracker.updatePlan([
      { description: 'Analysis (re-execution)', intent: 'analysis' },
      { description: 'Run unit tests', intent: 'testing' },
      { description: 'Refactoring', intent: 'refactoring' },
    ]);

    expect(result.remapped).toHaveLength(1);
    expect(result.remapped[0].advice.content).toBe('Please use Vitest');
    expect(result.orphaned).toHaveLength(0);

    // Check advice in the new test step
    const newTestStep = result.plan.steps.find((s) => s.intent === 'testing');
    expect(newTestStep?.attachedAdvice).toHaveLength(1);
    expect(newTestStep?.attachedAdvice[0].content).toBe('Please use Vitest');
  });

  test('Orphaned when no matching target during plan change', () => {
    const plan = tracker.setPlan([
      { description: 'Analysis', intent: 'analysis' },
      { description: 'Deployment', intent: 'deployment' },
    ]);

    tracker.annotate(plan.steps[1].id, 'Deployment related advice');

    // New plan where the deployment step is gone
    const result = tracker.updatePlan([
      { description: 'Analysis', intent: 'analysis' },
      { description: 'Coding', intent: 'coding' },
    ]);

    expect(result.orphaned).toHaveLength(1);
    expect(result.orphaned[0].content).toBe('Deployment related advice');
    expect(result.orphaned[0].status).toBe('expired');
  });

  test('Delete advice', () => {
    const plan = tracker.setPlan([
      { description: 'Testing', intent: 'testing' },
    ]);

    const advice = tracker.annotate(plan.steps[0].id, 'Advice to be deleted');
    expect(tracker.removeAdvice(advice!.id)).toBe(true);

    const remaining = tracker.getAdviceForStep(plan.steps[0].id);
    expect(remaining).toHaveLength(0);
  });
});
