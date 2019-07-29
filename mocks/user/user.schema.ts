import { trimmedString } from "@random-guys/bucket";
import { ReviewableSchema } from "../../src/";

export const UserSchema = ReviewableSchema({
  fullname: { ...trimmedString, required: true, index: true },
  email_address: { ...trimmedString, required: true, unique: true }
})