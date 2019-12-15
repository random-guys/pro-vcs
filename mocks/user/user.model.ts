import { PayloadModel } from "../../src/objects";

export interface User extends PayloadModel {
  fullname: string;
  email_address: string;
}
