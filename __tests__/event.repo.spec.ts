import { defaultMongoOpts, MongooseNamespace } from '@random-guys/bucket';
import mongoose from 'mongoose';
import {
  mockUser,
  User,
  mockApprovedUser,
  mockFrozenUser
} from '../mocks/user';
import { EventRepository } from '../src';
import { EventType } from '../src/event.model'; // test couldn't detect eventType from outside
import { mockUnapprovedUpdate } from '../mocks/user/index';

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
    const user = await dataRepo.internalRepo.create(
      mockApprovedUser('arewaolakunle')
    );

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

    await user.remove();
  });

  it('Should undo a pending update', async () => {
    const user = await dataRepo.internalRepo.create(
      mockFrozenUser('arewaolakunle')
    );
    await dataRepo.internalRepo.create(
      mockUnapprovedUpdate('arewaolakunle', user.id, 'nope@gmail.com')
    );

    const userUpdate = await dataRepo.delete('arewaolakunle', user.id);

    expect(userUpdate.id).toBe(user.id);
    expect(userUpdate.metadata.eventType).toBe(EventType.updated);
    expect(userUpdate.metadata.owner).toBe('arewaolakunle');
    expect(userUpdate.payload.email_address).toBe('nope@gmail.com');

    await user.remove();
  });

  it('Should undo a pending delete', async () => {
    const user = await dataRepo.internalRepo.create(
      mockApprovedUser('arewaolakunle')
    );
    const userDelete = await dataRepo.delete('arewaolakunle', user.id);
    const removedDelete = await dataRepo.delete('arewaolakunle', user.id);
    const refs = await dataRepo.internalRepo.all({
      conditions: {
        'metadata.reference': user.id
      }
    });

    expect(userDelete._id).toBe(removedDelete._id);
    expect(removedDelete.metadata.eventType).toBe(EventType.deleted);
    expect(refs.length).toBe(1);
    expect(refs[0].metadata.eventType).toBe(EventType.approved);

    await user.remove();
  });

  it('Should delete a pending create', async () => {
    const user = await dataRepo.create('arewaolakunle', mockUser());
    const event = await dataRepo.delete('arewaolakunle', user.id);
    const loadedUser = await dataRepo.internalRepo.byID(user._id, null, false);

    expect(event._id).toBe(user._id);
    expect(event.metadata.eventType).toBe(EventType.created);
    expect(event.metadata.owner).toBe('arewaolakunle');
    expect(loadedUser).toBeNull();

    await user.remove();
  });

  it('Should create a delete event', async () => {
    const user = await dataRepo.internalRepo.create(
      mockApprovedUser('arewaolakunle')
    );
    const userDelete = await dataRepo.delete('arewaolakunle', user.id);
    const loadedUser = await dataRepo.internalRepo.byID(user._id);

    expect(userDelete.id).toBe(user.id);
    expect(userDelete.metadata.eventType).toBe(EventType.deleted);
    expect(userDelete.metadata.owner).toBe('arewaolakunle');
    expect(loadedUser.frozen).toBe(true);

    await userDelete.remove();
    await user.remove();
  });
});
