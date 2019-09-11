import { ObjectState } from '../../src/event.model';
export * from './user.model';
export * from './user.schema';

export function mockEmptyUserEvent() {
  return {
    metadata: { owner: 'arewaolakunle', objectState: ObjectState.created },
    payload: mockUser()
  };
}

export function mockApprovedUser(email = 'jasming@gmail.com') {
  return {
    metadata: { objectState: ObjectState.stable },
    payload: mockUser(email)
  };
}

export function mockFrozenUser(owner: string) {
  return {
    metadata: { objectState: ObjectState.frozen, owner },
    payload: mockUser()
  };
}

export function mockUnapprovedUpdate(
  owner: string,
  reference: string,
  email: string
) {
  return {
    metadata: { owner, objectState: ObjectState.updated, reference },
    payload: mockUser(email)
  };
}

export function mockUser(email = 'jasming@gmail.com') {
  return {
    fullname: 'Jasmine Joe',
    email_address: email
  };
}
