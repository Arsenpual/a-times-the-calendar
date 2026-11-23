import { PopupLayerItem } from "../../../shared/ui/popup-layer.jsx";

export default function TelegramConnectionToast({ telegramConnection, onClose }) {
return (<>
      {telegramConnection.statusMessage && (
        <PopupLayerItem id="telegram-connection-status" region="bottom-right" priority={40} className="reminder-popup-surface"><div className={`telegram-connection-toast${telegramConnection.isConnected ? " is-connected" : ""}`} role="status">
          <span className="telegram-connection-toast-icon" aria-hidden="true">{telegramConnection.isConnected ? "✓" : "✈"}</span>
          <div>
            <strong>Telegram</strong>
            <p>{telegramConnection.statusMessage}</p>
            {!telegramConnection.isConnected && telegramConnection.linkExpiresAt && <small>หน้าต่างนี้จะยืนยันการเชื่อมต่อให้อัตโนมัติ</small>}
          </div>
          <button
            type="button"
            className="telegram-connection-toast-close"
            aria-label="ปิดข้อความ Telegram"
            onClick={onClose}
          >×</button>
        </div></PopupLayerItem>
      )}


</>);
}
