module.exports = {
  testEnvironment: "node",
  verbose: false,
  roots: ["<rootDir>"],
  transform: {
    "^.+\\.tsx?$": "ts-jest"
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  testPathIgnorePatterns: ["__tests__/mocks/", "__tests__/utils/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"]
};
