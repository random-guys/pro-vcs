import { EventType } from '../../src/event.model';
export * from './user.model';
// export * from "./user.repo";

export function mockEmptyUserEvent() {
  return {
    metadata: { owner: 'arewaolakunle', eventType: EventType.created },
    payload: mockUser()
  };
}

export function mockUser() {
  return {
    fullname: 'Jasmine Joe',
    email_address: 'jasming@gmail.com'
  };
}
