import amqp from "amqplib";

export async function connect() {
  return amqp.connect(`${process.env.AMQP_URL}?heartbeat=60`);
}
