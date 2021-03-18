import { User } from "@random-guys/pro-request-router";

import { NewRequestAction, NewRequestOptions, RequestOptLoader } from "../../src";
import { Beneficiary } from "../mocks/beneficiary";

class OptionsLoader implements RequestOptLoader<Beneficiary> {
  private owner: User;
  private approvers: User[];

  useOwner(owner: User) {
    this.owner = owner;
  }

  useApprovers(approvers: User[]) {
    this.approvers = approvers;
  }

  reset() {
    this.owner = null;
    this.approvers = null;
  }

  getNewRequestOptions(action: "create", owner: string, val: Beneficiary): Promise<NewRequestOptions>;
  getNewRequestOptions(
    action: "update",
    owner: string,
    oldVal: Beneficiary,
    newVal: Beneficiary
  ): Promise<NewRequestOptions>;
  getNewRequestOptions(action: "delete", owner: string, val: Beneficiary): Promise<NewRequestOptions>;
  async getNewRequestOptions(
    action: NewRequestAction,
    owner: string,
    oldVal: Beneficiary,
    newVal?: any
  ): Promise<NewRequestOptions> {
    const fullName = `${this.owner.metadata.first_name} ${this.owner.metadata.last_name}`;
    const message = `${fullName} is trying to ${action} the beneficiary ${oldVal.account_name}`;
    return {
      owner: this.owner,
      approvers: this.approvers,
      new_request_message: message,
      mail_template: "mail_template",
      mail_vars: []
    };
  }

  async getPatchRequestMessage(owner: string, oldVal: Beneficiary, newVal: Beneficiary): Promise<string> {
    const fullName = `${this.owner.metadata.first_name} ${this.owner.metadata.last_name}`;
    return `${fullName} made some changes to ${oldVal.account_name}`;
  }

  async getCloseRequestMessage(owner: string, val: Beneficiary): Promise<string> {
    const fullName = `${this.owner.metadata.first_name} ${this.owner.metadata.last_name}`;
    return `${fullName} closed this request`;
  }
}

export const Loader = new OptionsLoader();
