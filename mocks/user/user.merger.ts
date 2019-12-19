import { RemoteObject } from "../../src/";
import { User } from "./user.model";

export class UserMerger implements RemoteObject<User> {
  onApprove(event: import("../../src").CreateEvent<User>): Promise<User> {
    throw new Error("Method not implemented.");
  }
  onReject(event: import("../../src").CreateEvent<User>): Promise<User> {
    throw new Error("Method not implemented.");
  }
  onCheck(reference: string): Promise<import("../../src").CheckResult[]> {
    throw new Error("Method not implemented.");
  }
}
