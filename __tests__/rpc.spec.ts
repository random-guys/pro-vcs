import { Connection } from "amqplib";
import { RPCService, RPCClient } from "../src";
import Logger from "bunyan";
import dotenv from "dotenv";
import { publisher } from "@random-guys/eventbus";

let connection: Connection;
let log: Logger;
let server: RPCService;
let client: RPCClient;

beforeAll(async () => {
  dotenv.config();

  log = Logger.createLogger({ name: "test" });
  await publisher.init(process.env.AMQP_URL);
  server = new RPCService("test", log);
  client = new RPCClient();

  await server.init(publisher.getConnection());
  await client.init(publisher.getConnection());
});

describe("RPC Communication", () => {
  it("should create a predictable queue name", async done => {
    const queue1 = await server.addMethod("beforeAll", x => {
      return null;
    });

    const queue2 = await server.addMethod("Before All", x => {
      return null;
    });

    expect(queue1).toBe("TEST_BEFORE_ALL");
    expect(queue2).toBe("TEST_BEFORE_ALL");

    done();
  });

  it("should send a request to the server", async () => {
    expect.assertions(1);

    await server.addMethod("requestOnly", x => {
      expect(x).toBe("x");
      return null;
    });

    await client.sendRequest("test", "requestOnly", "x");
  });

  it("should return a response to the client", async () => {
    await server.addMethod("returnRequest", x => {
      return Promise.resolve(x);
    });

    const res = await client.sendRequest("test", "returnRequest", "x");
    expect(res).toBe("x");
  });

  it("should throw an error when the server throws an error", async () => {
    await server.addMethod("rejectRequest", x => {
      return Promise.reject("TestError");
    });

    const resp = client.sendRequest("test", "rejectRequest", "x");
    expect(resp).rejects.toMatch(/TestError/);
  });
});
