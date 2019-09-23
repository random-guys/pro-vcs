import {
  timestamps,
  trimmedLowercaseString,
  trimmedString,
  uuid
} from '@random-guys/bucket';
import { Schema, SchemaDefinition, SchemaOptions, SchemaTypes } from 'mongoose';
import { EventModel, ObjectState, PayloadModel } from './event.model';
import { mapperConfig } from './schema.util';

const eventVirtuals = {
  state<T extends PayloadModel>(schema: Schema) {
    schema.virtual('object_state').get(function(this: EventModel<T>) {
      return this.metadata.object_state;
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
  owner: { ...trimmedString, index: true },
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
  const mapper = mapperConfig<EventModel<T>>(exclude, data => {
    const payload = data.payload;
    payload._raw_id = data._id;
    payload.id = data.metadata.reference;
    payload.object_state = data.metadata.object_state;
    payload.created_at = data.created_at;
    payload.updated_at = data.updated_at;
    return payload;
  });

  const schema = new Schema(
    {
      _id: uuid,
      metadata: MetadateSchema,
      payload: payloadSchema
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
  eventVirtuals.state(schema);

  return schema;
};
