import { defaultMongoOpts } from "@random-guys/bucket";
import { publisher } from '@random-guys/eventbus';
import { createLogger } from 'bunyan';
import dotenv from 'dotenv';
import faker from "faker";
import mongoose, { Connection } from "mongoose";
import sinon from "sinon";
import { ObjectState } from "../src";
import { ProHubRepository } from '../src/objects/prohub-repo';
import { RPCClientMock } from "./client";
import { mockUser, User, UserSchema } from "./mocks/user";
import { UserMerger } from "./mocks/user/user.merger";

describe("Pro VCS Repo constrints", () => {
  let conn: Connection;
  let dataRepo: ProHubRepository<User>;
  let client: RPCClientMock<User>;

  beforeAll(async () => {
    dotenv.config();

    const logger = createLogger({ name: "test" });

    conn = await mongoose.createConnection(process.env.MONGODB_URL, defaultMongoOpts);
    await publisher.init(process.env.AMQP_URL);

    dataRepo = new ProHubRepository(conn, "User", UserSchema);
    await dataRepo.initClient(process.env.QUEUE, publisher.getConnection(), new UserMerger(), logger);

    client = new RPCClientMock(process.env.QUEUE, dataRepo);
  }, 5000);

  afterAll(async () => {
    await conn.close();
  });

  afterEach(async () => {
    sinon.resetHistory();
    sinon.resetBehavior();
    await conn.dropDatabase();
  });

  it("Should add create metadata to a new event", async () => {
    client.mockAny();

    const user = await dataRepo.create("arewaolakunle", mockUser());
    //@ts-ignore
    const readerUser = await dataRepo.get("someone", user.id);

    // owner should see created
    //@ts-ignore
    expect(user.object_state).toBe(ObjectState.Created);
    // ensure no other user can see created
    expect(readerUser.object_state).toBe(ObjectState.Frozen);
  });

  it("Should update a pending create", async () => {
    client.mockAny();

    const email = faker.internet.email();
    const user = await dataRepo.create("arewaolakunle", mockUser());
    //@ts-ignore
    const writeUser = await dataRepo.update("arewaolakunle", user.id, { email_address: email });
    //@ts-ignore
    const readerUser = await dataRepo.get("someone", user.id);

    // they must see the same thing
    expect(writeUser.email_address).toBe(email);
    expect(writeUser.email_address).toBe(readerUser.email_address);
  });
});