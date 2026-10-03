/**
 * FilterTree and nodes implementation.
 */

class FilterTreeError extends Error {
  constructor(message, code = 'INVALID_FILTER') {
    super(message);
    this.name = 'FilterTreeError';
    this.statusCode = 400;
    this.code = code;
  }
}

class LogicalNode {
  constructor(op, children) {
    this.op = op;
    this.children = children;
  }
}

class ConditionNode {
  constructor(field, op, value) {
    this.field = field;
    this.op = op;
    this.value = value;
  }
}

const ALLOWED_OPS = new Set(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'between', 'like']);
const LOGICAL_OPS = new Set(['and', 'or', 'not']);

class FilterTree {
  static parse(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new FilterTreeError('Filter must be an object');
    }

    const tree = this._parseNode(json);

    const depth = this.depth(tree);
    if (depth > 5) {
      throw new FilterTreeError(`Filter tree depth ${depth} exceeds maximum of 5`);
    }

    const nodes = this.countNodes(tree);
    if (nodes > 30) {
      throw new FilterTreeError(`Filter tree nodes ${nodes} exceeds maximum of 30`);
    }

    return tree;
  }

  static _parseNode(obj) {
    const keys = Object.keys(obj);
    
    // Check if it's a logical node (and, or, not)
    for (const op of LOGICAL_OPS) {
      if (keys.includes(op)) {
        if (keys.length > 1) {
          throw new FilterTreeError('Logical nodes can only have one operator');
        }
        
        if (op === 'not') {
          if (!obj.not || typeof obj.not !== 'object' || Array.isArray(obj.not)) {
            throw new FilterTreeError('"not" operator takes a single object');
          }
          return new LogicalNode('NOT', [this._parseNode(obj.not)]);
        }
        
        const children = obj[op];
        if (!Array.isArray(children) || children.length === 0) {
          throw new FilterTreeError(`"${op}" operator must have a non-empty array of children`);
        }
        
        return new LogicalNode(op.toUpperCase(), children.map(child => {
          if (!child || typeof child !== 'object') {
             throw new FilterTreeError('Child of logical node must be an object');
          }
          return this._parseNode(child);
        }));
      }
    }

    // Otherwise, it must be a condition node
    const { field, op, value, ...rest } = obj;
    if (!field || typeof field !== 'string') {
      throw new FilterTreeError('Condition must have a string "field"');
    }
    if (!op || typeof op !== 'string') {
      throw new FilterTreeError('Condition must have a string "op"');
    }
    if (value === undefined) {
      throw new FilterTreeError('Condition must have a "value"');
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      throw new FilterTreeError('Condition value cannot be an object');
    }
    if (Array.isArray(value)) {
      if (value.some(v => v !== null && typeof v === 'object')) {
        throw new FilterTreeError('Array values cannot contain objects');
      }
    }
    if (Object.keys(rest).length > 0) {
      throw new FilterTreeError('Condition has extra properties');
    }

    if (!ALLOWED_OPS.has(op)) {
      throw new FilterTreeError(`Invalid operator: ${op}`);
    }

    if (op === 'in' && (!Array.isArray(value) || value.length === 0)) {
       throw new FilterTreeError('"in" operator requires a non-empty array value');
    }
    if (op === 'between' && (!Array.isArray(value) || value.length !== 2)) {
       throw new FilterTreeError('"between" operator requires an array value with exactly 2 items');
    }
    if (op === 'like' && typeof value !== 'string') {
       throw new FilterTreeError('"like" operator requires a string value');
    }

    return new ConditionNode(field, op, value);
  }

  static countNodes(node) {
    if (!node) return 0;
    if (node instanceof ConditionNode) return 1;
    if (node instanceof LogicalNode) {
      let count = 1;
      for (const child of node.children) {
        count += this.countNodes(child);
      }
      return count;
    }
    return 0;
  }

  static depth(node) {
    if (!node) return 0;
    if (node instanceof ConditionNode) return 1;
    if (node instanceof LogicalNode) {
      let maxChildDepth = 0;
      for (const child of node.children) {
        maxChildDepth = Math.max(maxChildDepth, this.depth(child));
      }
      return 1 + maxChildDepth;
    }
    return 0;
  }
}

module.exports = {
  FilterTree,
  LogicalNode,
  ConditionNode,
  FilterTreeError
};
