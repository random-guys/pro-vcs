import { publisher } from "@random-guys/eventbus";
import sinon from "sinon";
import { CreateEvent, ObjectRepository, PayloadModel } from "../src";

const queue = sinon.stub(publisher, "queue");

export interface MockResult<T extends PayloadModel> {
  payload?: T;
}

export class RPCClientMock<T extends PayloadModel> {
  constructor(private queue: string, private repo: ObjectRepository<T>) {}

  mockReview(method: string, result: MockResult<T>) {
    return queue.withArgs(this.queue, sinon.match.any).callsFake(async (_queue: any, event: CreateEvent<T>) => {
      if (!/create/.test(event.event_type)) {
        return true;
      }

      switch (method) {
        case "onApprove":
          result.payload = await this.repo.merge(event.reference);
          break;
        case "onReject":
          result.payload = await this.repo.reject(event.reference);
          break;
        default:
      }

      return true;
    });
  }

  mockApproval(result: MockResult<T>) {
    return this.mockReview("onApprove", result);
  }

  mockRejection(result: MockResult<T>) {
    return this.mockReview("onReject", result);
  }

  mockAny() {
    return queue.withArgs(this.queue, sinon.match.any).resolves(true);
  }
}
