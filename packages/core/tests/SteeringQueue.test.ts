import { describe, test, expect, beforeEach } from 'vitest';
import { SteeringQueue } from '../src/queue/SteeringQueue';

describe('SteeringQueue', () => {
  let queue: SteeringQueue;

  beforeEach(() => {
    queue = new SteeringQueue({ maxSize: 5, ttl: 60_000 });
  });

  test('조언을 큐에 추가하면 상태가 queued', () => {
    const msg = queue.enqueue('UTF-8 명시해줘');
    expect(msg.status).toBe('queued');
    expect(msg.type).toBe('reactive');
    expect(msg.content).toBe('UTF-8 명시해줘');
    expect(msg.id).toBeTruthy();
  });

  test('현재 스텝 ID가 메시지에 기록됨', () => {
    const msg = queue.enqueue('조언', 'step-1');
    expect(msg.agentStepAtCreation).toBe('step-1');
  });

  test('hasMessages가 큐 상태를 반영', () => {
    expect(queue.hasMessages).toBe(false);
    queue.enqueue('조언1');
    expect(queue.hasMessages).toBe(true);
  });

  test('pendingCount가 정확히 반영', () => {
    expect(queue.pendingCount).toBe(0);
    queue.enqueue('조언1');
    queue.enqueue('조언2');
    expect(queue.pendingCount).toBe(2);
  });

  test('drain() 호출 시 모든 메시지 반환 후 큐 비어짐', () => {
    queue.enqueue('조언1');
    queue.enqueue('조언2');
    queue.enqueue('조언3');

    const messages = queue.drain();
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('조언1');
    expect(messages[2].content).toBe('조언3');

    expect(queue.hasMessages).toBe(false);
    expect(queue.pendingCount).toBe(0);
  });

  test('빈 큐에 drain() 하면 빈 배열', () => {
    const messages = queue.drain();
    expect(messages).toHaveLength(0);
  });

  test('최대 큐 크기 초과 시 가장 오래된 메시지 제거', () => {
    for (let i = 0; i < 6; i++) {
      queue.enqueue(`조언${i}`);
    }
    // maxSize=5이므로 첫 번째가 expired 되고 5개만 남아야 함
    expect(queue.pendingCount).toBe(5);
    const messages = queue.drain();
    expect(messages[0].content).toBe('조언1'); // 조언0은 제거됨
  });

  test('상태 업데이트', () => {
    const msg = queue.enqueue('조언');
    queue.updateStatus(msg.id, 'acknowledged');
    
    const updated = queue.getMessage(msg.id);
    expect(updated?.status).toBe('acknowledged');
    expect(updated?.acknowledgedAt).toBeTruthy();
  });

  test('applied 상태 업데이트 시 appliedAt 기록', () => {
    const msg = queue.enqueue('조언');
    queue.updateStatus(msg.id, 'applied');
    
    const updated = queue.getMessage(msg.id);
    expect(updated?.status).toBe('applied');
    expect(updated?.appliedAt).toBeTruthy();
  });

  test('메시지 삭제', () => {
    const msg = queue.enqueue('조언');
    expect(queue.remove(msg.id)).toBe(true);
    expect(queue.hasMessages).toBe(false);
  });

  test('존재하지 않는 메시지 삭제 시 false', () => {
    expect(queue.remove('non-existent')).toBe(false);
  });

  test('getAllMessages 필터', () => {
    const msg1 = queue.enqueue('조언1');
    const msg2 = queue.enqueue('조언2');
    queue.updateStatus(msg1.id, 'applied');

    const applied = queue.getAllMessages({ status: 'applied' });
    expect(applied).toHaveLength(1);
    expect(applied[0].id).toBe(msg1.id);
  });
});
