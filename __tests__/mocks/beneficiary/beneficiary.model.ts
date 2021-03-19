import { CustomPayloadModel } from "../../../src";

export interface Beneficiary extends CustomPayloadModel {
  account_number: string;
  account_name: string;
  bank_code: string;
}
