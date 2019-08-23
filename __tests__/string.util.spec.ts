import { slugify } from "../src"

it('should replace " " with _', () => {
  const result = slugify('A B C')
  expect(result.split('_').length).toBe(3)
})

it('should create a lower case slugged version', () => {
  const result = slugify('A B C')
  expect(result).toMatch('a_b_c')
})