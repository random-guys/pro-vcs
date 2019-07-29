import { BaseRepository, MongooseNamespace } from "@random-guys/bucket";
import { User } from "./user.model";
import { UserSchema } from "./user.schema";

export class UserRepository extends BaseRepository<User> {

  constructor(mongoose: MongooseNamespace) {
    super(mongoose, 'User', UserSchema)
  }
}