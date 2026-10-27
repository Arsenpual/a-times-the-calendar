import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const server = await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{port:0},logLevel:'error'});
await server.listen();
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]+'tests/fixtures/app-taskbar.html');
  await page.locator('.app-title').waitFor();
  const toggle=page.locator('#app-navigation-toggle');
  const nav=page.getByRole('navigation',{name:'ฟีเจอร์หลัก'});
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    for(const width of [1440,1024,768,390,320]) {
      await page.setViewportSize({width,height:900});
      for(const expanded of [false,true]) {
        if((await toggle.getAttribute('aria-expanded')==='true')!==expanded) await toggle.click();
        assert.equal(await nav.isVisible(),width>760||expanded);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${theme}/${width}/${expanded} overflow`);
      }
      if([1440,390].includes(width)) await page.screenshot({path:join(tmpdir(),`times-taskbar-${theme}-${width}.png`)});
    }
  }
  await nav.getByRole('button',{name:'Reminder',exact:true}).click();
  assert.equal(await page.getByTestId('mode').textContent(),'reminder');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
  await toggle.click();
  assert.equal(await nav.getByRole('button',{name:'Reminder',exact:true}).getAttribute('aria-current'),'page');
  await nav.getByRole('button',{name:'Activity',exact:true}).click();
  assert.equal(await page.getByTestId('mode').textContent(),'activity');
  await toggle.click();
  await nav.getByRole('button',{name:/เปิด AI Mode MR.Zettascale/}).click();
  assert.equal(await page.getByTestId('action').textContent(),'assistant');
  assert.equal(await page.getByTestId('mode').textContent(),'ai');
  const ai = page.getByRole('region',{name:'AI Mode MR.Zettascale'});
  await ai.waitFor();
  await page.setViewportSize({width:1440,height:900});
  const workRail = ai.getByRole('complementary',{name:'แผงงาน AI'});
  assert.equal(await workRail.isVisible(),true);
  await ai.getByRole('button',{name:'ซ่อนแผงงาน'}).first().click();
  assert.equal(await workRail.count(),0);
  await ai.getByRole('button',{name:'เปิดแผงงาน'}).click();
  assert.equal(await workRail.isVisible(),true);
  for (const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    for (const width of [1440,390,320]) {
      await page.setViewportSize({width,height:900});
      if (width === 1440) {
        assert.equal(await ai.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
        assert.equal(await workRail.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(251, 252, 254)');
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`AI ${theme}/${width} overflow`);
      assert.equal(await ai.evaluate(el=>getComputedStyle(el).position),'static');
      assert.equal(await ai.locator('textarea').isVisible(),true);
      const bounds = await ai.locator('textarea').boundingBox();
      assert.ok(bounds.y + bounds.height <= 900,'composer stays in the viewport');
      const sendBounds = await ai.getByRole('button',{name:'ส่ง',exact:true}).boundingBox();
      assert.ok(sendBounds.y + sendBounds.height <= 900,'send action stays in the viewport');
      if ([1440,390].includes(width)) await page.screenshot({path:join(tmpdir(),`times-ai-mode-${theme}-${width}.png`)});
    }
  }
  assert.equal(await page.getByRole('dialog').count(),0,'AI is a workspace, not a modal');
  assert.equal(await ai.locator('.activity-ai-tools').getAttribute('open'),null);
  await page.setViewportSize({width:1440,height:900});
  const input = ai.getByRole('textbox',{name:'ข้อความถึง MR.Zettascale'});
  const chatStyle = ai.getByRole('group',{name:'วิธีคุยกับ AI'});
  assert.equal(await chatStyle.getByRole('button',{name:'คุยอิสระ'}).getAttribute('aria-pressed'),'true');
  await chatStyle.getByRole('button',{name:'วางแผนกิจกรรม'}).click();
  assert.equal(await chatStyle.getByRole('button',{name:'วางแผนกิจกรรม'}).getAttribute('aria-pressed'),'true');
  await chatStyle.getByRole('button',{name:'คุยอิสระ'}).click();
  await input.fill('เก็บข้อความไว้ตอนสลับโหมด');
  const telegramArchive = workRail.locator('.activity-ai-telegram-archive');
  assert.equal(await telegramArchive.isVisible(),true,'Telegram archive is in the work rail');
  assert.equal(await ai.locator('.activity-ai-messages .activity-ai-telegram-archive').isVisible(),false,'desktop chat stays focused on AI turns');
  assert.equal(await telegramArchive.getByText('บันทึกสั้นจาก Telegram').isVisible(),false,'Telegram messages stay collapsed');
  await page.keyboard.press('Escape');
  assert.equal(await ai.isVisible(),true,'Escape must not close AI Mode behind another overlay');
  await toggle.click();
  assert.equal(await nav.getByRole('button',{name:/ออกจาก AI Mode/}).getAttribute('aria-pressed'),'true');
  await nav.getByRole('button',{name:/ออกจาก AI Mode/}).click();
  assert.equal(await page.getByTestId('mode').textContent(),'activity');
  await toggle.click();
  await nav.getByRole('button',{name:'Reminder',exact:true}).click();
  await toggle.click();
  await nav.getByRole('button',{name:/เปิด AI Mode/}).click();
  assert.equal(await input.inputValue(),'เก็บข้อความไว้ตอนสลับโหมด');
  await ai.getByRole('button',{name:'แชท AI ใหม่'}).click();
  await ai.getByRole('dialog',{name:'ยืนยันเริ่มแชท AI ใหม่'}).getByRole('button',{name:'เริ่มแชทใหม่'}).click();
  await telegramArchive.locator('summary').click();
  assert.equal(await telegramArchive.getByText('บันทึกสั้นจาก Telegram').isVisible(),true,'clearing AI chat keeps Telegram messages');
  await telegramArchive.getByRole('button',{name:'ล้างสำเนา Telegram ในเว็บ'}).click();
  assert.equal(await telegramArchive.getByText('บันทึกสั้นจาก Telegram').count(),0);
  await page.setViewportSize({width:1440,height:900});
  await ai.getByRole('button',{name:'สร้างกิจกรรม',exact:true}).click();
  assert.equal(await workRail.locator('.activity-ai-rail-progress [aria-current="step"]').textContent(),'1ชื่อ');
  await input.fill('ประชุมทีม');
  await input.press('Enter');
  assert.equal(await workRail.locator('.activity-ai-rail-progress [aria-current="step"]').textContent(),'2วัน');
  assert.equal(await workRail.getByRole('textbox',{name:'ชื่อ'}).inputValue(),'ประชุมทีม');
  await workRail.getByRole('textbox',{name:'ชื่อ'}).fill('ประชุมโครงการ');
  assert.match(await ai.getByRole('region',{name:'ข้อมูลกิจกรรมที่กำลังกรอก'}).innerText(),/ชื่อ: ประชุมโครงการ/);
  await workRail.getByRole('button',{name:'ยกเลิกการสร้างกิจกรรม'}).click();
  assert.equal(await workRail.locator('.activity-ai-rail-progress').count(),0);
  assert.equal(await workRail.getByRole('heading',{name:'เครื่องมือ'}).isVisible(),true);
  await ai.getByRole('button',{name:'สร้างกิจกรรม',exact:true}).click();
  await ai.getByRole('button',{name:'ประชุม',exact:true}).click();
  await ai.getByRole('button',{name:'พรุ่งนี้',exact:true}).click();
  await ai.getByRole('button',{name:'ช่วงเช้า · 09:00'}).click();
  await workRail.getByRole('textbox',{name:'ชื่อ'}).fill('ประชุมร่างทดสอบ');
  await page.evaluate(()=>{window.testDraftShouldFail=true;});
  await ai.getByRole('button',{name:'1 ชั่วโมง',exact:true}).click();
  await ai.getByRole('alert').getByText('ทดสอบสร้างร่างไม่สำเร็จ').waitFor();
  assert.equal(await page.getByTestId('form-draft').textContent(),'');
  assert.equal(await workRail.getByRole('textbox',{name:'ชื่อ'}).inputValue(),'ประชุมร่างทดสอบ');
  await page.screenshot({path:join(tmpdir(),'times-ai-guided-1440.png')});
  await page.evaluate(()=>{window.testDraftShouldFail=false;});
  await workRail.getByRole('spinbutton',{name:'ระยะเวลา (นาที)'}).fill('0');
  await workRail.getByRole('button',{name:'สร้างร่างเพื่อตรวจอีกครั้ง'}).click();
  await ai.getByRole('alert').getByText(/ระยะเวลาต้องอยู่ระหว่าง/).waitFor();
  assert.equal(await page.getByTestId('form-draft').textContent(),'');
  await workRail.getByRole('spinbutton',{name:'ระยะเวลา (นาที)'}).fill('60');
  await workRail.getByRole('button',{name:'สร้างร่างเพื่อตรวจอีกครั้ง'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="form-draft"]')?.textContent==='ประชุมร่างทดสอบ');
  assert.match(await ai.locator('.activity-ai-messages').innerText(),/ร่างกิจกรรม: ประชุมร่างทดสอบ/);
  await ai.getByRole('button',{name:'กลับโหมดก่อนหน้า'}).click();
  assert.equal(await page.getByTestId('mode').textContent(),'reminder');
  await toggle.click();
  assert.equal(await nav.getByRole('button',{name:'ตั้งค่า',exact:true}).count(),0);
  assert.equal(await page.locator('.telegram-chat-launcher.is-in-header').count(),0);
  assert.equal(await nav.locator('.taskbar-unread').textContent(),'3');
  await nav.getByRole('button',{name:'ซิงค์ Google Calendar',exact:true}).click();
  assert.equal(await page.getByTestId('action').textContent(),'sync');
  assert.equal(await nav.getByRole('button',{name:'กำลังซิงค์ Google Calendar',exact:true}).isDisabled(),true);
  await nav.getByRole('button',{name:'Activity',exact:true}).focus();
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'เปิดเมนูบัญชีผู้ใช้'}).click();
  await page.getByRole('menuitem',{name:'การตั้งค่า'}).click();
  assert.equal(await page.getByTestId('action').textContent(),'settings');
  await page.evaluate(()=>document.querySelector('.app').classList.add('is-reading'));
  assert.equal(await page.locator('.app-header').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.deepEqual(errors,[]);
  console.log('PASS: taskbar navigation, actions, Escape/focus, reading header and 20 responsive/theme states');
} finally {await browser.close();await server.close();}
