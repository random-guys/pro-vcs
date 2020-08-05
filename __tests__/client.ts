import kebabCase from "lodash/kebabCase";
import sinon from "sinon";
import { publisher } from "@random-guys/eventbus";
import { RPCClient, FinalRequest } from "../src";

const ReviewClient = new RPCClient();
const queue = sinon.stub(publisher, "queue");

export class RPCClientMock {
  private client: RPCClient;
  constructor(private queue: string) {
    this.client = new RPCClient();
  }

  init(connection: any) {
    return this.client.init(connection);
  }

  mockReview<T>(method: string) {
    return queue.withArgs(this.queue, sinon.match.any).callsFake(async (_queue: any, event: any) => {
      if (!/create/.test(event.event_type)) {
        return true;
      }

      const [, action] = event.event_type.split(".");
      await ReviewClient.call<FinalRequest, T>(kebabCase(event.namespace), method, {
        event_type: action,
        owner: event.owner,
        reference: event.reference
      });
      return true;
    });
  }

  mockApproval<T>() {
    return this.mockReview<T>("onApprove");
  }

  mockRejection<T>() {
    return this.mockReview<T>("onReject");
  }

  mockAny() {
    return queue.withArgs(this.queue, sinon.match.any).resolves(true);
  }
}
