import { SchemaFactory, trimmedString, trimmedLowercaseString } from "@random-guys/bucket";
import { SchemaTypes, SchemaDefinition, SchemaOptions } from "mongoose";

export const PatchSchema = SchemaFactory({
  reference: { ...trimmedString, required: true, index: true },
  document_type: { ...trimmedLowercaseString, required: true, index: true },
  owner: { ...trimmedString, required: true, index: true },
  patchType: {
    ...trimmedString,
    required: true,
    enum: ['create', 'update', 'delete']
  },
  payload: { type: SchemaTypes.Mixed, default: null }
})

export const PatcheableSchema = (
  schema: SchemaDefinition,
  options?: SchemaOptions,
  autoIndex?: boolean
) => {
  return SchemaFactory({
    ...schema,
    frozen: {
      type: SchemaTypes.Boolean,
      required: true,
      default: false
    }
  },
    options,
    autoIndex
  )
}