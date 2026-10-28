import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:800}});
  await page.goto(server.resolvedUrls.local[0]+'tests/fixtures/popup-layer.html');
  const region = page.locator('.popup-layer__region--top-right');
  const first = region.locator('.popup-layer__item').filter({hasText:'แจ้งเตือนแรก'});
  assert.equal(await region.getByRole('button',{name:'ปิดข้อความแจ้งเตือน'}).count(),2);
  await first.getByRole('button',{name:'ลองอีกครั้ง'}).click();
  assert.match(await first.textContent(),/1/);
  await first.getByRole('button',{name:'ปิดข้อความแจ้งเตือน'}).click();
  assert.equal(await region.locator('.popup-layer__item').count(),1);
  await page.getByRole('button',{name:'อัปเดตหน้า'}).click();
  assert.equal(await first.count(),0,'dismissed notification stays closed on rerender');
  await page.getByRole('button',{name:'สลับแจ้งเตือน'}).click();
  await page.getByRole('button',{name:'สลับแจ้งเตือน'}).click();
  await first.waitFor();
  const left = page.locator('.popup-layer__region--top-left');
  await left.getByRole('button',{name:'ปิดข้อความแจ้งเตือน'}).click();
  assert.equal(await left.count(),0);
  assert.equal(await region.getByRole('button',{name:'ปิดข้อความแจ้งเตือน'}).count(),2);
  assert.equal(await page.locator('.popup-layer__region--bottom-right .popup-layer__close').count(),0);
  assert.equal(await region.getByRole('button',{name:'ปิดข้อความแจ้งเตือน'}).count(),2);
  console.log('PASS: independently dismiss top-right messages, preserve actions, and restore on a new occurrence');
} finally { await browser.close(); await server.close(); }
