import { EventType } from '../../src/event.model';
export * from './user.model';
// export * from "./user.repo";

export function mockEmptyUserEvent() {
  return {
    metadata: { owner: 'arewaolakunle', eventType: EventType.created },
    payload: mockUser()
  };
}

export function mockApprovedUser(owner: string) {
  return {
    metadata: { owner, eventType: EventType.approved, frozen: false },
    payload: mockUser()
  };
}

export function mockFrozenUser(owner: string) {
  const user = mockApprovedUser(owner);
  user.metadata.frozen = true;
  return user;
}

export function mockUnapprovedUpdate(
  owner: string,
  reference: string,
  email: string
) {
  return {
    metadata: { owner, eventType: EventType.updated, reference },
    payload: {
      email_address: email
    }
  };
}

export function mockUser() {
  return {
    fullname: 'Jasmine Joe',
    email_address: 'jasming@gmail.com'
  };
}
