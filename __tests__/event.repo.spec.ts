import { defaultMongoOpts, MongooseNamespace } from '@random-guys/bucket';
import mongoose from 'mongoose';
import { mockUser, User } from '../mocks/user';
import { EventRepository } from '../src';
import { EventType } from '../src/event.model'; // test couldn't detect eventType from outside

describe('Event Schema Rules', () => {
  let mongooseNs: MongooseNamespace;
  let dataRepo: EventRepository<User>;

  beforeAll(async () => {
    mongooseNs = await mongoose.connect(
      'mongodb://localhost:27017/sterlingpro-test',
      defaultMongoOpts
    );
    dataRepo = new EventRepository(mongooseNs, 'User');
  });

  afterAll(async () => {
    // clean up
    await mongooseNs.connection.dropDatabase();
    await mongooseNs.disconnect();
  });

  it('Should add create metadata to a new event', async () => {
    const user = await dataRepo.create('arewaolakunle', mockUser());

    expect(user.metadata.eventType).toBe(EventType.created);
    expect(user.metadata.owner).toBe('arewaolakunle');

    // cleanup afterwards
    await user.remove();
  });

  it('Should get a newly created event', async () => {
    const user = await dataRepo.create('arewaolakunle', mockUser());
    const loadedUser = await dataRepo.get('olaolu', user.id);

    expect(loadedUser.id).toBe(user.id);

    // cleanup afterwards
    await user.remove();
  });

  it('Should create a new update event', async () => {
    const user = await dataRepo.create('arewaolakunle', mockUser());
    // approve the document
    dataRepo.internalRepo.atomicUpdate(user._id, {
      'metadata.eventType': EventType.approved,
      'metadata.frozen': false
    });

    const userUpdate = await dataRepo.update('arewaolakunle', user.id, {
      email_address: 'nope@gmail.com'
    });

    expect(userUpdate.metadata.reference).toBe(user.id);
    expect(userUpdate.metadata.eventType).toBe(EventType.updated);
    expect(userUpdate.metadata.owner).toBe('arewaolakunle');
    expect(userUpdate.payload.email_address).toBe('nope@gmail.com');

    // cleanup afterwards
    await userUpdate.remove();

    await user.remove();
  });

  it('Should update a pending create', async () => {
    const user = await dataRepo.create('arewaolakunle', mockUser());

    const userUpdate = await dataRepo.update('arewaolakunle', user.id, {
      email_address: 'nope@gmail.com'
    });

    expect(userUpdate._id).toBe(user._id);
    expect(userUpdate.metadata.eventType).toBe(EventType.created);
    expect(userUpdate.metadata.owner).toBe('arewaolakunle');
    expect(userUpdate.payload.email_address).toBe('nope@gmail.com');

    // cleanup afterwards
    await userUpdate.remove();

    await user.remove();
  });
});
