const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runAudit() {
  const browser = await chromium.launch();
  const mobileDevice = devices['iPhone 13'];
  const context = await browser.newContext({
    ...mobileDevice,
  });
  const page = await context.newPage();

  const resultsDir = path.join(__dirname, 'mobile_audit_v2');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);

  const files = ['index.html', 'instructions.html', 'compare.html'];

  for (const file of files) {
    const filePath = 'file://' + path.join(__dirname, file);
    console.log(`Auditing ${file}...`);
    await page.goto(filePath);
    
    // Wait for animations
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: path.join(resultsDir, `${file.replace('.html', '')}_mobile.png`),
      fullPage: true 
    });

    // Simple checks
    const hasHorizontalScroll = await page.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      return scrollWidth > clientWidth + 1; // +1 to avoid subpixel issues
    });
    console.log(`${file} has horizontal scroll: ${hasHorizontalScroll}`);
  }

  // E2E Flow Test
  console.log('Testing E2E Flow...');
  try {
    await page.goto('file://' + path.join(__dirname, 'index.html'));
    await page.waitForTimeout(1000);
    await page.click('text=English', { force: true });
    console.log('Navigated to instructions');
    
    await page.waitForTimeout(1000);
    // Use a more specific selector or click coordinates if intercepting persists
    await page.click('.action-button', { force: true });
    console.log('Navigated to compare');

    await page.waitForTimeout(1000);
    // Open models
    await page.click('#show-models-button', { force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(resultsDir, 'compare_models_open.png') });
    
    // Select some models (first 4)
    const models = await page.$$('#model-selection-container .model-box');
    console.log(`Found ${models.length} models`);
    for (let i = 0; i < Math.min(models.length, 4); i++) {
      await models[i].click({ force: true });
    }
    
    await page.fill('#prompt-input', 'A beautiful sunset over a calm ocean, digital art');
    await page.screenshot({ path: path.join(resultsDir, 'compare_ready.png') });
  } catch (e) {
    console.error('E2E Flow failed:', e.message);
    await page.screenshot({ path: path.join(resultsDir, 'error_state.png') });
  }

  await browser.close();
  console.log('Audit complete. Screenshots saved to mobile_audit_v2/');
}

runAudit().catch(console.error);
