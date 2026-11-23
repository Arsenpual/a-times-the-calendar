# Calendar connection

ดูแล UI แจ้งเตือนสถานะการเชื่อมต่อและการต่ออายุสิทธิ์ Google Calendar:

- `components/calendar-connection-overlays.jsx`: แบนเนอร์แจ้งสถานะกำลังตรวจสอบสิทธิ์ และหน้าต่างเตือนเมื่อ token ใกล้หมดอายุหรือต้องยืนยันตัวตนใหม่
- `styles/calendar-connection.css`: สไตล์ของ token expiry prompt
- ตัว HTTP/OAuth client ที่ทุกฟีเจอร์ใช้ร่วมกันอยู่ที่ `src/shared/api/google-calendar.js`
