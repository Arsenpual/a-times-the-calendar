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
  await nav.getByRole('button',{name:'เปิดผู้ช่วย MR.Zettascale'}).click();
  assert.equal(await page.getByTestId('action').textContent(),'assistant');
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
