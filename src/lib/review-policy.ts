import { BaseRepository } from "@random-guys/bucket";
import { diff } from "deep-diff";
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
      staged: true
    })

    // create a request
    const request = await this.requestRepo.create({
      reference: newModel.id,
      document_type: this.documentType,
      creator: user,
      diffs: diff(null, attributes)
    })

    // ask for review
    await requestReview(request)

    return newModel
  }
} 