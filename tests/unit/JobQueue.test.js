const { JobQueue, LinkedListQueue } = require('../../src/dataStructures/JobQueue');

const job = (id, extra = {}) => ({ id, ...extra });

describe('LinkedListQueue', () => {
  test('is FIFO', () => {
    const q = new LinkedListQueue();
    q.enqueue('a');
    q.enqueue('b');
    q.enqueue('c');
    expect(q.peek()).toBe('a');
    expect(q.dequeue()).toBe('a');
    expect(q.dequeue()).toBe('b');
    expect(q.dequeue()).toBe('c');
    expect(q.dequeue()).toBeUndefined();
    expect(q.length).toBe(0);
  });

  test('removeNode unlinks head, middle and tail nodes', () => {
    const q = new LinkedListQueue();
    const a = q.enqueue('a');
    const b = q.enqueue('b');
    const c = q.enqueue('c');
    const d = q.enqueue('d');

    q.removeNode(b); // middle
    q.removeNode(a); // head
    q.removeNode(d); // tail
    expect(q.length).toBe(1);
    expect(q.dequeue()).toBe('c');
    expect(q.isEmpty()).toBe(true);

    // queue still works after removing everything
    q.enqueue('e');
    expect(q.peek()).toBe('e');
    void c;
  });
});

describe('JobQueue', () => {
  test('starts empty', () => {
    const q = new JobQueue();
    expect(q.isEmpty()).toBe(true);
    expect(q.size()).toBe(0);
    expect(q.dequeue()).toBeUndefined();
    expect(q.peek()).toBeUndefined();
  });

  test('is FIFO within the same priority', () => {
    const q = new JobQueue();
    q.enqueue(job('1'));
    q.enqueue(job('2'));
    q.enqueue(job('3'));
    expect([q.dequeue().id, q.dequeue().id, q.dequeue().id]).toEqual(['1', '2', '3']);
  });

  test('dequeues higher priority first, FIFO inside each priority', () => {
    const q = new JobQueue();
    q.enqueue(job('low-1'), 0);
    q.enqueue(job('high-1'), 2);
    q.enqueue(job('mid-1'), 1);
    q.enqueue(job('high-2'), 2);
    q.enqueue(job('low-2'), 0);

    expect(q.peek().id).toBe('high-1');
    const order = [];
    while (!q.isEmpty()) order.push(q.dequeue().id);
    expect(order).toEqual(['high-1', 'high-2', 'mid-1', 'low-1', 'low-2']);
  });

  test('size() counts jobs across all priorities', () => {
    const q = new JobQueue();
    q.enqueue(job('a'), 0);
    q.enqueue(job('b'), 1);
    q.enqueue(job('c'), 2);
    expect(q.size()).toBe(3);
    q.dequeue();
    expect(q.size()).toBe(2);
  });

  test('remove(jobId) removes a waiting job', () => {
    const q = new JobQueue();
    q.enqueue(job('a'), 0);
    q.enqueue(job('b'), 1);
    q.enqueue(job('c'), 0);

    expect(q.has('a')).toBe(true);
    expect(q.remove('a')).toBe(true);
    expect(q.has('a')).toBe(false);
    expect(q.remove('a')).toBe(false); // already gone
    expect(q.remove('unknown')).toBe(false);
    expect(q.size()).toBe(2);
    expect(q.dequeue().id).toBe('b');
    expect(q.dequeue().id).toBe('c');
  });

  test('rejects duplicate job ids, missing ids and unknown priorities', () => {
    const q = new JobQueue();
    q.enqueue(job('a'));
    expect(() => q.enqueue(job('a'))).toThrow(/already/);
    expect(() => q.enqueue({})).toThrow(/id/);
    expect(() => q.enqueue(job('b'), 7)).toThrow(/priority/);
  });

  test('a dequeued job id can be enqueued again (used for retries)', () => {
    const q = new JobQueue();
    q.enqueue(job('a'));
    q.dequeue();
    expect(() => q.enqueue(job('a'))).not.toThrow();
    expect(q.size()).toBe(1);
  });

  test('handles 100k jobs quickly (no O(n) Array.shift)', () => {
    const q = new JobQueue();
    const start = Date.now();
    for (let i = 0; i < 100_000; i += 1) q.enqueue(job(String(i)), i % 3);
    while (!q.isEmpty()) q.dequeue();
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
