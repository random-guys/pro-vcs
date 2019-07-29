import { BaseRepository, ModelNotFoundError } from "@random-guys/bucket";
import { diff, applyChange } from "deep-diff";
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

  async create(user: string, attributes: object): Promise<T> {
    // create the document in staged mode
    const newModel = await this.dataRepo.create({
      ...attributes,
      frozen: true
    })

    // create a request
    const request = await this.requestRepo.create({
      reference: newModel.id,
      document_type: this.documentType,
      creator: user,
      patchType: 'create',
      diffs: diff(null, attributes)
    })

    // ask for review
    await requestReview(request)

    return newModel
  }

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
        const modelName = this.dataRepo.name
        throw new ModelNotFoundError(`${modelName} not found`)
      }

      // apply diff if patch is an update
      if (latest.patchType === 'update') {
        latest.diffs.forEach((diff) => {
          applyChange(current, {}, diff)
        })
      }
    }
    return current
  }
} 