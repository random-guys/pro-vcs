import { sign } from "jsonwebtoken";

/**
 * Promise capable version of `jsonwebtoken.sign`
 * @param secret secret to use to sign
 * @param data data to be signed
 */
export function encode(secret: string, data: any) {
  return new Promise<string>((resolve, reject) => {
    sign({ claim: data }, secret, {}, (err, encoded) => {
      if (err) return reject(err);
      resolve(encoded);
    });
  });
}
