import { defaultMongoOpts } from "@random-guys/bucket";
import { publisher } from "@random-guys/eventbus";
import { createLogger } from "bunyan";
import dotenv from "dotenv";
import mongoose, { Connection } from "mongoose";
import sinon from "sinon";

import { ObjectRepository } from "../../src";
import { ProhubClient } from "../../src";
import { mockUser, User, UserMerger, UserSchema } from "../mocks/user";
import faker from "faker";
import { mockCreate, mockUpdate, mockDelete, mockPatch, mockClose } from "./prohub.mock";

let conn: Connection;
let dataRepo: ObjectRepository<User>;
let client: ProhubClient<User>;

beforeAll(async () => {
  dotenv.config();

  conn = await mongoose.createConnection(process.env.MONGODB_URL, defaultMongoOpts);
  dataRepo = new ObjectRepository(conn, "User", UserSchema);

  await publisher.init(process.env.AMQP_URL);
  const logger = createLogger({ name: "test" });

  client = new ProhubClient(dataRepo);
  await client.init(new UserMerger(), logger, {
    remote_queue: process.env.QUEUE,
    amqp_connection: publisher.getConnection()
  });
  await client.setupListeners();
}, 5000);

afterAll(async () => {
  await conn.close();
  await publisher.close();
});

afterEach(async () => {
  sinon.resetHistory();
  sinon.resetBehavior();
  await dataRepo.truncate({});
});

describe("ObjectRepository Events", () => {
  it("sends a new object event on create", async () => {
    const owner = faker.random.uuid();
    const user = mockUser();

    const createEvent = mockCreate<User>(owner, { email_address: user.email_address });

    await dataRepo.create(owner, user);

    expect(createEvent.called).toBe(true);
  });

  it("sends an update object event on updates for stable objects", async () => {
    const owner = faker.random.uuid();
    const user = mockUser();
    const email = faker.internet.email();

    const { id } = await dataRepo.createApproved(user);

    const updateEvent = mockUpdate<User>(owner, { email_address: user.email_address }, { email_address: email });

    await dataRepo.update(owner, id, { email_address: email });

    expect(updateEvent.called).toBe(true);
  });

  it("sends a delete object event on deleting a stable object", async () => {
    const owner = faker.random.uuid();
    const { id } = await dataRepo.createApproved(mockUser());

    const deleteEvent = mockDelete(owner);

    await dataRepo.delete(owner, id);

    expect(deleteEvent.called).toBe(true);
  });

  it("sends a patch event update to frozen object", async () => {
    const owner = faker.random.uuid();
    const user = mockUser();
    const email = faker.internet.email();

    mockCreate<User>(owner, { email_address: user.email_address });
    const { id } = await dataRepo.create(owner, user);

    const patchEvent = mockPatch<User>(id, { email_address: email });

    await dataRepo.update(owner, id, { email_address: email });

    expect(patchEvent.called).toBe(true);
  });

  it("sends a close event on undo to a frozen object", async () => {
    const owner = faker.random.uuid();
    const user = mockUser();

    mockCreate<User>(owner, { email_address: user.email_address });
    const { id } = await dataRepo.create(owner, user);

    const closeEvent = mockClose(id);

    await dataRepo.delete(owner, id);

    expect(closeEvent.called).toBe(true);
  });
});
