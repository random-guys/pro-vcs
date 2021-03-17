import { RequestRouter, User } from "@random-guys/pro-request-router";
import faker from "faker";
import sinon from "sinon";
import { CustomPayloadModel, NewRequestAction } from "../../src";

export const Router = new RequestRouter({
  secret: faker.random.alphaNumeric(32),
  service_name: faker.random.word(),
  server_url: faker.internet.url(),
  logger: { success() {}, error() {} },
  queue_name: faker.random.word()
});

const createRequest = sinon.stub(Router, "createRequest");
const requestReview = sinon.stub(Router, "requestReview");
const patchRequest = sinon.stub(Router, "patchRequest");
const sendNotification = sinon.stub(Router, "sendNotification");
const closeRequest = sinon.stub(Router, "closeRequest");

export function mockCreateRequest<T extends CustomPayloadModel>(
  action: NewRequestAction,
  owner: User,
  match?: Partial<T>
) {
  return createRequest
    .withArgs(
      sinon.match({
        owner,
        request_type: action,
        payload: sinon.match(match)
      })
    )
    .resolves();
}

export function mockRequestReview(approvers: User[]) {
  return requestReview.withArgs(sinon.match({ approvers })).resolves();
}

export function mockPatchRequest<T extends CustomPayloadModel>(ref: string, match: Partial<T>) {
  return patchRequest.withArgs(sinon.match({ reference: ref, payload: sinon.match(match) })).resolves();
}

export function mockCloseRequest(ref: string) {
  return closeRequest.withArgs(sinon.match({ reference: ref })).resolves();
}

export function mockSendNotification(ref: string) {
  return sendNotification.withArgs(sinon.match({ reference: ref })).resolves();
}
