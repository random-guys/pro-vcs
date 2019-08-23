import { defaultMongoOpts, MongooseNamespace } from "@random-guys/bucket";
import mongoose from "mongoose";
import { mockUser, User } from "../mocks/user";
import { EventRepository } from "../src";

describe('Event Schema Rules', () => {
  let mongooseNs: MongooseNamespace
  let dataRepo: EventRepository<User>

  beforeAll(async () => {
    mongooseNs = await mongoose.connect(
      'mongodb://localhost:27017/sterlingpro-test',
      defaultMongoOpts
    )
    dataRepo = new EventRepository(mongooseNs, 'User')
  })


  afterAll(async () => {
    // clean up
    await mongooseNs.connection.dropDatabase()
    await mongooseNs.disconnect()
  })

  it('Should add create metadata to a new event', async () => {
    const user = await dataRepo.create('arewaolakunle', mockUser())

    expect(user.metadata.action).toBe('create')

    // cleanup afterwards
    await user.remove()
  })

  it('Should get a newly created event', async () => {
    const user = await dataRepo.create('arewaolakunle', mockUser())
    const loadedUser = await dataRepo.get('olaolu', user.id)

    expect(loadedUser.id).toBe(user.id)

    // cleanup afterwards
    await user.remove()
  })

})