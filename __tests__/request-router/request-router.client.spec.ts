import { defaultMongoOpts } from "@random-guys/bucket";
import dotenv from "dotenv";
import mongoose, { Connection } from "mongoose";
import sinon from "sinon";

import { CustomClient, ObjectRepository } from "../../src";
import { multiply, timeout } from "../helpers";
import { Beneficiary, BeneficiarySchemaDef } from "../mocks/beneficiary";
import { newBeneficiaryDTO, newUser } from "./helpers";
import { Loader } from "./request-options";
import {
  mockCloseRequest,
  mockCreateRequest,
  mockPatchRequest,
  mockRequestReview,
  mockSendNotification,
  Router
} from "./request-router.mock";
import faker from "faker";

let conn: Connection;
let dataRepo: ObjectRepository<Beneficiary>;

beforeAll(async () => {
  dotenv.config();

  conn = await mongoose.createConnection(process.env.MONGODB_URL, defaultMongoOpts);
  dataRepo = new ObjectRepository(conn, "User", BeneficiarySchemaDef);

  const client = new CustomClient(Router, Loader);
  await client.addListeners(dataRepo)
}, 5000);

afterAll(async () => {
  await conn.close();
});

afterEach(async () => {
  sinon.resetHistory();
  sinon.resetBehavior();
  await dataRepo.truncate({});
});

it("creates a request and asks for review when a create event is emitted", async () => {
  const owner = newUser();
  const approvers = multiply(3, newUser);
  const beneficiary = newBeneficiaryDTO();

  Loader.useOwner(owner);
  Loader.useApprovers(approvers);

  const createRequest = mockCreateRequest<Beneficiary>("create", owner, {
    account_number: beneficiary.account_number
  });
  const requestReview = mockRequestReview(approvers);

  await dataRepo.create(owner.id, beneficiary);

  await timeout(400);
  expect(createRequest.called).toBeTruthy();
  expect(requestReview.called).toBeTruthy();
});

it("creates a request and asks for review when an update event is emitted", async () => {
  const owner = newUser();
  const approvers = multiply(3, newUser);
  const beneficiary = newBeneficiaryDTO();

  Loader.useOwner(owner);
  Loader.useApprovers(approvers);

  const newAc = faker.finance.account(10);
  const createRequest = mockCreateRequest<Beneficiary>("update", owner, { account_number: newAc });
  const requestReview = mockRequestReview(approvers);

  const { id } = await dataRepo.createApproved(beneficiary);
  await dataRepo.update(owner.id, id, { account_number: newAc });

  await timeout(400);
  expect(createRequest.called).toBeTruthy();
  expect(requestReview.called).toBeTruthy();
});

it("creates a request and asks for review when a delete event is emitted", async () => {
  const owner = newUser();
  const approvers = multiply(3, newUser);
  const beneficiary = newBeneficiaryDTO();

  Loader.useOwner(owner);
  Loader.useApprovers(approvers);

  const createRequest = mockCreateRequest<Beneficiary>("delete", owner, { account_number: beneficiary.account_number });
  const requestReview = mockRequestReview(approvers);

  const { id } = await dataRepo.createApproved(beneficiary);
  await dataRepo.delete(owner.id, id);

  await timeout(400);
  expect(createRequest.called).toBeTruthy();
  expect(requestReview.called).toBeTruthy();
});

it("patch the request and send notification when patch event is emitted", async () => {
  const owner = newUser();
  const approvers = multiply(3, newUser);
  const beneficiary = newBeneficiaryDTO();

  Loader.useOwner(owner);
  Loader.useApprovers(approvers);

  mockCreateRequest<any>("create", owner);
  mockRequestReview(approvers);
  const { id } = await dataRepo.create(owner.id, beneficiary);

  const newAc = faker.finance.account(10);
  const patchRequest = mockPatchRequest<Beneficiary>(id, { account_number: newAc });
  const sendNotification = mockSendNotification(id);

  await dataRepo.update(owner.id, id, { account_number: newAc });

  await timeout(400);
  expect(patchRequest.called).toBeTruthy();
  expect(sendNotification.called).toBeTruthy();
});

it("close the request and send notification when undo event is emitted", async () => {
  const owner = newUser();
  const approvers = multiply(3, newUser);
  const beneficiary = newBeneficiaryDTO();

  Loader.useOwner(owner);
  Loader.useApprovers(approvers);

  mockCreateRequest<any>("create", owner);
  mockRequestReview(approvers);
  const { id } = await dataRepo.create(owner.id, beneficiary);

  const closeRequest = mockCloseRequest(id);
  const sendNotification = mockSendNotification(id);

  await dataRepo.delete(owner.id, id);

  await timeout(500);
  expect(closeRequest.called).toBeTruthy();
  expect(sendNotification.called).toBeTruthy();
});
