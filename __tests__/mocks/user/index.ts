import { ObjectState } from "../../../src";
export * from "./user.model";
export * from "./user.schema";
import faker from "faker";

export function mockEmptyUserEvent() {
  return {
    __owner: faker.random.uuid(),
    object_state: ObjectState.Created,
    password_hash: faker.random.alphaNumeric(32),
    ...mockUser()
  };
}

export function mockFreshUser(email = faker.internet.email(), name = faker.name.findName()) {
  return {
    __owner: faker.random.uuid(),
    object_state: ObjectState.Created,
    ...mockUser(email, name)
  };
}

export function mockApprovedUser(email = faker.internet.email(), name = faker.name.findName()) {
  return {
    object_state: ObjectState.Stable,
    ...mockUser(email, name)
  };
}

export function mockFrozenUser(owner: string) {
  return {
    object_state: ObjectState.Frozen,
    __owner: owner,
    ...mockUser()
  };
}

export function mockUnapprovedUpdate(owner: string, email: string, name: string) {
  return {
    __owner: owner,
    object_state: ObjectState.Updated,
    ...mockUser(email)
  };
}

export function mockUser(email = faker.internet.email(), name = faker.name.findName()) {
  return { full_name: name, email_address: email };
}
