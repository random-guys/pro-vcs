import { BaseRepository, MongooseNamespace } from "@random-guys/bucket";
import { ReviewRequest } from "./review-request.model";
import { ReviewRequestSchema } from "./review-request.schema";

export class ReviewRequestRepository extends BaseRepository<ReviewRequest>{
  constructor(mongoose: MongooseNamespace) {
    super(mongoose, 'ReviewRequest', ReviewRequestSchema)
  }
}