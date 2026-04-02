import { describe, test, expect, beforeEach } from 'vitest';
import { SteeringQueue } from '../src/queue/SteeringQueue';

describe('SteeringQueue', () => {
  let queue: SteeringQueue;

  beforeEach(() => {
    queue = new SteeringQueue({ maxSize: 5, ttl: 60_000 });
  });

  test('State is queued when advice is added to the queue', () => {
    const msg = queue.enqueue('Please specify UTF-8');
    expect(msg.status).toBe('queued');
    expect(msg.type).toBe('reactive');
    expect(msg.content).toBe('Please specify UTF-8');
    expect(msg.id).toBeTruthy();
  });

  test('Current step ID is recorded in the message', () => {
    const msg = queue.enqueue('Advice', 'step-1');
    expect(msg.agentStepAtCreation).toBe('step-1');
  });

  test('hasMessages reflects the queue state', () => {
    expect(queue.hasMessages).toBe(false);
    queue.enqueue('Advice 1');
    expect(queue.hasMessages).toBe(true);
  });

  test('pendingCount is accurately reflected', () => {
    expect(queue.pendingCount).toBe(0);
    queue.enqueue('Advice 1');
    queue.enqueue('Advice 2');
    expect(queue.pendingCount).toBe(2);
  });

  test('Queue is emptied after returning all messages upon calling drain()', () => {
    queue.enqueue('Advice 1');
    queue.enqueue('Advice 2');
    queue.enqueue('Advice 3');

    const messages = queue.drain();
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('Advice 1');
    expect(messages[2].content).toBe('Advice 3');

    expect(queue.hasMessages).toBe(false);
    expect(queue.pendingCount).toBe(0);
  });

  test('Empty array when drain() is called on an empty queue', () => {
    const messages = queue.drain();
    expect(messages).toHaveLength(0);
  });

  test('Removes the oldest message when max queue size is exceeded', () => {
    for (let i = 0; i < 6; i++) {
      queue.enqueue(`Advice ${i}`);
    }
    // Since maxSize=5, the first one expires and only 5 remain
    expect(queue.pendingCount).toBe(5);
    const messages = queue.drain();
    expect(messages[0].content).toBe('Advice 1'); // Advice 0 is removed
  });

  test('Status update', () => {
    const msg = queue.enqueue('Advice');
    queue.updateStatus(msg.id, 'acknowledged');
    
    const updated = queue.getMessage(msg.id);
    expect(updated?.status).toBe('acknowledged');
    expect(updated?.acknowledgedAt).toBeTruthy();
  });

  test('Records appliedAt when updating applied status', () => {
    const msg = queue.enqueue('Advice');
    queue.updateStatus(msg.id, 'applied');
    
    const updated = queue.getMessage(msg.id);
    expect(updated?.status).toBe('applied');
    expect(updated?.appliedAt).toBeTruthy();
  });

  test('Delete message', () => {
    const msg = queue.enqueue('Advice');
    expect(queue.remove(msg.id)).toBe(true);
    expect(queue.hasMessages).toBe(false);
  });

  test('false when deleting a non-existent message', () => {
    expect(queue.remove('non-existent')).toBe(false);
  });

  test('getAllMessages filter', () => {
    const msg1 = queue.enqueue('Advice 1');
    const msg2 = queue.enqueue('Advice 2');
    queue.updateStatus(msg1.id, 'applied');

    const applied = queue.getAllMessages({ status: 'applied' });
    expect(applied).toHaveLength(1);
    expect(applied[0].id).toBe(msg1.id);
  });
});
