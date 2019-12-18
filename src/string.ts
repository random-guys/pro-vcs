import kebabCase from "lodash/kebabCase";
import toUpper from "lodash/toUpper";

export function kebebCaseUpper(str: string) {
  return toUpper(kebabCase(str));
}
