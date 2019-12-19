import {
  timestamps,
  trimmedLowercaseString,
  trimmedString,
  uuid
} from "@random-guys/bucket";
import { Schema, SchemaDefinition, SchemaOptions, SchemaTypes } from "mongoose";
import { mapperConfig } from "../schema";
import { ObjectModel, ObjectState, PayloadModel } from "./model";
import values from "lodash/values";

const MetadateSchema: SchemaDefinition = {
  __owner: { ...trimmedString, index: true },
  __patch: { type: SchemaTypes.Mixed, default: null },
  object_state: {
    ...trimmedLowercaseString,
    required: true,
    enum: values(ObjectState)
  }
};

/**
 * `EventSchema` creates a mongoose schema that can store an `EventModel`. This is the where
 * the implementation of `toObject`,`toJSON` and `asObject` is created.
 * @param payloadSchema schema of the wrapped `PayloadModel`
 * @param exclude properties to exclude when export using `asObject` or `toJSON`
 * @param options other schema options
 */
export const ObjectSchema = <T extends PayloadModel>(
  payloadSchema: SchemaDefinition,
  exclude: string[] = [],
  options?: SchemaOptions
) => {
  // make sure to remove any trace of metadata
  exclude.push("__owner", "__patch");
  const mapper = mapperConfig<ObjectModel<T>>(exclude);

  const schema = new Schema(
    {
      _id: uuid,
      ...MetadateSchema,
      ...payloadSchema
    },
    {
      ...options,
      ...timestamps,
      toJSON: mapper,
      toObject: mapper,
      selectPopulatedPaths: false
    }
  );

  return schema;
};
