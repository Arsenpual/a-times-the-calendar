import { useEffect, useState } from "react";
import { beginTelegramConnection, getTelegramStatus } from "../../notifications/telegram/api.js";
import {
  areTelegramNotificationsEnabled,
  setTelegramNotificationsEnabled
} from "../../notifications/telegram/telegram-notification-preferences.js";

const EMPTY_CONNECTION = {
  isConnected: false,
  isLoading: false,
  statusMessage: "",
  linkExpiresAt: null
};

export function useTelegramConnection(firebaseUser) {
  const [telegramConnection, setTelegramConnection] = useState(EMPTY_CONNECTION);
  const [areTelegramAlertsEnabled, setAreTelegramAlertsEnabled] = useState(() => (
    areTelegramNotificationsEnabled(firebaseUser?.uid)
  ));

  useEffect(() => {
    if (!firebaseUser) {
      setTelegramConnection(EMPTY_CONNECTION);
      return;
    }
    getTelegramStatus()
      .then(({ connected }) => setTelegramConnection((previous) => ({ ...previous, isConnected: connected })))
      .catch(() => {});
  }, [firebaseUser]);

  useEffect(() => {
    setAreTelegramAlertsEnabled(areTelegramNotificationsEnabled(firebaseUser?.uid));
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!firebaseUser || telegramConnection.isConnected || !telegramConnection.linkExpiresAt) return undefined;

    const checkConnection = async () => {
      if (Date.now() >= telegramConnection.linkExpiresAt) {
        setTelegramConnection((previous) => ({
          ...previous,
          linkExpiresAt: null,
          statusMessage: "ลิงก์เชื่อมต่อหมดอายุแล้ว — กดปุ่ม Telegram เพื่อลองใหม่"
        }));
        return;
      }
      try {
        const { connected } = await getTelegramStatus();
        if (connected) {
          setTelegramConnection({
            isConnected: true,
            isLoading: false,
            statusMessage: "เชื่อม Telegram สำเร็จแล้ว ✓",
            linkExpiresAt: null
          });
        }
      } catch {
        // Render may be waking up; retain the active connection link.
      }
    };

    checkConnection();
    const intervalId = window.setInterval(checkConnection, 3_000);
    return () => window.clearInterval(intervalId);
  }, [firebaseUser, telegramConnection.isConnected, telegramConnection.linkExpiresAt]);

  const handleTelegramConnection = async () => {
    const telegramDesktopWindow = window.open("about:blank", "_blank");
    try {
      setTelegramConnection((previous) => ({ ...previous, isLoading: true, statusMessage: "" }));
      const { connectUrl, appConnectUrl, expiresAt } = await beginTelegramConnection();
      const telegramDestination = appConnectUrl || connectUrl;
      if (telegramDesktopWindow) telegramDesktopWindow.location.replace(telegramDestination);
      else window.location.assign(telegramDestination);
      setTelegramConnection((previous) => ({
        ...previous,
        isLoading: false,
        linkExpiresAt: expiresAt || null,
        statusMessage: "เปิด Telegram แล้ว — กด Start ในแชตกับ MR.Zettascale เพื่อเชื่อมต่อ"
      }));
    } catch (error) {
      telegramDesktopWindow?.close();
      setTelegramConnection((previous) => ({ ...previous, isLoading: false, statusMessage: error.message }));
    }
  };

  const handleTelegramAlertToggle = () => {
    if (!telegramConnection.isConnected) {
      handleTelegramConnection();
      return;
    }
    const nextEnabled = !areTelegramAlertsEnabled;
    const question = nextEnabled
      ? "ต้องการเปิดการแจ้งเตือนผ่าน Telegram อีกครั้งใช่ไหม?"
      : "ต้องการปิดการแจ้งเตือนผ่าน Telegram บนอุปกรณ์นี้ใช่ไหม?";
    if (!window.confirm(question)) return;

    setTelegramNotificationsEnabled(firebaseUser?.uid, nextEnabled);
    setAreTelegramAlertsEnabled(nextEnabled);
    setTelegramConnection((previous) => ({
      ...previous,
      statusMessage: nextEnabled
        ? "เปิดการแจ้งเตือนผ่าน Telegram แล้ว"
        : "ปิดการแจ้งเตือนผ่าน Telegram บนอุปกรณ์นี้แล้ว"
    }));
  };

  return {
    telegramConnection,
    areTelegramAlertsEnabled,
    handleTelegramAlertToggle,
    dismissTelegramStatus: () => setTelegramConnection((previous) => ({
      ...previous, statusMessage: "", linkExpiresAt: null
    }))
  };
}
