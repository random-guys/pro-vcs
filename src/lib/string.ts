import lowerCase from "lodash/lowerCase"

export function slugify(str: string) {
  return lowerCase(str).split(' ').join('_')
}
