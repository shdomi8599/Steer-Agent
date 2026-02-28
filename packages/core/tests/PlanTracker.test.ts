import { describe, test, expect, beforeEach } from 'vitest';
import { PlanTracker } from '../src/plan/PlanTracker';

describe('PlanTracker', () => {
  let tracker: PlanTracker;

  beforeEach(() => {
    tracker = new PlanTracker();
  });

  test('계획 생성', () => {
    const plan = tracker.setPlan([
      { description: '파일 분석', intent: 'analysis' },
      { description: '컴포넌트 생성', intent: 'coding' },
      { description: '테스트 작성', intent: 'testing' },
    ]);

    expect(plan.steps).toHaveLength(3);
    expect(plan.version).toBe(1);
    expect(plan.steps[0].description).toBe('파일 분석');
    expect(plan.steps[0].status).toBe('pending');
    expect(plan.steps[2].intent).toBe('testing');
  });

  test('스텝에 Preemptive 조언 부착', () => {
    const plan = tracker.setPlan([
      { description: '파일 분석', intent: 'analysis' },
      { description: '테스트 작성', intent: 'testing' },
    ]);

    const stepId = plan.steps[1].id;
    const advice = tracker.annotate(stepId, 'Vitest로 해줘');

    expect(advice).not.toBeNull();
    expect(advice!.type).toBe('preemptive');
    expect(advice!.targetStepId).toBe(stepId);
    expect(advice!.targetStepIntent).toBe('testing');
  });

  test('존재하지 않는 스텝에 조언 부착 시 null', () => {
    tracker.setPlan([{ description: '분석', intent: 'analysis' }]);
    const advice = tracker.annotate('non-existent', '조언');
    expect(advice).toBeNull();
  });

  test('해당 스텝 도달 시 조언 반환', () => {
    const plan = tracker.setPlan([
      { description: '분석', intent: 'analysis' },
      { description: '테스트', intent: 'testing' },
    ]);

    const stepId = plan.steps[1].id;
    tracker.annotate(stepId, '조언1');
    tracker.annotate(stepId, '조언2');

    const advice = tracker.getAdviceForStep(stepId);
    expect(advice).toHaveLength(2);
    expect(advice[0].content).toBe('조언1');
    expect(advice[1].content).toBe('조언2');
  });

  test('스텝 상태 전환', () => {
    const plan = tracker.setPlan([
      { description: '분석', intent: 'analysis' },
    ]);

    const stepId = plan.steps[0].id;
    tracker.markStepActive(stepId);
    expect(tracker.getStep(stepId)?.status).toBe('active');

    tracker.markStepCompleted(stepId);
    expect(tracker.getStep(stepId)?.status).toBe('completed');
  });

  test('계획 변경 시 intent 기반 재매핑', () => {
    const plan = tracker.setPlan([
      { description: '분석', intent: 'analysis' },
      { description: '테스트', intent: 'testing' },
    ]);

    // 테스트 스텝에 조언 부착
    tracker.annotate(plan.steps[1].id, 'Vitest로 해줘');

    // 계획 변경 (테스트 스텝이 다른 설명으로 바뀜)
    const result = tracker.updatePlan([
      { description: '분석 (재수행)', intent: 'analysis' },
      { description: '유닛 테스트 실행', intent: 'testing' },
      { description: '리팩토링', intent: 'refactoring' },
    ]);

    expect(result.remapped).toHaveLength(1);
    expect(result.remapped[0].advice.content).toBe('Vitest로 해줘');
    expect(result.orphaned).toHaveLength(0);

    // 새 테스트 스텝에서 조언 확인
    const newTestStep = result.plan.steps.find((s) => s.intent === 'testing');
    expect(newTestStep?.attachedAdvice).toHaveLength(1);
    expect(newTestStep?.attachedAdvice[0].content).toBe('Vitest로 해줘');
  });

  test('계획 변경 시 매핑 대상 없으면 orphaned', () => {
    const plan = tracker.setPlan([
      { description: '분석', intent: 'analysis' },
      { description: '배포', intent: 'deployment' },
    ]);

    tracker.annotate(plan.steps[1].id, '배포 관련 조언');

    // 배포 스텝이 사라진 새 계획
    const result = tracker.updatePlan([
      { description: '분석', intent: 'analysis' },
      { description: '코딩', intent: 'coding' },
    ]);

    expect(result.orphaned).toHaveLength(1);
    expect(result.orphaned[0].content).toBe('배포 관련 조언');
    expect(result.orphaned[0].status).toBe('expired');
  });

  test('조언 삭제', () => {
    const plan = tracker.setPlan([
      { description: '테스트', intent: 'testing' },
    ]);

    const advice = tracker.annotate(plan.steps[0].id, '삭제될 조언');
    expect(tracker.removeAdvice(advice!.id)).toBe(true);

    const remaining = tracker.getAdviceForStep(plan.steps[0].id);
    expect(remaining).toHaveLength(0);
  });
});
