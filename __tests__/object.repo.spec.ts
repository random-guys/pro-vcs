import { defaultMongoOpts, MongooseNamespace } from "@random-guys/bucket";
import { publisher } from "@random-guys/eventbus";
import mongoose from "mongoose";
import { mockUser, User, UserSchema } from "../mocks/user";
import { ObjectRepository, ObjectState } from "../src";

describe("ProVCS Repo Constraints", () => {
  let mongooseNs: MongooseNamespace;
  let dataRepo: ObjectRepository<User>;

  beforeAll(async () => {
    mongooseNs = await mongoose.connect(
      "mongodb://localhost:27017/sterlingpro-test",
      defaultMongoOpts
    );
    await publisher.init("amqp://localhost:5672");
    dataRepo = new ObjectRepository(mongooseNs, "User", UserSchema);
  });

  afterAll(async () => {
    // clean up
    await mongooseNs.connection.dropDatabase();
    await mongooseNs.disconnect();
    await publisher.close();
  });

  function cleanRepo(reference: string) {
    return dataRepo.internalRepo.destroy(reference, false);
  }

  it("Should add create metadata to a new event", async () => {
    const user = await dataRepo.create("arewaolakunle", mockUser());
    const readerUser = await dataRepo.get("someone", user.id);

    // owner should see created
    expect(user.object_state).toBe(ObjectState.Created);
    // ensure no other user can see created
    expect(readerUser.object_state).toBe(ObjectState.Frozen);

    // cleanup afterwards
    await cleanRepo(user.id);
  });

  it("Should update a pending create", async () => {
    const user = await dataRepo.create("arewaolakunle", mockUser());
    const writeUser = await dataRepo.update("arewaolakunle", user.id, {
      email_address: "nope@gmail.com"
    });
    const readerUser = await dataRepo.get("someone", user.id);

    // they must see the same thing
    expect(writeUser.email_address).toBe("nope@gmail.com");
    expect(writeUser.email_address).toBe(readerUser.email_address);

    await cleanRepo(user.id);
  });

  it("Should delete a pending create", async () => {
    const user = await dataRepo.create("arewaolakunle", mockUser());
    await dataRepo.delete("arewaolakunle", user.id);

    expect(dataRepo.get("someone", user.id)).rejects.toThrowError(
      /User not found/
    );

    await cleanRepo(user.id);
  });

  it("Should create a new update", async () => {
    const user = await dataRepo.createApproved(mockUser());
    const writeUser = await dataRepo.update("arewaolakunle", user.id, {
      email_address: "nope@gmail.com"
    });
    const readerUser = await dataRepo.get("someone", user.id);

    // different strokes for the different folks
    expect(writeUser.email_address).toBe("nope@gmail.com");
    expect(readerUser.email_address).toBe("jasming@gmail.com");

    // what can the user do
    expect(writeUser.object_state).toBe(ObjectState.Updated);
    expect(readerUser.object_state).toBe(ObjectState.Frozen);

    // cleanup afterwards
    await cleanRepo(user.id);
  });

  it("Should patch an update", async () => {
    const user = await dataRepo.createApproved(mockUser());
    await dataRepo.update("arewaolakunle", user.id, {
      email_address: "nope@gmail.com"
    });
    const writeUser = await dataRepo.update("arewaolakunle", user.id, {
      email_address: "patch@gmail.com"
    });
    const readerUser = await dataRepo.get("someone", user.id);

    // different strokes for the different folks
    expect(writeUser.email_address).toBe("patch@gmail.com");
    expect(readerUser.email_address).toBe("jasming@gmail.com");

    // cleanup afterwards
    await cleanRepo(user.id);
  });

  it("Should undo an update", async () => {
    const user = await dataRepo.createApproved(mockUser());
    await dataRepo.update("arewaolakunle", user.id, {
      email_address: "nope@gmail.com"
    });

    const writeUser = await dataRepo.delete("arewaolakunle", user.id);
    const readerUser = await dataRepo.get("someone", user.id);

    // on the same earth
    expect(writeUser.email_address).toBe("jasming@gmail.com");
    expect(readerUser.email_address).toBe("jasming@gmail.com");

    // cleanup afterwards
    await cleanRepo(user.id);
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

    await cleanRepo(user.id);
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

    await cleanRepo(user.id);
  });

  it("Should return the an approved user", async () => {
    const user = await dataRepo.createApproved(mockUser());
    const loadedUser = await dataRepo.byQuery("arewaolakunle", {
      fullname: "Jasmine Joe"
    });

    expect(loadedUser.id).toBe(user.id);
    await cleanRepo(user.id);
  });

  it("Should return the all approved users", async () => {
    await dataRepo.createApproved(mockUser());
    await dataRepo.createApproved(mockUser());
    await dataRepo.createApproved(mockUser());
    const users = await dataRepo.all("arewaolakunle", {
      conditions: {
        fullname: "Jasmine Joe"
      }
    });

    expect(users.length).toBe(3);
    await dataRepo.internalRepo.model.deleteMany({}).exec();
  });

  it("Should return users based on who asked", async () => {
    const nok = await dataRepo.createApproved(mockUser("nok@ru.com"));
    const looj = await dataRepo.createApproved(mockUser("looj@rx.com"));
    await dataRepo.create("arewaolakunle", mockUser());

    await dataRepo.update("arewaolakunle", nok.id, { fullname: "Wakanda" });
    await dataRepo.update("chudioranu", looj.id, { fullname: "Is Stupid" });

    const aUsers = await dataRepo.all("arewaolakunle");
    const cUsers = await dataRepo.all("chudioranu");
    const withNew = await dataRepo.all("nobody", {}, true);

    expect(aUsers.length).toBe(2);
    expect(cUsers.length).toBe(2);
    expect(withNew.length).toBe(3);
    expect(
      withNew.find(x => x.email_address === "jasming@gmail.com")
    ).toBeDefined();

    const aUser = await dataRepo.all("chudioranu", {
      conditions: {
        ...dataRepo.queryPathHelper("fullname", "Is Stupid")
      }
    });
    expect(aUser.length).toBe(1);
    expect(aUser[0].object_state).toBe(ObjectState.Updated);
    expect(aUser[0].email_address).toBe("looj@rx.com");

    await dataRepo.internalRepo.model.deleteMany({}).exec();
  });
});