const puppeteer = require('puppeteer');
const fs = require('fs');

  // (async () => {
  //   const browser =  await puppeteer.launch()
  //   const page = await browser.newPage()
  //   await page.setCacheEnabled(false);
  //   await page.setViewport({ width: 1920, height: 1080 });
  
  //   await page.tracing.start({ screenshots: true, path: "./leaflet/geojson/results/geojson-only/leaflet-trace-1.json" });
  //   await page.goto('http://127.0.0.1:5501/leaflet/geojson/geojson-only.html', {waitUntil: 'networkidle2', timeout: 60000 });
  //     await page.tracing.stop();

  //     const tracing = JSON.parse(fs.readFileSync("./leaflet/geojson/results/geojson-only/leaflet-trace-1.json", 'utf8'));

  //     await browser.close();
  // })();

  (async () => {
    const browser =  await puppeteer.launch()
    const page = await browser.newPage()
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1920, height: 1080 });
  
    await page.tracing.start({ screenshots: true, path: './leaflet/vector-tiles/results/vector-vector/leaflet-trace-5.json' });
    await page.goto('http://127.0.0.1:5501/leaflet/vector-tiles/vector-style-vector.html', {waitUntil: ['networkidle2'], timeout: 60000 });
    // const metrics = await page.evaluate(()=> JSON.stringify(window.performance));
    // console.log(JSON.parse(metrics))
    // const pageMetrics = await page.metrics();
    // console.log(pageMetrics);
    await page.tracing.stop();
  
    // Extract data from the trace
    const tracing = JSON.parse(fs.readFileSync('./leaflet/vector-tiles/results/vector-vector/leaflet-trace-5.json' , 'utf8'));
  
    const traceScreenshots = tracing.traceEvents.filter(x => (
        x.cat === 'disabled-by-default-devtools.screenshot' &&
        x.name === 'Screenshot' &&
        typeof x.args !== 'undefined' &&
        typeof x.args.snapshot !== 'undefined'
    ));
  
    traceScreenshots.forEach(function(snap, index) {
      fs.writeFile(`leaflet-trace-screenshot-${index}.png`, snap.args.snapshot, 'base64', function(err) {
        if (err) {
          console.log('writeFile error', err);
        }
      });
    });
  
    await browser.close();
  })();