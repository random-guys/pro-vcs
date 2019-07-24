import { BaseRepository } from "@random-guys/bucket";
import { ReviewableModel, ReviewRequestRepository } from "./review-request";

export class ReviewPolicy<T extends ReviewableModel> {

  constructor(
    private requestRepo: ReviewRequestRepository,
    private dataRepo: BaseRepository<T>
  ) {
  }
} 