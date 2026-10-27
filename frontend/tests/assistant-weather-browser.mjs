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
  const tool=ai.getByRole('complementary',{name:'แผงงาน AI'}).getByRole('region',{name:'อากาศกับกิจกรรม'});
  await tool.getByRole('textbox',{name:'สถานที่'}).fill('กรุงเทพฯ');
  await tool.getByLabel('วัน').selectOption('tomorrow');
  await tool.getByRole('button',{name:'ดูอากาศและช่วงแนะนำ'}).click();
  const result=ai.locator('.activity-ai-messages').getByRole('region',{name:'อากาศกับกิจกรรม'}).last();
  await result.getByText(/ฟ้าใส/).waitFor();
  assert.match(await result.innerText(),/Source: Includes weather data from Google/);
  assert.equal(await page.evaluate(()=>window.lastWeatherRequest.day),'tomorrow');
  assert.equal(await page.getByTestId('form-draft').textContent(),'','weather lookup must not save or open a draft');
  await ai.getByRole('button',{name:'วันนี้ที่เดิม'}).click();
  await ai.locator('.activity-ai-messages').getByRole('region',{name:'อากาศกับกิจกรรม'}).nth(1).getByText(/ฟ้าใส/).waitFor();
  assert.deepEqual(await page.evaluate(()=>({day:window.lastWeatherRequest.day,location:window.lastWeatherRequest.location,activity:window.lastWeatherRequest.activity})),{day:'today',location:'กรุงเทพฯ',activity:'outdoor'});
  await ai.getByRole('button',{name:/ร่างกิจกรรม · 28 ต.ค./}).last().click();
  assert.equal(await page.getByTestId('form-draft').textContent(),'กิจกรรมกลางแจ้ง');
  assert.ok(await page.getByTestId('form-start').textContent());
  await page.evaluate(()=>{window.testWeatherNoSlots=true;});
  await tool.getByRole('button',{name:'ดูอากาศและช่วงแนะนำ'}).click();
  await ai.getByText(/ยังไม่มีช่วงที่ผ่านเกณฑ์/).waitFor();
  assert.equal(await ai.locator('.activity-ai-message-group').filter({hasText:'ยังไม่มีช่วงที่ผ่านเกณฑ์'}).getByRole('button',{name:/ร่างกิจกรรม/}).count(),0,'no-slot response adds no invented action');
  assert.deepEqual(errors,[]);
  console.log('PASS: weather tool shows attributed forecast and opens a review draft only after slot selection');
} finally {await browser.close();await server.close();}
