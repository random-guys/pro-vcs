import { paths } from "../../src";

it("Should generate a paths for multi-layer object", () => {
  const myPaths = [];
  paths({ a: 12, b: { c: 13, d: { e: 14 } } }, myPaths);
  expect(myPaths.length).toBe(3);
  expect(myPaths).toContain("a");
  expect(myPaths).toContain("b.c");
  expect(myPaths).toContain("b.d.e");
});
