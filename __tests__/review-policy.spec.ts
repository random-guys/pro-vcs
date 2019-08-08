import { MongooseNamespace, defaultMongoOpts } from "@random-guys/bucket";
import { PatchRepository, ReviewPolicy } from "../src"
import { UserRepository, User } from "../mocks/user"
import mongoose from "mongoose";


describe('Policy Operations', () => {
  let mongooseNs: MongooseNamespace
  let patchRepo: PatchRepository
  let dataRepo: UserRepository
  let dataPolicy: ReviewPolicy<User>
  let userRef: string


  beforeAll(async () => {
    mongooseNs = await mongoose.connect(
      'mongodb://localhost:27017/sterlingpro-test',
      defaultMongoOpts
    )
    patchRepo = new PatchRepository(mongoose)
    dataRepo = new UserRepository(mongoose)
    dataPolicy = new ReviewPolicy(patchRepo, dataRepo)
  })


  afterAll(async () => {
    // clean up
    await mongooseNs.connection.dropDatabase()
    await mongooseNs.disconnect()
  })

  it('should create a patch when create is called', async () => {
    const ref = await dataPolicy.create('arewaolakunle', {
      fullname: 'Olakunle Daniel Arewa',
      email_address: 'danceasarxx@gmail.com'
    })

    const patch = await patchRepo.byReference(ref)
    expect(patch.patchType).toBe('create')
    expect(patch.payload).toBeTruthy()
    expect(patch.payload['fullname']).toBe('Olakunle Daniel Arewa')
  })


  // it('should create a staged document', async () => {
  //   const user = await dataPolicy.create('arewaolakunle', {
  //     fullname: 'Olakunle Daniel Arewa',
  //     email_address: 'danceasarxx@gmail.com'
  //   })

  //   const patch = await patchRepo.byQuery({
  //     reference: user.id
  //   })

  //   userRef = user.id

  //   expect(user.frozen).toBe(true)
  //   expect(patch.creator).toBe('arewaolakunle')
  //   expect(patch.patchType).toBe('create')

  //   expect(patch.diffs.length).toBe(1)
  //   expect(patch.diffs[0].kind).toBe('E')
  //   expect(patch.diffs[0]['lhs']).toBeNull()
  // })

  // it('should update an unstaged document', async () => {
  //   const user = await dataPolicy.update('arewaolakunle', userRef, {
  //     fullname: 'Olakunle Arewa',
  //     email_address: 'arewa@gmail.com'
  //   })

  //   const patch = await patchRepo.latestPatch(user.id)

  //   expect(user.frozen).toBe(true)
  //   expect(patch.creator).toBe('arewaolakunle')
  //   expect(patch.patchType).toBe('update')

  //   const diffObj = convert(patch.diffs)
  //   expect(diffObj.fullname.kind).toBe('E')
  //   expect(diffObj.email_address.kind).toBe('E')
  //   expect(diffObj.fullname.rhs).toBe('Olakunle Arewa')
  //   expect(diffObj.email_address.rhs).toBe('arewa@gmail.com')
  // })

  // it('should get the latest version of the user', async () => {
  //   const current = await dataPolicy.getLatest(userRef)
  //   expect(current.email_address).toBe('arewa@gmail.com')
  //   expect(current.fullname).toBe('Olakunle Arewa')
  // })
})
