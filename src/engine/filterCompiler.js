const { LogicalNode, ConditionNode } = require('../dataStructures/FilterTree');
const ApiError = require('../utils/ApiError');

function compileFilter(tree, fieldMap) {
  const params = [];
  const havingParams = [];
  let whereSql = '1=1';
  let havingSql = '1=1';

  if (!tree) {
    return { whereSql, havingSql, params, havingParams };
  }

  function compileNode(node, isHaving = false) {
    if (node instanceof LogicalNode) {
      if (node.op === 'NOT') {
        return `NOT (${compileNode(node.children[0], isHaving)})`;
      }
      
      const parts = node.children.map(c => compileNode(c, isHaving)).filter(Boolean);
      if (parts.length === 0) return '';
      return `(${parts.join(` ${node.op} `)})`;
    }

    if (node instanceof ConditionNode) {
      const mapped = fieldMap.get(node.field);
      if (!mapped) {
        throw ApiError.badRequest(`Unknown filter field: ${node.field}`);
      }

      const { column, isAggregate } = mapped;
      
      // If we are building the WHERE clause but this is an aggregate field, skip it.
      // If we are building the HAVING clause but this is NOT an aggregate field, skip it.
      if (isAggregate && !isHaving) return '';
      if (!isAggregate && isHaving) return '';

      const targetParams = isAggregate ? havingParams : params;

      switch (node.op) {
        case 'eq':
          targetParams.push(node.value);
          return `${column} = ?`;
        case 'ne':
          targetParams.push(node.value);
          return `${column} != ?`;
        case 'gt':
          targetParams.push(node.value);
          return `${column} > ?`;
        case 'gte':
          targetParams.push(node.value);
          return `${column} >= ?`;
        case 'lt':
          targetParams.push(node.value);
          return `${column} < ?`;
        case 'lte':
          targetParams.push(node.value);
          return `${column} <= ?`;
        case 'like':
          targetParams.push(node.value);
          return `${column} LIKE ?`;
        case 'in':
          targetParams.push(...node.value);
          return `${column} IN (${node.value.map(() => '?').join(',')})`;
        case 'between':
          targetParams.push(node.value[0], node.value[1]);
          return `${column} BETWEEN ? AND ?`;
        default:
          throw ApiError.badRequest(`Unsupported operator: ${node.op}`);
      }
    }
    
    return '';
  }

  const w = compileNode(tree, false);
  if (w) whereSql = w;
  
  const h = compileNode(tree, true);
  if (h) havingSql = h;

  return { whereSql, havingSql, params, havingParams };
}

module.exports = { compileFilter };
