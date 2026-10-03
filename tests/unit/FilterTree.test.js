const {
  FilterTree,
  LogicalNode,
  ConditionNode,
  FilterTreeError,
} = require('../../src/dataStructures/FilterTree');

describe('FilterTree.parse', () => {
  test('parses the nested example from the spec', () => {
    const tree = FilterTree.parse({
      and: [
        { field: 'city', op: 'eq', value: 'Delhi' },
        {
          or: [
            { field: 'category', op: 'in', value: ['Grocery', 'Dairy'] },
            { field: 'total_sales', op: 'gt', value: 500 },
          ],
        },
      ],
    });

    expect(tree).toBeInstanceOf(LogicalNode);
    expect(tree.op).toBe('AND');
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0]).toBeInstanceOf(ConditionNode);
    expect(tree.children[0]).toMatchObject({ field: 'city', op: 'eq', value: 'Delhi' });
    expect(tree.children[1].op).toBe('OR');
    expect(tree.children[1].children[1]).toMatchObject({ field: 'total_sales', op: 'gt', value: 500 });
  });

  test('parses a single condition as the root', () => {
    const tree = FilterTree.parse({ field: 'region', op: 'ne', value: 'North' });
    expect(tree).toBeInstanceOf(ConditionNode);
  });

  test('parses NOT with one child', () => {
    const tree = FilterTree.parse({ not: { field: 'city', op: 'eq', value: 'Pune' } });
    expect(tree.op).toBe('NOT');
    expect(tree.children).toHaveLength(1);
  });

  test('accepts between, like and comparison operators', () => {
    expect(() =>
      FilterTree.parse({
        and: [
          { field: 'unit_price', op: 'between', value: [10, 20] },
          { field: 'product_name', op: 'like', value: '%milk%' },
          { field: 'quantity', op: 'gte', value: 1 },
          { field: 'quantity', op: 'lte', value: 9 },
          { field: 'quantity', op: 'lt', value: 9 },
        ],
      }),
    ).not.toThrow();
  });

  test('rejects operators that are not whitelisted', () => {
    expect(() => FilterTree.parse({ field: 'city', op: 'regex', value: '.*' })).toThrow(FilterTreeError);
    expect(() => FilterTree.parse({ field: 'city', op: 'eq; DROP TABLE', value: 1 })).toThrow(/operator/);
  });

  test('rejects trees deeper than 5 levels', () => {
    const leaf = { field: 'city', op: 'eq', value: 'Delhi' };
    let ok = leaf;
    for (let i = 0; i < 4; i += 1) ok = { and: [ok] }; // depth 5
    expect(() => FilterTree.parse(ok)).not.toThrow();

    const tooDeep = { and: [ok] }; // depth 6
    expect(() => FilterTree.parse(tooDeep)).toThrow(/depth/);
  });

  test('rejects trees with more than 30 nodes', () => {
    const conditions = Array.from({ length: 30 }, (_, i) => ({ field: 'store_id', op: 'eq', value: i }));
    // 1 AND node + 30 conditions = 31 nodes
    expect(() => FilterTree.parse({ and: conditions })).toThrow(/nodes/);
    expect(() => FilterTree.parse({ and: conditions.slice(0, 29) })).not.toThrow();
  });

  test('rejects malformed nodes', () => {
    const bad = [
      null,
      'city = Delhi',
      [],
      { and: [] }, // empty group
      { and: 'not-an-array' },
      { and: [], or: [] }, // two operators in one node
      { not: [{ field: 'a', op: 'eq', value: 1 }] }, // NOT takes an object
      { field: '', op: 'eq', value: 1 },
      { field: 'city', op: 'eq' }, // missing value
      { field: 'city', op: 'eq', value: { nested: true } },
      { field: 'city', op: 'in', value: [] },
      { field: 'city', op: 'in', value: 'Delhi' },
      { field: 'city', op: 'in', value: [{ a: 1 }] },
      { field: 'price', op: 'between', value: [1] },
      { field: 'name', op: 'like', value: 5 },
      { field: 'city', op: 'eq', value: 1, extra: true },
      { something: 'else' },
    ];
    for (const input of bad) {
      expect(() => FilterTree.parse(input)).toThrow(FilterTreeError);
    }
  });

  test('FilterTreeError carries a 400 status for the API layer', () => {
    try {
      FilterTree.parse({ field: 'x', op: 'nope', value: 1 });
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('INVALID_FILTER');
    }
    expect.assertions(2);
  });

  test('countNodes and depth helpers', () => {
    const tree = FilterTree.parse({
      and: [{ field: 'a', op: 'eq', value: 1 }, { or: [{ field: 'b', op: 'eq', value: 2 }] }],
    });
    expect(FilterTree.countNodes(tree)).toBe(4);
    expect(FilterTree.depth(tree)).toBe(3);
  });
});
