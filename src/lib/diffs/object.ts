import { diff, Diff } from "deep-diff";

export function difference(lhs: any, rhs: any) {
  const acc = diff(lhs, rhs, {}, objectAccumulator())
  return acc['result']
}

export function objectAccumulator() {
  return { result: {}, length: 0, push }
}

export function push(diff: Diff<any>) {
  // this.result
  if (diff.path) {
    setByPath(this.result, diff.path, diff)
    return
  }
}

export function setByPath(data: any, path: string[], value: any) {
  if (path.length === 1) {
    data[path[0]] = value
  } else {
    data[path[0]] = setByPath({}, path.slice(1), value)
  }
}