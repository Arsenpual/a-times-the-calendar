function connectionFailedBeforeSend(error) {
  if (!error) return false;
  if (Array.isArray(error.errors) && error.errors.length) return error.errors.every(connectionFailedBeforeSend);
  if (error.cause) return connectionFailedBeforeSend(error.cause);
  if (error.code === "UND_ERR_CONNECT_TIMEOUT") return true;
  return error.syscall === "connect" && ["ETIMEDOUT", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH"].includes(error.code);
}

// Retry only failed connections: an HTTP request has not been sent yet.
// Aborted requests, reset sockets, response-body errors, and HTTP errors can
// occur after Telegram accepted a message, so they must not be replayed here.
async function telegramFetch(url, options = {}, { fetchImpl = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const operation = new URL(url).pathname.split("/").pop();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetchImpl(url, { ...options, signal: options.signal || AbortSignal.timeout(20_000) });
    } catch (error) {
      if (attempt === 0 && !options.signal?.aborted && connectionFailedBeforeSend(error)) {
        console.warn(`[telegram] ${operation}: connection failed before sending; retrying once`);
        await wait(300);
        continue;
      }
      const rawCode = error?.cause?.code || error?.code || error?.name || "NETWORK_ERROR";
      const code = /^[A-Za-z0-9_]+$/.test(rawCode) ? rawCode : "NETWORK_ERROR";
      // Never carry fetch's raw cause: a Telegram URL contains the bot token.
      const failure = new Error(`Telegram ${operation}: เชื่อมต่อไม่สำเร็จ (${code})`);
      failure.status = 503;
      failure.code = code;
      failure.service = "telegram";
      failure.operation = operation;
      throw failure;
    }
  }
}

module.exports = { telegramFetch };
