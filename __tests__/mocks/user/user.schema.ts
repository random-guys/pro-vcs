import { SchemaDefinition } from "mongoose";
import { trimmedString } from "@random-guys/bucket";
import { ObjectSchema } from "../../../src/objects/schema";

const UserSchemaDef: SchemaDefinition = {
  full_name: { ...trimmedString, required: true },
  email_address: { ...trimmedString, required: true },
  password_hash: { ...trimmedString }
};

export const UserSchema = new ObjectSchema(UserSchemaDef, ["password_hash"]);
UserSchema.schema.index({ email_address: 1, full_name: 1 }, { unique: true });
