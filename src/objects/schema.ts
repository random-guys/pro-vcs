import { timestamps, trimmedLowercaseString, trimmedString, uuid } from "@random-guys/bucket";
import values from "lodash/values";
import { Schema, SchemaDefinition, SchemaOptions, SchemaTypes } from "mongoose";
import { mapperConfig } from "../schema";
import { ObjectModel, ObjectState, PayloadModel } from "./model";

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
 * `ObjectSchema` creates a mongoose schema that can store an `EventModel`. This is the where
 * the implementation of `toObject`,`toJSON` and `asObject` is created.
 * @param payloadSchema schema of the wrapped `PayloadModel`
 * @param exclude properties to exclude from the result of toJSON
 * @param options other schema options
 */
export class ObjectSchema<T extends PayloadModel> {
  /**
   * the schema created by `ObjectSchema` and to be used by mongoose
   */
  readonly schema: Schema;
  constructor(payloadSchema: SchemaDefinition, exclude: string[] = [], options?: SchemaOptions) {
    // make sure to remove any trace of metadata
    const objectMapper = mapperConfig(["__owner", "__patch"]);
    const jsonMapper = mapperConfig<ObjectModel<T>>(["__owner", "__patch", ...exclude]);

    this.schema = new Schema(
      {
        _id: uuid,
        ...MetadateSchema,
        ...payloadSchema
      },
      {
        ...options,
        ...timestamps,
        toJSON: jsonMapper,
        toObject: objectMapper,
        selectPopulatedPaths: false
      }
    );
  }
}
