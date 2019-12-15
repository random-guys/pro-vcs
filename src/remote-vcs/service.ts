import { publisher } from "@random-guys/eventbus";
import kebabCase from "lodash/kebabCase";
import { ObjectModel, PayloadModel } from "../objects";
import {
  CloseEvent,
  DeleteObjectEvent,
  NewObjectEvent,
  PatchEvent,
  UpdateObjectEvent
} from "./event-types";

export class RemoteClient<T extends PayloadModel> {
  async newObjectEvent(newObject: ObjectModel<T>) {
    const event: NewObjectEvent<T> = {
      event_type: "create.new",
      reference: newObject.id,
      owner: newObject.__owner,
      payload: newObject.toObject()
    };
    return await publisher.queue(RemoteClient.queue, event);
  }

  async updateObjectEvent(freshObject: ObjectModel<T>, update: Partial<T>) {
    const event: UpdateObjectEvent<T> = {
      event_scope: this.name,
      event_type: "create.update",
      reference: freshObject.id,
      owner: freshObject.__owner,
      payload: freshObject.toObject(),
      update
    };
    return await publisher.queue(RemoteClient.queue, event);
  }

  async deleteObjectEvent(objectToDelete: ObjectModel<T>) {
    const event: DeleteObjectEvent<T> = {
      event_scope: this.name,
      event_type: "create.delete",
      reference: objectToDelete.id,
      owner: objectToDelete.__owner,
      payload: objectToDelete.toObject()
    };
    return await publisher.queue(RemoteClient.queue, event);
  }

  async patch(reference: string, payload: ObjectModel<T>) {
    const event: PatchEvent<T> = {
      event_scope: this.name,
      event_type: "patch",
      reference: reference,
      payload: payload.toObject()
    };
    return await publisher.queue(RemoteClient.queue, event);
  }

  async close(reference: string) {
    const event: CloseEvent = {
      event_scope: this.name,
      event_type: "close",
      reference
    };
    return await publisher.queue(RemoteClient.queue, event);
  }
}
