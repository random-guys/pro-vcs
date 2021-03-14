import { publisher } from "@random-guys/eventbus";
import sinon from "sinon";

import { PayloadModel } from "../src";

const queue = sinon.stub(publisher, "queue");

export function mockCreate<T extends PayloadModel>(owner: string, match: Partial<T>) {
  return queue.withArgs(
    sinon.match.any,
    sinon.match({
      event_type: "create.new",
      owner,
      payload: sinon.match(match)
    })
  );
}

export function mockUpdate<T extends PayloadModel>(owner: string, oldMatch: Partial<T>, newMatch: Partial<T>) {
  return queue.withArgs(
    sinon.match.any,
    sinon.match({
      event_type: "create.update",
      owner,
      payload: sinon.match(newMatch),
      previous_version: sinon.match(oldMatch)
    })
  );
}

export function mockDelete(owner: string) {
  return queue.withArgs(sinon.match.any, sinon.match({ event_type: "create.delete", owner }));
}

export function mockPatch<T extends PayloadModel>(reference: string, match: Partial<T>) {
  return queue.withArgs(
    sinon.match.any,
    sinon.match({
      event_type: "patch",
      reference,
      payload: sinon.match(match)
    })
  );
}
export function mockClose(reference: string) {
  return queue.withArgs(sinon.match.any, sinon.match({ event_type: "close", reference }));
}
