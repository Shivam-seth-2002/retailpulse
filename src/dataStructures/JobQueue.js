/**
 * JobQueue implementation:
 * LinkedListQueue for O(1) FIFO operations.
 * JobQueue with priority buckets.
 */

class Node {
  constructor(data) {
    this.data = data;
    this.next = null;
    this.prev = null;
  }
}

class LinkedListQueue {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  enqueue(data) {
    const node = new Node(data);
    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }
    this.length++;
    return node;
  }

  dequeue() {
    if (!this.head) return undefined;
    const node = this.head;
    this.removeNode(node);
    return node.data;
  }

  peek() {
    return this.head ? this.head.data : undefined;
  }

  isEmpty() {
    return this.length === 0;
  }

  removeNode(node) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = null;
    node.next = null;
    this.length--;
  }
}

class JobQueue {
  constructor() {
    // Map<priority, LinkedListQueue>
    this.buckets = new Map([
      [2, new LinkedListQueue()], // High
      [1, new LinkedListQueue()], // Mid
      [0, new LinkedListQueue()]  // Low
    ]);
    // Map<jobId, { node, priority }> for O(1) removals
    this.jobs = new Map();
  }

  enqueue(job, priority = 0) {
    if (!job || !job.id) throw new Error('Job must have an id');
    if (this.jobs.has(job.id)) throw new Error(`Job ${job.id} already in queue`);
    if (!this.buckets.has(priority)) throw new Error(`Invalid priority ${priority}`);

    const queue = this.buckets.get(priority);
    const node = queue.enqueue(job);
    this.jobs.set(job.id, { node, priority });
  }

  dequeue() {
    // Check highest priority first
    for (const priority of [2, 1, 0]) {
      const queue = this.buckets.get(priority);
      if (!queue.isEmpty()) {
        const job = queue.dequeue();
        this.jobs.delete(job.id);
        return job;
      }
    }
    return undefined;
  }

  peek() {
    for (const priority of [2, 1, 0]) {
      const queue = this.buckets.get(priority);
      if (!queue.isEmpty()) {
        return queue.peek();
      }
    }
    return undefined;
  }

  size() {
    return this.jobs.size;
  }

  isEmpty() {
    return this.size() === 0;
  }

  remove(jobId) {
    const entry = this.jobs.get(jobId);
    if (!entry) return false;

    const { node, priority } = entry;
    const queue = this.buckets.get(priority);
    queue.removeNode(node);
    this.jobs.delete(jobId);
    return true;
  }

  has(jobId) {
    return this.jobs.has(jobId);
  }
}

module.exports = { LinkedListQueue, JobQueue };
