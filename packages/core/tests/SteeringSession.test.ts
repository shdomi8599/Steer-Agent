import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SteeringSession } from '../src/session/SteeringSession';

describe('SteeringSession (통합 테스트)', () => {
  let session: SteeringSession;

  beforeEach(() => {
    session = new SteeringSession({ adviceTTL: 60_000, maxQueueSize: 10 });
  });

  test('Reactive 조언 추가 → 이벤트 발행', () => {
    const sentHandler = vi.fn();
    session.on('advice:sent', sentHandler);

    const msg = session.addReactiveAdvice('UTF-8 명시해줘');

    expect(msg.type).toBe('reactive');
    expect(msg.status).toBe('queued');
    expect(sentHandler).toHaveBeenCalledWith(msg);
  });

  test('전체 흐름: Reactive 조언 → 에이전트 스텝 → 주입 → 적용', () => {
    const hook = session.getLoopHook();
    const appliedHandler = vi.fn();
    session.on('advice:applied', appliedHandler);

    // 1. 계획 생성
    const plan = hook.onPlanCreated([
      { description: '파일 분석', intent: 'analysis' },
      { description: '코딩', intent: 'coding' },
    ]);

    // 2. Step 1 시작
    const step1 = { id: plan.steps[0].id, description: '파일 분석' };
    hook.onStepStart(step1);

    // 3. 사용자가 Reactive 조언 추가
    session.addReactiveAdvice('src 폴더부터 봐줘');

    // 4. Step 1 완료, Step 2 시작
    hook.onStepComplete(step1);
    const step2 = { id: plan.steps[1].id, description: '코딩' };
    hook.onStepStart(step2);

    // 5. 주입 가져오기
    const injection = hook.getInjection(step2);

    expect(injection.hasAdvice).toBe(true);
    expect(injection.injectionText).toContain('src 폴더부터 봐줘');
    expect(injection.includedMessageIds).toHaveLength(1);

    // 6. Step 2 완료
    hook.onStepComplete(step2);
    expect(appliedHandler).toHaveBeenCalled();
  });

  test('Preemptive 조언 → 해당 스텝 도달 시 주입', () => {
    const hook = session.getLoopHook();

    // 1. 계획 생성
    const plan = hook.onPlanCreated([
      { description: '분석', intent: 'analysis' },
      { description: '테스트 작성', intent: 'testing' },
    ]);

    // 2. 사용자가 테스트 스텝에 미리 조언 부착
    const advice = session.addPreemptiveAdvice(plan.steps[1].id, 'Vitest로 해줘');
    expect(advice).not.toBeNull();

    // 3. Step 1 실행 (조언 없음)
    const step1 = { id: plan.steps[0].id, description: '분석' };
    hook.onStepStart(step1);
    const injection1 = hook.getInjection(step1);
    expect(injection1.hasAdvice).toBe(false);
    hook.onStepComplete(step1);

    // 4. Step 2 실행 (Preemptive 조언 있음!)
    const step2 = { id: plan.steps[1].id, description: '테스트 작성' };
    hook.onStepStart(step2);
    const injection2 = hook.getInjection(step2);

    expect(injection2.hasAdvice).toBe(true);
    expect(injection2.injectionText).toContain('Vitest로 해줘');
    expect(injection2.injectionText).toContain('Pre-attached Advice');
  });

  test('Reactive + Preemptive 동시 주입', () => {
    const hook = session.getLoopHook();

    // 계획 생성
    const plan = hook.onPlanCreated([
      { description: '코딩', intent: 'coding' },
    ]);

    // Preemptive 조언
    session.addPreemptiveAdvice(plan.steps[0].id, '클래스 대신 함수형으로');

    // Step 시작
    const step = { id: plan.steps[0].id, description: '코딩' };
    hook.onStepStart(step);

    // Reactive 조언 (Step 진행 중에 추가)
    session.addReactiveAdvice('TypeScript로 해줘');

    // 주입
    const injection = hook.getInjection(step);

    expect(injection.hasAdvice).toBe(true);
    expect(injection.injectionText).toContain('클래스 대신 함수형으로');
    expect(injection.injectionText).toContain('TypeScript로 해줘');
    expect(injection.includedMessageIds).toHaveLength(2);
  });

  test('조언 없으면 빈 injection', () => {
    const hook = session.getLoopHook();

    const plan = hook.onPlanCreated([
      { description: '분석', intent: 'analysis' },
    ]);

    const step = { id: plan.steps[0].id, description: '분석' };
    hook.onStepStart(step);
    const injection = hook.getInjection(step);

    expect(injection.hasAdvice).toBe(false);
    expect(injection.injectionText).toBe('');
    expect(injection.includedMessageIds).toHaveLength(0);
  });

  test('세션 통계', () => {
    const hook = session.getLoopHook();

    const plan = hook.onPlanCreated([
      { description: '코딩', intent: 'coding' },
    ]);

    session.addReactiveAdvice('조언1');
    session.addReactiveAdvice('조언2');
    session.addPreemptiveAdvice(plan.steps[0].id, '조언3');

    const stats = session.getStats();
    expect(stats.totalAdvice).toBe(3);
    expect(stats.pending).toBe(3);
    expect(stats.applied).toBe(0);
  });

  test('plan:created 이벤트', () => {
    const hook = session.getLoopHook();
    const handler = vi.fn();
    session.on('plan:created', handler);

    hook.onPlanCreated([
      { description: '분석', intent: 'analysis' },
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].steps).toHaveLength(1);
  });

  test('조언 삭제', () => {
    const msg = session.addReactiveAdvice('삭제될 조언');
    expect(session.removeAdvice(msg.id)).toBe(true);
    
    const remaining = session.getReactiveMessages({ status: 'queued' });
    expect(remaining.filter((m) => m.id === msg.id)).toHaveLength(0);
  });
});
