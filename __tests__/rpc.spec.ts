import { Connection } from "amqplib";
import * as rabbitmq from "./utils/rabbitmq";
import { RPCService, RPCClient } from "../src";
import Logger from "bunyan";
import dotenv from "dotenv";

dotenv.config();

let connection: Connection;
let log: Logger;
let server: RPCService;
let client: RPCClient;

beforeAll(async () => {
  log = Logger.createLogger({ name: "test" });
  connection = await rabbitmq.connect();
  server = new RPCService("test", log);
  client = new RPCClient();

  await server.init(connection);
  await client.init(connection);
});

afterAll(async () => {
  if (connection) await connection.close();
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
    await server.addMethod("returnRequest", x => {
      return Promise.reject("TestError");
    });

    const resp = client.sendRequest("test", "returnRequest", "x");
    expect(resp).rejects.toMatch(/TestError/);
  });
});