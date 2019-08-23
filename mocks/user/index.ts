export * from "./user.model";
// export * from "./user.repo";

export function mockEmptyUserEvent() {
  return {
    metadata: { owner: 'arewaolakunle' },
    payload: mockUser()
  }
}

export function mockUser() {
  return {
    fullname: 'Jasmine Joe',
    email_address: 'jasming@gmail.com'
  }
}