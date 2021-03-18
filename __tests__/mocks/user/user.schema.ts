import { trimmedString } from "@random-guys/bucket";
import { SchemaDefinition } from "mongoose";

import { ObjectSchema } from "../../../src/";
import { User } from "./user.model";

const UserSchemaDef: SchemaDefinition = {
  full_name: { ...trimmedString, required: true },
  email_address: { ...trimmedString, required: true },
  password_hash: { ...trimmedString }
};

export const UserSchema = new ObjectSchema<User>(UserSchemaDef, ["password_hash"]);
UserSchema.mongooseSchema.index({ email_address: 1, full_name: 1 }, { unique: true });
