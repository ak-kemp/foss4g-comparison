const puppeteer = require('puppeteer');
const fs = require('fs');

  (async () => {
    const browser =  await puppeteer.launch()
    const page = await browser.newPage()
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1920, height: 1080 });
  
    await page.tracing.start({ screenshots: true, path: "./maplibre/vector-tiles/results/vector-only/maplibre-trace-5.json" });
    await page.goto('http://127.0.0.1:5501/maplibre/vector-tiles/vector-only.html', {waitUntil: 'networkidle0', timeout: 60000 });

      await page.tracing.stop();

      const tracing = JSON.parse(fs.readFileSync("./maplibre/vector-tiles/results/vector-only/maplibre-trace-5.json", 'utf8'));

      await browser.close();
  })();

