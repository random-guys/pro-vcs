import { MongooseNamespace, defaultMongoOpts } from "@random-guys/bucket";
import { ReviewRequestRepository, ReviewPolicy } from "../src"
import { UserRepository, User } from "../mocks/user"
import mongoose from "mongoose";


describe('Policy Operations', () => {
  let mongooseNs: MongooseNamespace
  let requestRepo: ReviewRequestRepository
  let dataRepo: UserRepository
  let dataPolicy: ReviewPolicy<User>


  beforeAll(async () => {
    mongooseNs = await mongoose.connect(
      'mongodb://localhost:27017/sterlingpro-test',
      defaultMongoOpts
    )
    requestRepo = new ReviewRequestRepository(mongoose)
    dataRepo = new UserRepository(mongoose)
    dataPolicy = new ReviewPolicy(requestRepo, dataRepo)
  })


  afterAll(async () => {
    // clean up
    await mongooseNs.connection.dropDatabase()
    await mongooseNs.disconnect()
  })


  it('should create a staged document', async () => {
    const user = await dataPolicy.create('arewaolakunle', {
      fullname: 'Olakunle Daniel Arewa',
      email_address: 'danceasarxx@gmail.com'
    })

    const patch = await requestRepo.byQuery({
      reference: user.id
    })

    expect(user.frozen).toBe(true)
    expect(patch.creator).toBe('arewaolakunle')
    expect(patch.patchType).toBe('create')

    const stagedDiff = patch.diffs.length
    expect(patch.diffs.length).toBe(1)
    expect(patch.diffs[0].kind).toBe('E')
    expect(patch.diffs[0]['lhs']).toBeNull()
  })
})
