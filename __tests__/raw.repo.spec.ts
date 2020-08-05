import { defaultMongoOpts } from "@random-guys/bucket";
import { publisher } from "@random-guys/eventbus";
import { createLogger } from "bunyan";
import dotenv from "dotenv";
import mongoose, { Connection } from "mongoose";
import sinon from "sinon";
import { ObjectRepository, ObjectState } from "../src";
import { RPCClientMock, MockResult } from "./client";
import { mockUser, User, UserSchema } from "./mocks/user";
import { UserMerger } from "./mocks/user/user.merger";

let conn: Connection;
let dataRepo: ObjectRepository<User>;
let client: RPCClientMock<User>;

beforeAll(async () => {
  dotenv.config();

  const logger = createLogger({ name: "test" });

  conn = await mongoose.createConnection(process.env.MONGODB_URL, defaultMongoOpts);
  await publisher.init(process.env.AMQP_URL);

  dataRepo = new ObjectRepository(conn, "User", UserSchema);
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

describe("Creating in mongodb directly", () => {
  it("should create a PayloadModel object", async () => {
    client.mockAny();

    const user = await dataRepo.createRaw("arewaolakunle", mockUser());

    expect(user.id).toBeDefined();
    expect(user.created_at).toBeDefined();
    expect(user.updated_at).toBeDefined();
    expect(user.object_state).toBe(ObjectState.Created);

    // ensure no other user can see created
    const readerUser = await dataRepo.get("someone", user.id);
    expect(readerUser.object_state).toBe(ObjectState.Frozen);
  });

  it("should trigger a merge on approval", async () => {
    const mergedUser: MockResult<User> = {};
    client.mockApproval(mergedUser);

    const user = await dataRepo.createRaw("arewaolakunle", mockUser());
    expect(mergedUser.payload.id).toBe(mergedUser.payload._id);
    expect(mergedUser.payload.object_state).toBe(ObjectState.Stable);
  });
});
