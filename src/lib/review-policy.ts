import { BaseRepository } from "@random-guys/bucket";
import { ReviewableModel, ReviewRequestRepository } from "./review-request";
import { requestReview } from "./lotan-client";
import { diff } from "deep-diff";

export class ReviewPolicy<T extends ReviewableModel> {
  constructor(
    private documentType: string,
    private requestRepo: ReviewRequestRepository,
    private dataRepo: BaseRepository<T>
  ) {
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