import { CheckResult, FinalRequest, MergeHandler } from "../../../src";
import { User } from "./user.model";

export class UserMerger implements MergeHandler<User> {
  onApprove(event: FinalRequest): Promise<User> {
    throw new Error("Method not implemented.");
  }
  onReject(event: FinalRequest): Promise<User> {
    throw new Error("Method not implemented.");
  }
  onCheck(reference: string): Promise<CheckResult[]> {
    throw new Error("Method not implemented.");
  }
}
