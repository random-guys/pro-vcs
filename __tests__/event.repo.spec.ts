import { defaultMongoOpts, MongooseNamespace } from '@random-guys/bucket';
import { publisher } from '@random-guys/eventbus';
import mongoose from 'mongoose';
import {
  mockApprovedUser,
  mockFrozenUser,
  mockUser,
  User,
  UserSchema
} from '../mocks/user';
import { mockUnapprovedUpdate } from '../mocks/user/index';
import { EventRepository } from '../src';
import { ObjectState } from '../src/event.model'; // test couldn't detect eventType from outside

describe('ProVCS Repo Constraints', () => {
  let mongooseNs: MongooseNamespace;
  let dataRepo: EventRepository<User>;

  beforeAll(async () => {
    mongooseNs = await mongoose.connect(
      'mongodb://localhost:27017/sterlingpro-test',
      defaultMongoOpts
    );
    await publisher.init('amqp://localhost:5672');
    dataRepo = new EventRepository(mongooseNs, 'User', UserSchema);
  });

  afterAll(async () => {
    // clean up
    await mongooseNs.connection.dropDatabase();
    await mongooseNs.disconnect();
    await publisher.close();
  });

  it('Should add create metadata to a new event', async () => {
    const user = await dataRepo.create('arewaolakunle', mockUser());

    expect(user.metadata.objectState).toBe(ObjectState.created);
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
    const user = await dataRepo.internalRepo.create(mockApprovedUser());
    const userUpdate = await dataRepo.update('arewaolakunle', user.id, {
      email_address: 'nope@gmail.com'
    });
    const reloadedUser = await dataRepo.get('nobody', user.id);
    const loadedUser = await dataRepo.get('arewaolakunle', user.id);

    // confirm the new update
    expect(userUpdate.metadata.reference).toBe(user.id);
    expect(userUpdate.metadata.objectState).toBe(ObjectState.updated);
    expect(userUpdate.payload.email_address).toBe('nope@gmail.com');

    // confirm the old data
    expect(reloadedUser.metadata.objectState).toBe(ObjectState.frozen);
    expect(reloadedUser.metadata.owner).toBe('arewaolakunle');

    // confirm it respects get request
    expect(loadedUser._id).toBe(userUpdate._id);
    expect(loadedUser.payload.email_address).toBe('nope@gmail.com');

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
    expect(userUpdate.metadata.objectState).toBe(ObjectState.created);
    expect(userUpdate.metadata.owner).toBe('arewaolakunle');
    expect(userUpdate.payload.email_address).toBe('nope@gmail.com');

    await user.remove();
  });

  it('Should create a delete event', async () => {
    const user = await dataRepo.internalRepo.create(mockApprovedUser());
    const userDelete = await dataRepo.delete('arewaolakunle', user.id);
    const reloadedUser = await dataRepo.get('nobody', user.id);
    const loadedUser = await dataRepo.get('arewaolakunle', user.id);

    expect(userDelete.id).toBe(user.id);
    expect(userDelete.metadata.objectState).toBe(ObjectState.deleted);
    expect(userDelete.metadata.owner).toBe('arewaolakunle');
    expect(reloadedUser.object_state).toBe(ObjectState.frozen);
    expect(loadedUser.object_state).toBe(ObjectState.deleted);

    await userDelete.remove();
    await user.remove();
  });

  it('Should delete a pending create', async () => {
    const user = await dataRepo.create('arewaolakunle', mockUser());
    const event = await dataRepo.delete('arewaolakunle', user.id);
    const loadedUser = await dataRepo.internalRepo.byID(user._id, null, false);

    expect(event._id).toBe(user._id);
    expect(event.metadata.objectState).toBe(ObjectState.created);
    expect(event.metadata.owner).toBe('arewaolakunle');
    expect(loadedUser).toBeNull();

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
    expect(userUpdate.metadata.objectState).toBe(ObjectState.updated);
    expect(userUpdate.metadata.owner).toBe('arewaolakunle');
    expect(userUpdate.payload.email_address).toBe('nope@gmail.com');

    await user.remove();
  });

  it('Should undo a pending delete', async () => {
    const user = await dataRepo.internalRepo.create(mockApprovedUser());
    const userDelete = await dataRepo.delete('arewaolakunle', user.id);
    const removedDelete = await dataRepo.delete('arewaolakunle', user.id);
    const refs = await dataRepo.internalRepo.all({
      conditions: {
        'metadata.reference': user.id
      }
    });

    expect(userDelete._id).toBe(removedDelete._id);
    expect(removedDelete.metadata.objectState).toBe(ObjectState.deleted);
    expect(refs.length).toBe(1);
    expect(refs[0].metadata.objectState).toBe(ObjectState.stable);

    await user.remove();
  });

  it('Should return the am approved user', async () => {
    const user = await dataRepo.internalRepo.create(mockApprovedUser());
    const loadedUser = await dataRepo.byQuery('arewaolakunle', {
      fullname: 'Jasmine Joe'
    });

    expect(loadedUser._id).toBe(user._id);
    await user.remove();
  });

  it('Should return the all approved users', async () => {
    await dataRepo.internalRepo.create(mockApprovedUser());
    await dataRepo.internalRepo.create(mockApprovedUser());
    await dataRepo.internalRepo.create(mockApprovedUser());
    const users = await dataRepo.all('arewaolakunle', {
      conditions: {
        fullname: 'Jasmine Joe'
      }
    });

    expect(users.length).toBe(3);
    await dataRepo.internalRepo.model.deleteMany({}).exec();
  });

  it('Should return users based on who asked', async () => {
    const nok = await dataRepo.internalRepo.create(
      mockApprovedUser('nok@ru.com')
    );
    const looj = await dataRepo.internalRepo.create(
      mockApprovedUser('looj@rx.com')
    );
    await dataRepo.create('arewaolakunle', mockUser());

    await dataRepo.update('arewaolakunle', nok.id, { fullname: 'Wakanda' });
    await dataRepo.update('chudioranu', looj.id, { fullname: 'Is Stupid' });

    const aUsers = await dataRepo.all('arewaolakunle');
    const cUsers = await dataRepo.all('chudioranu');
    const minusNew = await dataRepo.all('nobody', {}, false);

    expect(aUsers.length).toBe(3);
    expect(cUsers.length).toBe(3);
    expect(minusNew.length).toBe(2);
    expect(minusNew[0].payload.fullname).toBe('Jasmine Joe');
    expect(minusNew[1].payload.fullname).toBe('Jasmine Joe');

    const aUser = await dataRepo.all('chudioranu', {
      conditions: {
        fullname: 'Is Stupid'
      }
    });
    expect(aUser.length).toBe(1);
    expect(aUser[0].metadata.objectState).toBe(ObjectState.updated);
    expect(aUser[0].payload.email_address).toBe('looj@rx.com');

    await dataRepo.internalRepo.model.deleteMany({}).exec();
  });
});
