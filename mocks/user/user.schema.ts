import { trimmedString } from "@random-guys/bucket";
import { SchemaDefinition } from "mongoose";

export const UserSchema: SchemaDefinition = {
  fullname: { ...trimmedString, required: true, index: true },
  email_address: { ...trimmedString, required: true, unique: true }
}