import { BaseRepository, defaultMongoOpts } from "@random-guys/bucket";
import mongoose, { Connection } from "mongoose";
import { ObjectModel, ObjectState } from "../../src";
import { mockEmptyUserEvent, User, UserSchema } from "../mocks/user";

describe("Event Schema Rules", () => {
  let conn: Connection;
  let dataRepo: BaseRepository<ObjectModel<User>>;

  beforeAll(async () => {
    conn = await mongoose.createConnection("mongodb://localhost:27017/sterlingpro-test", defaultMongoOpts);
    dataRepo = new BaseRepository(conn, "User", UserSchema.mongooseSchema);
  });

  afterAll(async () => {
    await conn.close();
  });

  afterEach(async () => {
    await dataRepo.truncate({});
  });

  it("Should remove __owner and __payload for toObject", async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toObject();

    expect(userObject.object_state).toBe(ObjectState.Created);
    expect(userObject.__patch).toBeUndefined();
    expect(userObject.__owner).toBeUndefined();
    expect(userObject.password_hash).toBeDefined();
  });

  it("Should add toJSON to the result of toObject", async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toObject();
    const userJSON = userObject.toJSON();

    expect(userObject.password_hash).toBeDefined();
    expect(userJSON.password_hash).toBeUndefined();
  });

  it("Spreading should not remove new properties", async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toObject();
    const wrapper = { money: "dollars", cash: "flow", ...userObject };
    const wrapperJSON = wrapper.toJSON();

    expect(wrapperJSON.password_hash).toBeUndefined();
    expect(wrapperJSON.money).toBeDefined();
    expect(wrapperJSON.cash).toBeDefined();
  });

  it("Should remove __owner and __payload for toJSON", async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toJSON();

    expect(userObject.object_state).toBe(ObjectState.Created);
    expect(userObject.__patch).toBeUndefined();
    expect(userObject.__owner).toBeUndefined();
    expect(userObject.password_hash).toBeUndefined();
  });

  it("should prevent creating duplicate objects based on the indexes", async () => {
    const dto = mockEmptyUserEvent();
    await dataRepo.create(dto);

    await expect(dataRepo.create(dto)).rejects.toThrow(/User exists already/);
  });
});
