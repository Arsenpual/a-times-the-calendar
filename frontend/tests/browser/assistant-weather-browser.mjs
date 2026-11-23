import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const server = await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{port:0},logLevel:'error'});
await server.listen();
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'tests/fixtures/app-taskbar.html');
  await page.locator('.app-title').waitFor();
  await page.locator('#app-navigation-toggle').click();
  await page.getByRole('navigation',{name:'ฟีเจอร์หลัก'}).getByRole('button',{name:/เปิด AI Mode/}).click();
  const ai=page.getByRole('region',{name:'AI Mode MR.Zettascale'});
  const rail=ai.getByRole('complementary',{name:'แผงงาน AI'});
  assert.equal(await rail.locator('.activity-ai-weather-tool').count(),0,'weather planning tool is removed from the work rail');
  assert.equal(await rail.getByRole('button',{name:'ดูอากาศและช่วงแนะนำ'}).count(),0);
  assert.equal(await page.evaluate(()=>window.lastWeatherRequest),undefined,'opening AI Mode does not request weather');
  await rail.getByRole('button',{name:'สร้างกิจกรรมในแผงงาน'}).click();
  assert.equal(await rail.getByRole('list',{name:'ขั้นตอนสร้างกิจกรรม'}).isVisible(),true,'activity creation remains available');
  assert.deepEqual(errors,[]);
  console.log('PASS: weather planning tool is absent while activity creation remains available');
} finally {await browser.close();await server.close();}
