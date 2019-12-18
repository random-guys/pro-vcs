import snakeCase from "lodash/snakeCase";
import toUpper from "lodash/toUpper";

export function snakeCaseUpper(str: string) {
  return toUpper(snakeCase(str));
}
