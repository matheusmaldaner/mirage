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

  const resultsDir = path.join(__dirname, 'mobile_audit');
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
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    console.log(`${file} has horizontal scroll: ${hasHorizontalScroll}`);
  }

  // E2E Flow Test
  console.log('Testing E2E Flow...');
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.click('text=English');
  console.log('Navigated to instructions');
  
  await page.waitForTimeout(500);
  await page.click('text=Begin');
  console.log('Navigated to compare');

  // Open models
  await page.click('#show-models-button');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(resultsDir, 'compare_models_open.png') });
  
  // Select some models (first 4)
  const models = await page.$$('#model-selection-container .model-box');
  for (let i = 0; i < Math.min(models.length, 4); i++) {
    await models[i].click();
  }
  
  await page.fill('#prompt-input', 'A beautiful sunset over a calm ocean, digital art');
  await page.screenshot({ path: path.join(resultsDir, 'compare_ready.png') });

  await browser.close();
  console.log('Audit complete. Screenshots saved to mobile_audit/');
}

runAudit().catch(console.error);
