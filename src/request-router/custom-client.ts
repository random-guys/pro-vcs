import { ObjectRepository, PayloadModel } from "../objects";
import { RequestRouter, PostCreateOptions } from "@random-guys/pro-request-router";

export interface CustomPayloadModel extends PayloadModel {
  workspace: string;
}

export type NewRequestAction = "create" | "update" | "delete";

export interface RequestOptions<T extends CustomPayloadModel> {
  getNewRequestOptions(action: "create", owner: string, val: T): Promise<PostCreateOptions>;
  getNewRequestOptions(action: "update", owner: string, oldVal: T, newVal: T): Promise<PostCreateOptions>;
  getNewRequestOptions(action: "delete", owner: string, val: T): Promise<PostCreateOptions>;
  getPatchRequestMessage(owner: string, oldVal: T, newVal: T): Promise<string>;
  getCloseRequestMessage(owner: string, val: T): Promise<string>;
}

export class CustomClient<T extends CustomPayloadModel> {
  constructor(private repository: ObjectRepository<T>, private router: RequestRouter, options: RequestOptions<T>) {
    // setup listeners for repo events
    this.repository.addListener("create", async (owner: string, val: T) => {
      const opts = await options.getNewRequestOptions("create", owner, val);
      await this.createRequest(val, opts, "create");
    });

    this.repository.addListener("update", async (owner: string, oldVal: T, newVal: T) => {
      const opts = await options.getNewRequestOptions("update", owner, oldVal, newVal);
      await this.createRequest(newVal, opts, "create");
    });

    this.repository.addListener("delete", async (owner: string, val: T) => {
      const opts = await options.getNewRequestOptions("delete", owner, val);
      await this.createRequest(val, opts, "delete");
    });

    this.repository.addListener("patch", async (owner: string, oldVal: T, newVal) => {
      const message = await options.getPatchRequestMessage(owner, oldVal, newVal);
      await this.patchRequest(newVal, message);
    });

    this.repository.addListener("undo", async (owner: string, val: T) => {
      const message = await options.getCloseRequestMessage(owner, val);
      await this.closeRequest(val.id, message);
    });
  }

  protected async createRequest(t: T, options: PostCreateOptions, action: NewRequestAction) {
    await this.router.createRequest<T>({
      reference: t.id,
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
        content: options.newRequestMessage,
        mail: {
          template: options.mailTemplate,
          template_type: "mjml",
          template_vars: options.mailVars
        }
      }
    });

    return res;
  }

  protected async patchRequest(payload: T, message: string) {
    this.router.patchRequest({ reference: payload.id, payload });

    return this.router.sendNotification<T>({
      reference: payload.id,
      receiver: "reviewers",
      message: {
        subject: `Review ${this.repository.name} Update`,
        content: message
      }
    });
  }

  protected async closeRequest(reference: string, message: string) {
    this.router.closeRequest({ reference });
    return this.router.sendNotification<T>({
      reference,
      receiver: "reviewers",
      message: {
        subject: `Review ${this.repository.name} Update`,
        content: message
      }
    });
  }
}
