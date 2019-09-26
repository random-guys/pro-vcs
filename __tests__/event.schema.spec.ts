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

  it('Should remove __owner and __payload for toObject', async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toObject();

    expect(userObject.object_state).toBe(ObjectState.created);
    expect(userObject.__patch).toBeUndefined();
    expect(userObject.__owner).toBeUndefined();

    // cleanup afterwards
    await user.remove();
  });

  it('Should remove __owner and __payload for toJSON', async () => {
    const user = await dataRepo.create(mockEmptyUserEvent());
    const userObject = user.toJSON();

    expect(userObject.object_state).toBe(ObjectState.created);
    expect(userObject.__patch).toBeUndefined();
    expect(userObject.__owner).toBeUndefined();

    // cleanup afterwards
    await user.remove();
  });
});
