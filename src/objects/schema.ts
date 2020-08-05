import { timestamps, trimmedLowercaseString, trimmedString, uuid } from "@random-guys/bucket";
import { unset } from "lodash";
import values from "lodash/values";
import { Schema, SchemaDefinition, SchemaOptions, SchemaTypes } from "mongoose";
import uuidFn from "uuid/v4";
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

const defaultExclusionList = ["__owner", "__patch", "_id"];

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
  readonly mongooseSchema: Schema;
  constructor(payloadSchema: SchemaDefinition, private exclude: string[] = [], options?: SchemaOptions) {
    // remove metadata, but add toJSON to remove excluded properties
    const objectMapper = mapperConfig(defaultExclusionList, (data: T) => {
      data["toJSON"] = function () {
        const copy = { ...this };
        exclude.forEach(path => unset(copy, path));
        return copy;
      };
      return data;
    });

    // remove metadata and excluded properties
    const jsonMapper = mapperConfig<ObjectModel<T>>([...defaultExclusionList, ...exclude]);

    this.mongooseSchema = new Schema(
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

  /**
   * Direct implementation of Mongoose's toObject which converts a raw mongodb object
   * to a PayloadModel.
   * @param data raw mongodb data to be converted to a PayloadModel
   */
  toObject(data: any): T {
    // set default virtuals
    data.id = data._id;

    const exclusionList = this.exclude;
    data.toJSON = function () {
      const copy = { ...this };
      exclusionList.forEach(path => {
        unset(copy, path);
      });

      return copy;
    };

    defaultExclusionList.forEach(k => unset(data, k));

    return data;
  }
}
