import { trimmedString } from "@random-guys/bucket";
import { PatcheableSchema } from "../../src/";

export const UserSchema = PatcheableSchema({
  fullname: { ...trimmedString, required: true, index: true },
  email_address: { ...trimmedString, required: true, unique: true }
})