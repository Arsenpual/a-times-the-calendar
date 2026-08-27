const crypto = require("crypto");
const { calendarAuthDoc } = require("./firestore-db.js");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const STATE_TTL_MS = 10 * 60 * 1000;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`ไม่พบ ${name} ใน environment ของ backend`);
  return value;
}

function getEncryptionKey() {
  const value = requiredEnv("CALENDAR_TOKEN_ENCRYPTION_KEY");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY ต้องเป็น base64 ของ key 32 bytes");
  return key;
}

function encrypt(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64") };
}

function decrypt(record) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", requiredEnv("GOOGLE_OAUTH_STATE_SECRET")).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyState(state) {
  const [body, signature] = String(state || "").split(".");
  if (!body || !signature) throw new Error("OAuth state ไม่ถูกต้อง");
  const expected = crypto.createHmac("sha256", requiredEnv("GOOGLE_OAUTH_STATE_SECRET")).update(body).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("OAuth state ไม่ถูกต้อง");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.uid || !payload.exp || Date.now() > payload.exp) throw new Error("OAuth state หมดอายุ");
  return payload;
}

function createAuthorizationUrl(userId) {
  const redirectUri = requiredEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const state = signState({ uid: userId, exp: Date.now() + STATE_TTL_MS, nonce: crypto.randomUUID() });
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
      grant_type: "authorization_code"
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Google OAuth แลก code ไม่สำเร็จ: ${data.error || response.status}`);
  return data;
}

async function storeRefreshToken(userId, tokenResponse) {
  const ref = calendarAuthDoc(userId);
  const previous = await ref.get();
  const refreshToken = tokenResponse.refresh_token || previous.data()?.refreshToken;
  if (!refreshToken) throw new Error("Google ไม่ส่ง refresh token กลับมา — กรุณาอนุญาตสิทธิ์อีกครั้ง");
  const encrypted = tokenResponse.refresh_token ? encrypt(refreshToken) : previous.data().refreshToken;
  await ref.set({
    refreshToken: encrypted,
    connectedAt: new Date().toISOString(),
    status: "connected",
    scope: tokenResponse.scope || CALENDAR_SCOPE,
    tokenType: tokenResponse.token_type || "Bearer",
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

class CalendarReauthRequiredError extends Error {
  constructor() {
    super("สิทธิ์ Google Calendar ใช้งานไม่ได้แล้ว กรุณาเชื่อมต่อใหม่");
    this.code = "CALENDAR_REAUTH_REQUIRED";
  }
}

async function getFreshAccessToken(userId) {
  const ref = calendarAuthDoc(userId);
  const snapshot = await ref.get();
  const record = snapshot.data();
  if (!record?.refreshToken || record.status !== "connected") throw new CalendarReauthRequiredError();

  let refreshToken;
  try { refreshToken = decrypt(record.refreshToken); } catch { throw new CalendarReauthRequiredError(); }
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    await ref.set({ status: "needs_reauth", updatedAt: new Date().toISOString() }, { merge: true });
    throw new CalendarReauthRequiredError();
  }
  return data.access_token;
}

async function connectionStatus(userId) {
  const data = (await calendarAuthDoc(userId).get()).data();
  return { connected: data?.status === "connected", needsReauth: data?.status === "needs_reauth" };
}

module.exports = { createAuthorizationUrl, verifyState, exchangeCode, storeRefreshToken, getFreshAccessToken, connectionStatus, CalendarReauthRequiredError };
