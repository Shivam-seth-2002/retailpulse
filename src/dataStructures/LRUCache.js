/**
 * LRU Cache implementation using a Hash Map and a Doubly Linked List.
 * get() and set() are O(1).
 */

class Node {
  constructor(key, value, expiresAt) {
    this.key = key;
    this.value = value;
    this.expiresAt = expiresAt;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor({ maxSize = 500, defaultTtlMs = 0 } = {}) {
    if (maxSize <= 0) throw new Error('maxSize must be > 0');
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    this.map = new Map();
    this.head = null;
    this.tail = null;

    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
  }

  get size() {
    return this.map.size;
  }

  _removeNode(node) {
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
  }

  _addToHead(node) {
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  _moveToHead(node) {
    if (this.head === node) return;
    this._removeNode(node);
    this._addToHead(node);
  }

  _evictTail() {
    if (!this.tail) return;
    const key = this.tail.key;
    this._removeNode(this.tail);
    this.map.delete(key);
    this._evictions++;
  }

  get(key) {
    const node = this.map.get(key);
    if (!node) {
      this._misses++;
      return undefined;
    }

    if (node.expiresAt && Date.now() > node.expiresAt) {
      this._removeNode(node);
      this.map.delete(key);
      this._misses++;
      return undefined;
    }

    this._moveToHead(node);
    this._hits++;
    return node.value;
  }

  set(key, value, ttlMs) {
    let node = this.map.get(key);
    const ttl = ttlMs !== undefined ? ttlMs : this.defaultTtlMs;
    const expiresAt = ttl > 0 ? Date.now() + ttl : null;

    if (node) {
      node.value = value;
      node.expiresAt = expiresAt;
      this._moveToHead(node);
    } else {
      if (this.map.size >= this.maxSize) {
        this._evictTail();
      }
      node = new Node(key, value, expiresAt);
      this.map.set(key, node);
      this._addToHead(node);
    }
  }

  delete(key) {
    const node = this.map.get(key);
    if (!node) return false;
    this._removeNode(node);
    this.map.delete(key);
    return true;
  }

  clear() {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  keys() {
    const keys = [];
    let curr = this.head;
    while (curr) {
      keys.push(curr.key);
      curr = curr.next;
    }
    return keys;
  }

  stats() {
    const total = this._hits + this._misses;
    return {
      hits: this._hits,
      misses: this._misses,
      size: this.size,
      maxSize: this.maxSize,
      evictions: this._evictions,
      hitRate: total === 0 ? 0 : Number((this._hits / total).toFixed(4)),
    };
  }
}

module.exports = { LRUCache };
