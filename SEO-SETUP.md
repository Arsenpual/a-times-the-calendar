# SEO Setup — ให้เว็บหาเจอใน Google Search ได้

ทำต่อจาก `DEPLOY.md` — ใช้ได้เลยตอนนี้ ไม่ต้องรอ Google อนุมัติอะไร (ต่างจากเรื่อง OAuth publish ที่ต้องรอ verification)

---

## ขั้นตอนที่ 1 — วางไฟล์ในตำแหน่งที่ถูกต้อง

ไฟล์ที่แนบมาให้ 4 ไฟล์ วางตามนี้:

```
frontend/
├── index.html          ← ทับของเดิม (เพิ่ม meta tags SEO)
└── public/
    ├── privacy.html     ← จากขั้นตอนก่อนหน้า (ถ้ายังไม่ได้วาง)
    ├── robots.txt       ← ใหม่
    └── sitemap.xml      ← ใหม่
```

ไฟล์ใน `public/` ทั้งหมดจะถูก Vite copy ไปที่ root ของเว็บตรงๆ ตอน build (ไม่ผ่าน bundler) — เข้าถึงได้ที่ `https://arsenpual.github.io/a-times-the-calendar/robots.txt` เป็นต้น

---

## ขั้นตอนที่ 2 — Push แล้วรอ deploy

```bash
git add frontend/index.html frontend/public/robots.txt frontend/public/sitemap.xml frontend/public/privacy.html
git commit -m "เพิ่ม SEO meta tags, robots.txt, sitemap.xml"
git push
```

รอ GitHub Actions build+deploy เสร็จ (เช็คแท็บ Actions เหมือนที่เคยทำ)

---

## ขั้นตอนที่ 3 — เช็คว่าไฟล์เข้าถึงได้จริง

เปิด URL เหล่านี้ในเบราว์เซอร์ ควรเห็นเนื้อหาไฟล์ตรงๆ ไม่ใช่หน้า 404:

- `https://arsenpual.github.io/a-times-the-calendar/robots.txt`
- `https://arsenpual.github.io/a-times-the-calendar/sitemap.xml`

---

## ขั้นตอนที่ 4 — Submit เข้า Google Search Console (เร่งให้ Google เจอเร็วขึ้น)

ถ้าไม่ทำขั้นตอนนี้ Google ก็ยัง**มีโอกาส**เจอเว็บได้เองตามธรรมชาติในที่สุด (ผ่าน `robots.txt`/`sitemap.xml` ที่เพิ่งทำ) แต่อาจใช้เวลาหลายสัปดาห์ถึงหลายเดือนกว่าจะเริ่ม crawl เอง ทำขั้นตอนนี้เพื่อร่นเวลาให้เหลือแค่ไม่กี่วัน:

1. ไปที่ [Google Search Console](https://search.google.com/search-console)
2. Login ด้วยบัญชี Google เดียวกับที่ใช้จัดการ Firebase/GitHub ก็ได้ (ไม่จำเป็นต้องตรงกัน)
3. กด **Add Property** → เลือกประเภท **URL prefix** → ใส่ `https://arsenpual.github.io/a-times-the-calendar/`
4. ยืนยันความเป็นเจ้าของเว็บ — วิธีที่ง่ายที่สุดสำหรับ GitHub Pages คือ **HTML tag method**:
   - Search Console จะให้ meta tag มา 1 บรรทัด (เช่น `<meta name="google-site-verification" content="xxxxx" />`)
   - เอา tag นั้นไปแปะใน `frontend/index.html` ก่อน `</head>`
   - push ขึ้นใหม่ รอ deploy เสร็จ แล้วกด **Verify** ใน Search Console
5. หลังยืนยันสำเร็จ ไปที่เมนู **Sitemaps** (แถบซ้าย) → ใส่ `sitemap.xml` → กด **Submit**
6. ไปที่ **URL Inspection** (แถบซ้ายบน) → ใส่ URL หน้าแรกของเว็บ → กด **Request Indexing** เพื่อขอให้ Google เข้ามา crawl ทันที ไม่ต้องรอคิวปกติ

---

## ขั้นตอนที่ 5 — ตรวจสอบว่าเจอจริงหรือยัง

Google อาจใช้เวลา **2-14 วัน** หลัง submit ถึงจะเริ่มขึ้นผลการค้นหาจริง (ไม่ใช่ทันที) เช็คสถานะได้ 2 ทาง:

- ใน Search Console → เมนู **Pages** ดูว่า URL ถูก "Indexed" แล้วหรือยัง
- ค้นหาตรงๆ ใน Google ด้วย `site:arsenpual.github.io` — ถ้าขึ้นผลลัพธ์มา แปลว่า index แล้ว

---

## หมายเหตุสำคัญ — เรื่องนี้แยกจากการ "login ได้" โดยสิ้นเชิง

ทำครบตามนี้แล้ว **ใครก็เจอเว็บใน Google Search ได้จริง** และเปิดเข้าหน้าแรกได้ปกติ — แต่การ**ล็อกอินใช้งานแอปจริง**ยังต้องรอ **Publish OAuth consent screen** ให้ผ่านตามที่คุยกันไว้ก่อนหน้า (ต้องมี Privacy Policy พร้อมแล้ว ตอนนี้เสร็จไปหนึ่งเงื่อนไขแล้ว) สองเรื่องนี้ทำคู่ขนานกันได้ ไม่ต้องรอกัน
