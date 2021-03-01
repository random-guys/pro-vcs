import { defaultMongoOpts } from "@random-guys/bucket";
import dotenv from 'dotenv';
import mongoose, { Connection } from "mongoose";
import { ObjectState } from '../src/objects';
import { ObjectRepositoryV2 } from '../src/objects/repo-v2';
import { User } from "./mocks/user";
import { mockUser } from './mocks/user/index';
import { UserSchema } from './mocks/user/user.schema';

let conn: Connection;
let dataRepo: ObjectRepositoryV2<User>;

beforeAll(async () => {
  dotenv.config();

  conn = await mongoose.createConnection(process.env.MONGODB_URL, defaultMongoOpts);
  dataRepo = new ObjectRepositoryV2(conn, "User", UserSchema);
}, 5000);

afterAll(async () => {
  await conn.close();
});

afterEach(async () => {
  await dataRepo.truncate({});
});

describe("Creating in mongodb directly", () => {
  it("should create a PayloadModel object", async () => {
    const user = await dataRepo.createRaw("arewaolakunle", mockUser());

    expect(user.id).toBeDefined();
    expect(user.created_at).toBeDefined();
    expect(user.updated_at).toBeDefined();
    expect(user.object_state).toBe(ObjectState.Created);

    // ensure no other user can see created
    const readerUser = await dataRepo.get("someone", user.id);
    expect(readerUser.object_state).toBe(ObjectState.Frozen);
  });

  describe("Merging to mongodb directly", () => {
    it("stabilises an unstable model", async () => {
      const user = await dataRepo.createRaw("arewaolakunle", mockUser());

      const mergedUser = await dataRepo.mergeRaw(user.id);

      expect(mergedUser.id).toBe(user.id);
      expect(mergedUser.object_state).toBe(ObjectState.Stable);
    });

    it("uses mongodb update operators", async () => {
      const user = await dataRepo.createRaw("arewaolakunle", mockUser());
      const mergedUser = await dataRepo.mergeRaw(user.id, { $inc: { age: 10 } });

      expect(mergedUser.id).toBe(user.id);
      expect(mergedUser.object_state).toBe(ObjectState.Stable);

      expect(mergedUser["age"]).toBe(10);
    });

    it("merges the $set operator", async () => {
      const user = await dataRepo.createRaw("arewaolakunle", mockUser());
      const mergedUser = await dataRepo.mergeRaw(user.id, { $inc: { age: 10 }, $set: { wildlife: true } });

      expect(mergedUser.id).toBe(user.id);
      expect(mergedUser.object_state).toBe(ObjectState.Stable);

      expect(mergedUser["age"]).toBe(10);
      expect(mergedUser["wildlife"]).toBe(true);
    });
  })
});