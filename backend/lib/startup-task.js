// Retry only the failed startup stage. A completed stage is never repeated
// because an independent Firestore migration is temporarily unavailable.
function startStartupTask(name, task, { schedule = setTimeout, logger = console } = {}) {
  const delays = [3_000, 10_000, 30_000, 60_000, 300_000];
  const run = async (attempt = 0) => {
    try { await task(); }
    catch (error) {
      const exhausted = String(error.code) === "8" || error.code === "RESOURCE_EXHAUSTED" || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(error.message || "");
      const delay = exhausted ? 300_000 : delays[Math.min(attempt, delays.length - 1)];
      logger.error(`[telegram] ${name} ไม่สำเร็จ (ครั้งที่ ${attempt + 1}):`, error.message);
      logger.log(`[telegram] จะลอง ${name} ใหม่ใน ${delay / 1000} วินาที`);
      const timer = schedule(() => run(attempt + 1), delay);
      timer.unref?.();
    }
  };
  return run();
}

module.exports = { startStartupTask };
