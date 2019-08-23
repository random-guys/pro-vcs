import { MongooseNamespace } from "@random-guys/bucket";
import { EventRepository } from "../../src";
import { User } from "./user.model";
import { UserSchema } from "./user.schema";

export class UserRepository extends EventRepository<User> {

  constructor(mongoose: MongooseNamespace) {
    super(mongoose, 'User', UserSchema)
  }
}