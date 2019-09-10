import { SchemaDefinition } from 'mongoose';
import { trimmedString } from '@random-guys/bucket';

export const UserSchema: SchemaDefinition = {
  fullname: { ...trimmedString, required: true },
  email_address: { ...trimmedString, required: true }
};
