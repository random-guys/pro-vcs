import { PayloadModel } from "../../../src/objects";

export interface User extends PayloadModel {
  full_name: string;
  email_address: string;
}
