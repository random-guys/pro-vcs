import {
  BaseRepository,
  defaultMongoOpts,
  MongooseNamespace
} from '@random-guys/bucket';
import mongoose from 'mongoose';
import { mockEmptyUserEvent, User, UserSchema } from '../mocks/user';
import { EventModel, EventSchema, ObjectState } from '../src';

describe('Event Schema Rules', () => {
  let mongooseNs: MongooseNamespace;
  let dataRepo: BaseRepository<EventModel<User>>;

  beforeAll(async () => {
    mongooseNs = await mongoose.connect(
      'mongodb://localhost:27017/sterlingpro-test',
      defaultMongoOpts
    );
    dataRepo = new BaseRepository(mongoose, 'TestDB', EventSchema(UserSchema));
  });

  afterAll(async () => {
    // clean up
    await mongooseNs.connection.dropDatabase();
    await mongooseNs.disconnect();
  });

  it('Should attach id,frozen and timestamps for toObject', async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toObject();

    expect(userObject.id).toBe(user.metadata.reference);
    expect(userObject.object_state).toBe(user.metadata.objectState);
    expect(userObject.fullname).toBe((<User>user.payload).fullname);
    expect(userObject.created_at).toStrictEqual(user.created_at);
    expect(userObject.updated_at).toStrictEqual(user.updated_at);

    // cleanup afterwards
    await user.remove();
  });

  it('Should attach id and frozen for toJSON', async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toJSON();

    expect(userObject.id).toBe(user.metadata.reference);
    expect(userObject.object_state).toBe(user.metadata.objectState);
    expect(userObject.fullname).toBe((<User>user.payload).fullname);
    expect(userObject.created_at).toStrictEqual(user.created_at);
    expect(userObject.updated_at).toStrictEqual(user.updated_at);

    // cleanup afterwards
    await user.remove();
  });

  it('should have virtuals id and frozen', async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());

    expect(user.id).toBe(user.metadata.reference);
    expect(user.object_state).toBe(ObjectState.created);

    // cleanup afterwards
    await user.remove();
  });
});
