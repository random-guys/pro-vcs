import { PayloadModel } from '../../src/event.model';

export interface User extends PayloadModel {
  fullname: string;
  email_address: string;
}
