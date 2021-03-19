/**
 * Generate multiple version using a mock data function.
 * @param n number of values to generate
 * @param fn mock data function
 */
export function multiply<T>(n: number, fn: () => T): T[] {
  const results: T[] = [];

  for (let i = 0; i < n; i++) {
    results.push(fn());
  }

  return results;
}

/**
 * Run this function after `duration` wrapping the entire delay
 * in a promise. This is useful for testing workers as it would
 * take some time to send and receive messages, as well as an
 * event queue break to handle the message
 * @param fn function to run tests or anything you want...do your
 * worst
 */
export function delayed(fn: () => Promise<void>, duration = 500) {
  return new Promise(resolve => {
    setTimeout(async () => {
      await fn();
      resolve(true);
    }, duration);
  });
}

export function timeout(duration = 500) {
  return delayed(() => Promise.resolve(), duration);
}
