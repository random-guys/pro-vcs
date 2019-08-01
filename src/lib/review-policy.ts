import { BaseRepository, ModelNotFoundError } from "@random-guys/bucket";
import { applyChange, diff } from "deep-diff";
import { requestReview } from "./prohub-client";
import { ReviewableModel, ReviewRequestRepository } from "./review-request";
import { slugify } from "./string";


export class ReviewPolicy<T extends ReviewableModel> {
  private documentType: string

  constructor(
    private requestRepo: ReviewRequestRepository,
    private dataRepo: BaseRepository<T>
  ) {
    this.documentType = slugify(dataRepo.name)
  }

  async create(user: string, attributes: any): Promise<T> {
    // create the document in staged mode
    const newModel = await this.dataRepo.create({
      ...attributes,
      frozen: true
    })

    // make sure attributes doesn't contain frozen
    const { frozen, ...diffable } = attributes

    // create a request
    const request = await this.requestRepo.create({
      reference: newModel.id,
      document_type: this.documentType,
      creator: user,
      patchType: 'create',
      diffs: diff(null, diffable)
    })

    // ask for review
    await requestReview(request)

    return newModel
  }

  /**
   * Get latest document based on patch history.
   * @param reference reference ID from source document
   */
  async getLatest(reference: string) {
    const latest = await this.requestRepo.latestPatch(reference)
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
      if (latest.patchType === 'update') {
        // note that mongoose will not allow deletes
        // so those diffs will be ignored
        latest.diffs.forEach((diff) => {
          applyChange(current, {}, diff)
        })
      }
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
    const request = await this.requestRepo.create({
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
    const request = await this.requestRepo.create({
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