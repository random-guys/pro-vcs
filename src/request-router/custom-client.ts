import { ObjectRepository, PayloadModel } from "../objects";
import { RequestRouter, User } from "@random-guys/pro-request-router";

export interface CustomPayloadModel extends PayloadModel {
  workspace: string;
}

export type NewRequestAction = "create" | "update" | "delete";

export interface NewRequestOptions {
  owner?: User;
  approvers: User[];
  new_request_message: string;
  mail_template: string;
  mail_vars: object[];
}

export interface RequestOptLoader<T extends CustomPayloadModel> {
  getNewRequestOptions(action: "create", owner: string, val: T): Promise<NewRequestOptions>;
  getNewRequestOptions(action: "update", owner: string, oldVal: T, newVal: T): Promise<NewRequestOptions>;
  getNewRequestOptions(action: "delete", owner: string, val: T): Promise<NewRequestOptions>;
  getPatchRequestMessage(owner: string, oldVal: T, newVal: T): Promise<string>;
  getCloseRequestMessage(owner: string, val: T): Promise<string>;
}

export class CustomClient<T extends CustomPayloadModel> {
  constructor(
    private repository: ObjectRepository<T>,
    private router: RequestRouter,
    private loader: RequestOptLoader<T>
  ) {
    // setup listeners for repo events
    this.repository.addListener("create", this.onCreate.bind(this));
    this.repository.addListener("update", this.onUpdate.bind(this));
    this.repository.addListener("delete", this.onDelete.bind(this));
    this.repository.addListener("patch", this.onPatch.bind(this));
    this.repository.addListener("undo", this.onUndo.bind(this));
  }

  async onCreate(owner: string, val: T) {
    const opts = await this.loader.getNewRequestOptions("create", owner, val);
    return this.createRequest(val, opts, "create");
  }

  async onUpdate(owner: string, oldVal: T, newVal: T) {
    const opts = await this.loader.getNewRequestOptions("update", owner, oldVal, newVal);
    await this.createRequest(newVal, opts, "update");
  }

  async onDelete(owner: string, val: T) {
    const opts = await this.loader.getNewRequestOptions("delete", owner, val);
    await this.createRequest(val, opts, "delete");
  }

  async onPatch(owner: string, oldVal: T, newVal: T) {
    const message = await this.loader.getPatchRequestMessage(owner, oldVal, newVal);

    this.router.patchRequest({ reference: newVal.id, payload: newVal });
    return this.router.sendNotification<T>({
      reference: newVal.id,
      receiver: "reviewers",
      message: {
        subject: `Review ${this.repository.name} Update`,
        content: message
      }
    });
  }

  async onUndo(owner: string, val: T) {
    const message = await this.loader.getCloseRequestMessage(owner, val);

    this.router.closeRequest({ reference: val.id });
    return this.router.sendNotification<T>({
      reference: val.id,
      receiver: "reviewers",
      message: {
        subject: "Closed Request",
        content: message
      }
    });
  }

  protected async createRequest(t: T, options: NewRequestOptions, action: NewRequestAction) {
    await this.router.createRequest<T>({
      reference: t.id,
      owner: options.owner,
      namespace: this.repository.name.toLowerCase(),
      request_type: action,
      payload: t,
      workspace: t.workspace
    });

    const res = await this.router.requestReview<T>({
      approvers: options.approvers,
      reference: t.id,
      expected: 1,
      message: {
        subject: `Review ${this.repository.name}`,
        content: options.new_request_message,
        mail: {
          template: options.mail_template,
          template_type: "mjml",
          template_vars: options.mail_vars
        }
      }
    });

    return res;
  }
}
