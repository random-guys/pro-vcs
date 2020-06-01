import { BaseRepository, defaultMongoOpts } from "@random-guys/bucket";
import mongoose, { Connection } from "mongoose";
import { ObjectModel, ObjectState } from "../src";
import { mockEmptyUserEvent, User, UserSchema } from "./mocks/user";

describe("Event Schema Rules", () => {
  let conn: Connection;
  let dataRepo: BaseRepository<ObjectModel<User>>;

  beforeAll(async () => {
    conn = await mongoose.createConnection("mongodb://localhost:27017/sterlingpro-test", defaultMongoOpts);
    dataRepo = new BaseRepository(conn, "TestDB", UserSchema.schema);
  });

  afterAll(async () => {
    // clean up
    await conn.dropDatabase();
    await conn.close();
  });

  it("Should remove __owner and __payload for toObject", async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toObject();

    expect(userObject.object_state).toBe(ObjectState.Created);
    expect(userObject.__patch).toBeUndefined();
    expect(userObject.__owner).toBeUndefined();

    // cleanup afterwards
    await user.remove();
  });

  it("Should remove __owner and __payload for toJSON", async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toJSON();

    expect(userObject.object_state).toBe(ObjectState.Created);
    expect(userObject.__patch).toBeUndefined();
    expect(userObject.__owner).toBeUndefined();

    // cleanup afterwards
    await user.remove();
  });
});
