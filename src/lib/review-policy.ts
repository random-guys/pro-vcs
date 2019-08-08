import { BaseRepository, ModelNotFoundError } from "@random-guys/bucket";
import { diff } from "deep-diff";
import { PatcheableModel, PatchRepository } from "./patch";
import { requestReview } from "./prohub-client";
import { slugify } from "./string";


export class ReviewPolicy<T extends PatcheableModel> {
  private documentType: string

  constructor(
    private patchRepo: PatchRepository,
    private dataRepo: BaseRepository<T>
  ) {
    this.documentType = slugify(dataRepo.name)
  }

  async create(user: string, attributes: Partial<T>): Promise<T> {
    // make sure frozen cannot be set
    const { frozen, ...diffable } = attributes

    // create document temporarily
    const data = await this.dataRepo.create({
      frozen: true,
      ...diffable
    })

    // create patch for reference
    const patch = await this.patchRepo.create({
      reference: data.id,
      document_type: this.documentType,
      owner: user,
      patchType: 'create',
      payload: diffable
    })

    // ask for a review
    await requestReview(patch)

    return data
  }

  /**
   * Get latest document based on patch history.
   * @param reference reference ID from source document
   */
  async getLatest(reference: string) {
    const latest = await this.patchRepo.byReference(reference)
    const current = await this.dataRepo.byID(reference)

    if (latest) {
      // close early
      if (latest.patchType === 'create') {
        return current
      }

      // there's nothing for you
      if (latest.patchType === 'delete') {
        throw new ModelNotFoundError(`${this.dataRepo.name} not found`)
      }

      // apply diff if patch is an update
      // if (latest.patchType === 'update') {
      //   // note that mongoose will not allow deletes
      //   // so those diffs will be ignored
      //   latest.diffs.forEach((diff) => {
      //     applyChange(current, {}, diff)
      //   })
      // }
    }
    return current
  }

  /**
   * Request for an update on a whole document.
   * @param user user requesting for change
   * @param query query to pick the document to be updated
   * @param attributes new model. Note that not in this object
   * but in the existing will be removed from the existing items, this
   * is not $set
   */
  async update(user: string, query: string | object, attributes: any) {
    const current = await this.dataRepo.atomicUpdate(query, { frozen: true })

    // make sure attributes doesn't contain frozen
    const { frozen, ...diffable } = attributes

    // create a request
    const request = await this.patchRepo.create({
      reference: current.id,
      document_type: this.documentType,
      creator: user,
      patchType: 'update',
      diffs: diff(current.toObject(), diffable)
    })

    // ask for review
    await requestReview(request)

    return current
  }

  async remove(user: string, query: string | object) {
    const current = await this.dataRepo.atomicUpdate(query, { frozen: true })

    // create a request
    const request = await this.patchRepo.create({
      reference: current.id,
      document_type: this.documentType,
      creator: user,
      patchType: 'delete',
      diffs: diff(current.toObject(), null)
    })

    // ask for review
    await requestReview(request)

    return current
  }
} 