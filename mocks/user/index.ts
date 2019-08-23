export * from "./user.model";
// export * from "./user.repo";

export function mockEmptyUser() {
  return {
    metadata: { owner: 'arewaolakunle' },
    payload: {
      fullname: 'Jasmine Joe',
      email_address: 'jasming@gmail.com'
    }
  }
}