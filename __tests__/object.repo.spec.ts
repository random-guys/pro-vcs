import { defaultMongoOpts } from "@random-guys/bucket";
import { publisher } from "@random-guys/eventbus";
import { createLogger } from "bunyan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { mockUser, User, UserSchema } from "./mocks/user";
import { UserMerger } from "./mocks/user/user.merger";
import { ObjectRepository, ObjectState } from "../src";
import { Connection } from "mongoose";
import faker from "faker";

describe("ProVCS Repo Constraints", () => {
  let conn: Connection;
  let dataRepo: ObjectRepository<User>;

  beforeAll(async () => {
    dotenv.config();
    conn = await mongoose.createConnection(process.env.MONGODB_URL, defaultMongoOpts);
    const logger = createLogger({ name: "user" });
    await publisher.init(process.env.AMQP_URL);
    dataRepo = new ObjectRepository(conn, "User", UserSchema);
    await dataRepo.initClient("PROHUB_QUEUE", publisher.getConnection(), new UserMerger(), logger);
  });

  afterAll(async () => {
    await conn.close();
  });

  afterEach(async () => {
    // clean up
    await conn.dropDatabase();
  });

  it("Should add create metadata to a new event", async () => {
    const user = await dataRepo.create("arewaolakunle", mockUser());
    const readerUser = await dataRepo.get("someone", user.id);

    // owner should see created
    expect(user.object_state).toBe(ObjectState.Created);
    // ensure no other user can see created
    expect(readerUser.object_state).toBe(ObjectState.Frozen);
  });

  it("Should update a pending create", async () => {
    const email = faker.internet.email();
    const user = await dataRepo.create("arewaolakunle", mockUser());
    const writeUser = await dataRepo.update("arewaolakunle", user.id, { email_address: email });
    const readerUser = await dataRepo.get("someone", user.id);

    // they must see the same thing
    expect(writeUser.email_address).toBe(email);
    expect(writeUser.email_address).toBe(readerUser.email_address);
  });

  it("Should delete a pending create", async () => {
    const user = await dataRepo.create("arewaolakunle", mockUser());
    await dataRepo.delete("arewaolakunle", user.id);

    expect(dataRepo.get("someone", user.id)).rejects.toThrowError(/User not found/);
  });

  it("Should create a new update", async () => {
    const dto = mockUser();
    const email = faker.internet.email();

    const user = await dataRepo.createApproved(dto);
    await dataRepo.update("arewaolakunle", user.id, { email_address: email });

    const readerUser = await dataRepo.get("someone", user.id);
    const writeUser = await dataRepo.get("arewaolakunle", user.id);

    // different strokes for the different folks
    expect(writeUser.email_address).toBe(email);
    expect(readerUser.email_address).toBe(dto.email_address);

    // what can the user do
    expect(writeUser.object_state).toBe(ObjectState.Updated);
    expect(readerUser.object_state).toBe(ObjectState.Frozen);
  });

  it("Should patch an update", async () => {
    const firstMail = faker.internet.email();
    const secondMail = faker.internet.email();
    const dto = mockUser();

    const user = await dataRepo.createApproved(dto);
    await dataRepo.update("arewaolakunle", user.id, { email_address: firstMail });

    const writeUser = await dataRepo.update("arewaolakunle", user.id, { email_address: secondMail });
    const readerUser = await dataRepo.get("someone", user.id);

    // different strokes for the different folks
    expect(writeUser.email_address).toBe(secondMail);
    expect(readerUser.email_address).toBe(dto.email_address);
  });

  it("Should undo an update", async () => {
    const dto = mockUser();

    const user = await dataRepo.createApproved(dto);
    await dataRepo.update("arewaolakunle", user.id, { email_address: faker.internet.email() });

    const writeUser = await dataRepo.delete("arewaolakunle", user.id);
    const readerUser = await dataRepo.get("someone", user.id);

    // on the same earth
    expect(writeUser.email_address).toBe(dto.email_address);
    expect(readerUser.email_address).toBe(dto.email_address);
  });

  it("Should create a delete event", async () => {
    const user = await dataRepo.createApproved(mockUser());
    const writeUser = await dataRepo.delete("arewaolakunle", user.id);
    const readerUser = await dataRepo.get("someone", user.id);

    // still the same data
    expect(writeUser.email_address).toBe(readerUser.email_address);

    // what can the user do
    expect(writeUser.object_state).toBe(ObjectState.Deleted);
    expect(readerUser.object_state).toBe(ObjectState.Frozen);
  });

  it("Should undo a pending delete", async () => {
    const user = await dataRepo.createApproved(mockUser());
    // delete and undo
    await dataRepo.delete("arewaolakunle", user.id);
    const writeUser = await dataRepo.delete("arewaolakunle", user.id);
    const readerUser = await dataRepo.get("someone", user.id);

    // stabilised
    expect(readerUser.object_state).toBe(ObjectState.Stable);
    expect(writeUser.object_state).toBe(readerUser.object_state);
  });

  it("Should return the an approved user", async () => {
    const user = await dataRepo.createApproved(mockUser());
    const loadedUser = await dataRepo.byQuery("arewaolakunle", {
      full_name: user.full_name
    });

    expect(loadedUser.id).toBe(user.id);
  });

  it("Should return the all approved users", async () => {
    const email = faker.internet.email();

    await dataRepo.createApproved(mockUser(email));
    await dataRepo.createApproved(mockUser(email));
    await dataRepo.createApproved(mockUser());

    const users = await dataRepo.all("arewaolakunle", {
      conditions: { email_address: email }
    });

    expect(users.length).toBe(2);
  });

  it("Should return users based on who asked", async () => {
    const firstMail = faker.internet.email();
    const secondMail = faker.internet.email();
    const chudiName = faker.name.findName();
    const arewaName = faker.name.findName();
    const dto = mockUser();

    const one = await dataRepo.createApproved(mockUser(firstMail));
    const two = await dataRepo.createApproved(mockUser(secondMail));
    await dataRepo.create("arewaolakunle", dto);

    await dataRepo.update("arewaolakunle", one.id, { full_name: arewaName });
    await dataRepo.update("chudioranu", two.id, { full_name: chudiName });

    const arewaUsers = await dataRepo.all("arewaolakunle");
    const chudiUsers = await dataRepo.all("chudioranu");
    const includingNew = await dataRepo.all("nobody", {}, true);

    expect(arewaUsers.length).toBe(2);
    expect(chudiUsers.length).toBe(2);
    expect(includingNew.length).toBe(3);
    expect(includingNew.find(x => x.email_address === dto.email_address)).toBeDefined();

    const chudiQueried = await dataRepo.all("chudioranu", {
      conditions: { ...dataRepo.queryPathHelper("full_name", chudiName) }
    });

    expect(chudiQueried.length).toBe(1);
    expect(chudiQueried[0].object_state).toBe(ObjectState.Updated);
    expect(chudiQueried[0].email_address).toBe(secondMail);
  });
});
