import { PayloadModel } from "../../../src";

export interface User extends PayloadModel {
  full_name: string;
  email_address: string;
}
