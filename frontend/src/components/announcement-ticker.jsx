import React from "react";

export default function AnnouncementTicker({ message }) {
  // ถ้าไม่มีข้อความหรือข้อความว่าง ไม่ต้องแสดงอะไร
  if (!message) return null;

  return (
    <div className="announcement-ticker">
      <div className="ticker-content">
        {message}
      </div>
    </div>
  );
}
