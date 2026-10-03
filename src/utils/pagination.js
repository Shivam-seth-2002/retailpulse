function getPaginationMeta(data, idField, limit) {
  let nextCursor = null;
  if (data.length === limit && data.length > 0) {
    nextCursor = String(data[data.length - 1][idField]);
  }
  return { nextCursor };
}

module.exports = {
  getPaginationMeta
};
