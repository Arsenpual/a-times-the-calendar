# แผนการดำเนินงาน: เปลี่ยน URL GitHub Pages เป็น Custom Domain (t.com)

## ภาพรวมโปรเจกต์
- **URL ปัจจุบัน:** `https://arsenpual.github.io/a-times-the-calendar/`
- **เป้าหมาย:** `https://t.com` (หรือ `https://www.t.com`)
- ** repository:** `a-times-the-calendar`

---

## ระยะที่ 1: การเตรียมการและจดโดเมน (Preparation & Registration)
- [ ] ซื้อ/จดทะเบียนชื่อโดเมน `t.com` ผ่านผู้ให้บริการ (Domain Registrar) เช่น Cloudflare, Namecheap, GoDaddy
- [ ] ตรวจสอบว่าสามารถเข้าถึงหน้าจัดการ **DNS Management Panel** ของโดเมนได้

---

## ระยะที่ 2: การตั้งค่า DNS Records (DNS Configuration)
เข้าหน้าจัดการ DNS ของผู้ให้บริการโดเมน แล้วเพิ่ม Record ดังนี้:

### 1. Apex Domain Records (A Records)
สร้าง **A Record** 4 ค่าเพื่อชี้ไปยัง IP ของ GitHub Pages:

| Type | Host / Name | Target IP Value | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `185.199.108.153` | Auto / 300s |
| **A** | `@` | `185.199.109.153` | Auto / 300s |
| **A** | `@` | `185.199.110.153` | Auto / 300s |
| **A** | `@` | `185.199.111.153` | Auto / 300s |

### 2. Subdomain Record (CNAME Record)
สร้าง **CNAME Record** เพื่อให้รองรับ `www`:

| Type | Host / Name | Target Value | TTL |
| :--- | :--- | :--- | :--- |
| **CNAME** | `www` | `arsenpual.github.io` | Auto / 300s |

---

## ระยะที่ 3: การตั้งค่าบน GitHub Repository
- [ ] เข้าไปที่ GitHub Repository `a-times-the-calendar`
- [ ] ไปที่เมนู **Settings** > **Pages**
- [ ] ในช่อง **Custom domain** พิมพ์ `t.com`
- [ ] กด **Save**
- [ ] ตรวจสอบว่ามีไฟล์ `CNAME` ถูกสร้างขึ้นใน Root Directory ของโปรเจกต์

---

## ระยะที่ 4: การตรวจสอบ DNS และเปิดใช้งาน HTTPS
- [ ] รอให้ระบบ DNS อัปเดตข้อมูล (ปกติใช้เวลา 5 - 30 นาที)
- [ ] กลับมาที่ **GitHub Settings > Pages**
- [ ] ติ๊กเลือก **Enforce HTTPS** เพื่อเปิดใช้งาน SSL Certificate (ความปลอดภัย HTTPS)

---

## ระยะที่ 5: การทดสอบหลังเปิดใช้งาน (Post-Launch Verification)
- [ ] ทดสอบเข้าเว็บผ่าน `http://t.com` (ต้อง Redirect ไปที่ `https://t.com`)
- [ ] ทดสอบเข้าเว็บผ่าน `https://www.t.com`
- [ ] ตรวจสอบการโหลดไฟล์ CSS, JS, Images และ Path ต่างๆ ภายในแอปพลิเคชันว่าสามารถทำงานได้ปกติ