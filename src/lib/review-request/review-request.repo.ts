import { BaseRepository, MongooseNamespace, ModelNotFoundError } from "@random-guys/bucket";
import { ReviewRequest } from "./review-request.model";
import { ReviewRequestSchema } from "./review-request.schema";

export class ReviewRequestRepository extends BaseRepository<ReviewRequest>{
  constructor(mongoose: MongooseNamespace) {
    super(mongoose, 'ReviewRequest', ReviewRequestSchema)
  }

  latestPatch(reference: string, throwOnNull = true) {
    return new Promise<ReviewRequest>((resolve, reject) => {
      this.model
        .findOne({ reference })
        .sort({ created_at: 'desc' })
        .exec((err, rev) => {
          if (err) return reject(err)
          if (!rev && throwOnNull)
            return reject(new ModelNotFoundError('ReviewRequest not found'))
          resolve(rev)
        })
    })
  }
}