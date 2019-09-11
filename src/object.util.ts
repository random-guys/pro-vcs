import lodashSet from 'lodash/set';

export function paths(data: any, result: string[], root = '') {
  if (isLeaf(data)) {
    return result.push(root);
  } else {
    return Object.keys(data).map(k => {
      const parentKey = root ? `${root}.${k}` : k;
      paths(data[k], result, parentKey);
    });
  }
}

function isLeaf(node: any) {
  return typeof node !== 'object' || node === null;
}

export function mongoSet(data: any, $set: object) {
  Object.keys($set).forEach(k => {
    lodashSet(data, k, $set[k]);
  });
  return data;
}
