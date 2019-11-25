import {
  timestamps,
  trimmedLowercaseString,
  trimmedString,
  uuid
} from "@random-guys/bucket";
import { Schema, SchemaDefinition, SchemaOptions, SchemaTypes } from "mongoose";
import { EventModel, ObjectState, PayloadModel } from "./event.model";
import { mapperConfig } from "./schema.util";

export const MetadateSchema: SchemaDefinition = {
  __owner: { ...trimmedString, index: true },
  __patch: { type: SchemaTypes.Mixed, default: null },
  object_state: {
    ...trimmedLowercaseString,
    required: true,
    enum: Object.keys(ObjectState)
  }
};

export const EventSchema = <T extends PayloadModel>(
  payloadSchema: SchemaDefinition,
  exclude: string[] = [],
  options?: SchemaOptions
) => {
  // make sure to remove any trace of metadata
  exclude.push("__owner", "__patch");
  const mapper = mapperConfig<EventModel<T>>(exclude);

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
