import { ObjectState } from "../../src";
export * from "./user.model";
export * from "./user.schema";

export function mockEmptyUserEvent() {
  return {
    __owner: "arewaolakunle",
    object_state: ObjectState.Created,
    ...mockUser()
  };
}

export function mockApprovedUser(email = "jasming@gmail.com") {
  return {
    object_state: ObjectState.Stable,
    ...mockUser(email)
  };
}

export function mockFrozenUser(owner: string) {
  return {
    object_state: ObjectState.Frozen,
    __owner: owner,
    ...mockUser()
  };
}

export function mockUnapprovedUpdate(owner: string, email: string) {
  return {
    __owner: owner,
    object_state: ObjectState.Updated,
    ...mockUser(email)
  };
}

export function mockUser(email = "jasming@gmail.com") {
  return {
    fullname: "Jasmine Joe",
    email_address: email
  };
}
