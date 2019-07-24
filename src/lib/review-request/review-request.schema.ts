import { SchemaFactory, trimmedString, trimmedLowercaseString } from "@random-guys/bucket";
import { SchemaTypes, SchemaDefinition, SchemaOptions } from "mongoose";

export const ReviewRequestSchema = SchemaFactory({
  reference: { ...trimmedString, required: true, index: true },
  document_type: { ...trimmedLowercaseString, required: true, index: true },
  creator: { ...trimmedString, required: true, index: true },
  diffs: { type: SchemaTypes.Mixed, required: true }
})

export const ReviewableSchema = (
  schema: SchemaDefinition,
  options?: SchemaOptions,
  autoIndex?: boolean
) => {
  return SchemaFactory({
    ...schema,
    staged: {
      type: SchemaTypes.Boolean,
      required: true,
      default: false
    }
  },
    options,
    autoIndex
  )
}