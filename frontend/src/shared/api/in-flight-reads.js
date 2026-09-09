// Share concurrent reads only; resolved values are never cached.
export function createInFlightReads() {
  const pending = new Map();
  return {
    clear() { pending.clear(); },
    get(key, load) {
      if (pending.has(key)) return pending.get(key);
      const request = Promise.resolve().then(load);
      pending.set(key, request);
      const cleanup = () => {
        if (pending.get(key) === request) pending.delete(key);
      };
      request.then(cleanup, cleanup);
      return request;
    }
  };
}
