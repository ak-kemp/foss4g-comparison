const puppeteer = require('puppeteer');
const fs = require('fs');

const OUTPUT_FOLDER = './output/';
const BASE_ADDRESS = 'http://127.0.0.1:5501/';

const libraries = ['openlayers','leaflet','maplibre'];
const testFiles = {
  'vector':'vector-tiles/vector-only.html',
  'raster':'raster-tiles/raster-only.html',
  'geojson':'geojson/geojson-only.html',
  'raster-map':'maps/raster.html',
  'vector-map':'maps/vector.html'
};

/*
testPage: Performs a number of puppeteer tests on a page and outputs results

Parameters:
library: a valid library (see above list)
test: a valid test (see above dictionary)
options: {
  iterations: number of times to perform test
  saveCSV: whether to save a csv of output data (default true)
  saveScreenshots: whether to save all screenshots generated (default false)

}
*/
const testPage = async (library,test,options) => {

  if (!libraries.includes(library)) throw new Error('Must set library param to openlayers, leaflet, or maplibre.');
  if (!Object.keys(testFiles).includes(test)) throw new Error('Invalid test provided.');

  const appAddress = `${BASE_ADDRESS+library}/${testFiles[test]}`;

  const iterations = options.iterations ? parseInt(options.iterations) : 5;
  const saveCSV = (options.saveCSV === 'false') ? false : true;
  const saveScreenshots = (options.saveScreenshots === 'true') ? true : false;

  const typeFolder = `${OUTPUT_FOLDER+library}/${test}/`;
  if (!fs.existsSync(typeFolder)) fs.mkdirSync(typeFolder);

  const testTime = new Date(Date.now()).toLocaleString('en-US').replaceAll('/','-').replaceAll(':','.');
  const testFolder = `${typeFolder+testTime}/`;
  fs.mkdirSync(testFolder);

  // TODO initialize csv

  for (let i=0; i < iterations; i++) {
    (async () => {
      // Configure settings
      const browser =  await puppeteer.launch()
      const page = await browser.newPage()
      await page.setCacheEnabled(false);
      await page.setViewport({ width: 1920, height: 1080 });   
      // Trace app load
      console.log(`Starting trace ${i}...`);
      await page.tracing.start({ screenshots: true, path: `${testFolder}trace-${i}.json` });
      await page.goto(appAddress, {waitUntil: ['networkidle0'], timeout: 60000 });
      // const metrics = await page.evaluate(()=> JSON.stringify(window.performance));
      // console.log(JSON.parse(metrics))
      // const pageMetrics = await page.metrics();
      // console.log(pageMetrics);
      await page.tracing.stop();
      
      console.log(`Parsing trace ${i}...`);
      // Open the trace
      const trace = JSON.parse(fs.readFileSync(`${testFolder}trace-${i}.json` , 'utf8'));
    
      if (saveCSV) {
        const commitEnds = trace.traceEvents.filter(e => (e.name === "Commit" && e.ph === "e"));
        console.log(commitEnds);
        // find the final commit end
      }
    
      if (saveScreenshots) {
        // write screenshots
        const traceScreenshots = trace.traceEvents.filter(x => (
          x.cat === 'disabled-by-default-devtools.screenshot' &&
          x.name === 'Screenshot' &&
          typeof x.args !== 'undefined' &&
          typeof x.args.snapshot !== 'undefined'
        ));
    
        traceScreenshots.forEach(function(snap, index) {
          console.log('saving screenshots...')
          fs.writeFile(`${testFolder}trace-${i}--screenshot-${index}.png`, snap.args.snapshot, 'base64', function(err) {
            if (err) {
              console.log('writeFile error', err);
            }
          });
        });
        console.log('screenshots parsed, finishing attempt',i);
      }
      await browser.close();
    })();
    }

}


if (process.argv.length < 4) {
  console.error('Trace script requires a minimum of two arguments: library(s) to test and type of test.');
  process.exit(1);
}
const library = process.argv[2];
const test = process.argv[3];
const options = {}

if (process.argv.length > 4) {
  for (let i=4;i<process.argv.length;i++) {

    const [key,value] = process.argv[i].split('=');
    options[key] = value
  }
}

console.log(options)

testPage('leaflet','vector',options)