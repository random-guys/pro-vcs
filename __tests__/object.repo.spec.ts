import { defaultMongoOpts } from "@random-guys/bucket";
import { publisher } from "@random-guys/eventbus";
import { createLogger } from "bunyan";
import dotenv from "dotenv";
import faker from "faker";
import mongoose, { Connection } from "mongoose";
import { ObjectRepository, ObjectState } from "../src";
import { mockUser, User, UserSchema } from "./mocks/user";
import { UserMerger } from "./mocks/user/user.merger";

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
  }, 5000);

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

  it("Should stabilise an update on merge", async () => {
    const name = faker.name.findName();
    const dto = mockUser(faker.internet.email());

    const user = await dataRepo.createApproved(dto);

    const update = await dataRepo.update("tobslob", user.id, { full_name: name });

    await dataRepo.merge(update.id);
    const readUser = await dataRepo.get("someone", user.id);

    expect(readUser.full_name).toBe(name);
    expect(update.full_name).toBe(name);
    expect(readUser.object_state).toBe(ObjectState.Stable);
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

  it("Should return the an approved user", async () => {
    const user = await dataRepo.create("jose", mockUser());
    const loadedUser = await dataRepo.byQuery("arewaolakunle", { full_name: user.full_name }, false, false);

    expect(loadedUser).toBeNull();
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

  it("should update an object and keep it in stable state", async () => {
    const nok = await dataRepo.createApproved(mockUser("nok@ru.com"));
    const nok2 = await dataRepo.updateApproved(nok.id, { email_address: "loo@tx.com" });

    expect(nok.email_address).not.toBe(nok2.email_address);
    expect(nok2.object_state).toBe(ObjectState.Stable);
  });

  it("should delete an object immediately", async () => {
    const nok = await dataRepo.createApproved(mockUser("nok@ru.com"));
    const nok2 = await dataRepo.deleteApproved(nok.id);

    expect(dataRepo.get("everyone", nok.id)).rejects.toThrow("User not found");
    expect(nok2.object_state).toBe(ObjectState.Stable);
  });

  it("should delete all objects immediately", async () => {
    await dataRepo.createApproved(mockUser());
    await dataRepo.createApproved(mockUser());
    await dataRepo.createApproved(mockUser());
    const users = await dataRepo.all("everyone", {});

    await dataRepo.truncate({});
    const noUsers = await dataRepo.all("everyone", {});

    expect(users.length).not.toBe(noUsers.length);
    expect(noUsers).toHaveLength(0);
  });
});
