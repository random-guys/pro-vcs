import { BaseRepository, MongooseNamespace } from "@random-guys/bucket";
import { Patch } from "./patch.model";
import { PatchSchema } from "./patch.schema";

export class PatchRepository extends BaseRepository<Patch>{
  constructor(mongoose: MongooseNamespace) {
    super(mongoose, 'Patch', PatchSchema)
  }

  /**
   * Get patch by reference.
   * @param reference 
   */
  byReference(reference: string) {
    return this.byQuery({ reference })
  }
}