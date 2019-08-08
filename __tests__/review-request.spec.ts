import { defaultMongoOpts, MongooseNamespace } from "@random-guys/bucket";
import mongoose from "mongoose";
import { PatchRepository } from "../src";

function timeout(time: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

describe('Special Repo Methods', () => {
  let mongooseNs: MongooseNamespace
  let requestRepo: PatchRepository

  const sampleRequest = {
    reference: 'reference',
    creator: 'arewa',
    document_type: 'man',
    patchType: 'update',
    diffs: []
  }


  beforeAll(async () => {
    mongooseNs = await mongoose.connect(
      'mongodb://localhost:27017/sterlingpro-test',
      defaultMongoOpts
    )
    requestRepo = new PatchRepository(mongoose)
  })


  afterAll(async () => {
    // clean up
    await mongoose.connection.dropDatabase()
    await mongooseNs.disconnect()
  })

  it('should not', async () => {
    expect(true).toBe(true)
  })


  // it('should create a staged document', async () => {
  //   const creators = ['arewa', 'chudi', 'farouq', 'ismail', 'yemi']
  //   for (const creator of creators) {
  //     await requestRepo.create({
  //       ...sampleRequest, creator
  //     })
  //   }

  //   const yemi = await requestRepo.latestPatch('reference')
  //   const arewa = await requestRepo.byQuery({
  //     reference: 'reference'
  //   })

  //   expect(arewa.creator).toBe('arewa')
  //   expect(yemi.creator).toBe('yemi')
  // })
})
