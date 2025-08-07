const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  try {
    await page.goto('https://web.whatsapp.com', { timeout: 30000 });
    console.log('WhatsApp Web loaded successfully');
  } catch (err) {
    console.error('Failed to load WhatsApp Web:', err);
  }
  await browser.close();
})();