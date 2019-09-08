import {
  timestamps,
  trimmedLowercaseString,
  trimmedString,
  uuid
} from '@random-guys/bucket';
import { Schema, SchemaDefinition, SchemaOptions, SchemaTypes } from 'mongoose';
import { EventModel, EventType, Stage, PayloadModel } from './event.model';
import { mapperConfig } from './schema.util';

const eventVirtuals = {
  frozen<T extends PayloadModel>(schema: Schema) {
    schema.virtual('frozen').get(function(this: EventModel<T>) {
      return this.metadata.frozen;
    });
  },
  id<T extends PayloadModel>(schema: Schema) {
    schema.virtual('id').get(function(this: EventModel<T>) {
      return this.metadata.reference;
    });
  }
};

export const MetadateSchema: SchemaDefinition = {
  reference: { ...uuid, index: true },
  owner: { ...trimmedString, required: true, index: true },
  frozen: { type: SchemaTypes.Boolean, default: true },
  stage: {
    ...trimmedLowercaseString,
    required: true,
    enum: Object.keys(Stage)
  },
  eventType: {
    ...trimmedLowercaseString,
    required: true,
    enum: Object.keys(EventType)
  }
};

export const EventSchema = <T extends PayloadModel>(
  exclude: string[] = [],
  options?: SchemaOptions
) => {
  // make sure to remove any trace of metadata
  const mapper = mapperConfig<EventModel<T>>(exclude, data => {
    const payload: any = data.payload || {};
    payload.id = data.metadata.reference;
    payload.frozen = data.metadata.frozen;
    payload.created_at = data.created_at;
    payload.updated_at = data.updated_at;
    return payload;
  });

  const schema = new Schema(
    {
      _id: uuid,
      metadata: MetadateSchema,
      payload: { type: SchemaTypes.Mixed, default: null }
    },
    {
      ...options,
      ...timestamps,
      toJSON: mapper,
      toObject: mapper,
      id: false, // disable this, we don't need it
      selectPopulatedPaths: false
    }
  );

  // enable payload virtuals
  eventVirtuals.id(schema);
  eventVirtuals.frozen(schema);

  return schema;
};
