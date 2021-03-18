import { trimmedString } from "@random-guys/bucket";
import { SchemaDefinition } from "mongoose";

export const BeneficiarySchemaDef: SchemaDefinition = {
  account_name: { ...trimmedString, required: true },
  account_number: { ...trimmedString, required: true },
  bank_code: { ...trimmedString, required: true }
};
