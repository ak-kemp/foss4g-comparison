import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import fs from 'fs';
import path from 'path';

const OUTPUT_FOLDER = './output/';
const BASE_ADDRESS = 'http://127.0.0.1:5501/tests/';

const libraries = {
  'openlayers':{
    css:'https://cdn.jsdelivr.net/npm/ol@v7.4.0/ol.css',
    js:'https://cdn.jsdelivr.net/npm/ol@v7.4.0/dist/ol.js',
    olms:'https://cdn.jsdelivr.net/npm/ol-mapbox-style@10.5.0/dist/olms.js'
  },
  'leaflet':{
    css:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    js:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    esriLeaflet:'https://unpkg.com/esri-leaflet@3.0.10/dist/esri-leaflet.js',
    esriLeafletVector:'https://unpkg.com/esri-leaflet-vector@4.0.2/dist/esri-leaflet-vector.js'
  },
  'maplibre':{
    css:'https://unpkg.com/maplibre-gl@3.0.1/dist/maplibre-gl.css',
    js:'https://unpkg.com/maplibre-gl@3.0.1/dist/maplibre-gl.js'
  }};
const testFiles = {
  'vector':'vector-only.html',
  'raster':'raster-only.html',
  'geojson':'geojson-only.html',
  'raster-map':'raster-map.html',
  'vector-map':'vector-map.html'
};

const csvHeaders = [
  'library',
  'test',
  'traceNumber',
  'librariesRequested',
  'librariesLoaded',
  'totalLibraryLoadTime',
  'firstPrePaint',
  'lastPrePaint',
  'totalPaintTime',
  'totalAppLoadTime',
  'puppeteerFCP',
  'puppeteerLCP',
  'lighthouseFCP',
  'lighthouseLCP',
  'lighthouseTBT'
]

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

const performTest = async (library, test, options) => {
  // Error handling
  if (library !== 'all' && !Object.keys(libraries).includes(library)) throw new Error('Must set library param to openlayers, leaflet, or maplibre.');
  if (library !== 'all' && !Object.keys(testFiles).includes(test)) throw new Error('Invalid test provided.');


  // Parse options
  const librariesToTest = library == 'all' ? Object.keys(libraries) : [library];
  const filesToTest = test == 'all' ? Object.keys(testFiles) : [test];

  const iterations = options.iterations ? parseInt(options.iterations) : 5;
  const saveScreenshots = (options.saveScreenshots === 'true') ? true : false;
  const saveFiles = (options.saveFiles === 'false') ? false : true;

  // Initialize output folder and data.csv
  const typeFolder = `${OUTPUT_FOLDER+library}/${test}/`;
  if (!fs.existsSync(typeFolder)) fs.mkdirSync(typeFolder);

  const testTime = new Date(Date.now()).toLocaleString('en-US').replaceAll('/','-').replaceAll(':','.').replaceAll(', ','--');
  const outputFolder = `${typeFolder+testTime}/`;
  fs.mkdirSync(outputFolder);

  fs.writeFileSync(outputFolder+'data.csv','');
  const csvStream = fs.createWriteStream(outputFolder+'data.csv')
  csvStream.write(csvHeaders.join(',')+'\n');

  // Perform tests on each library
  for (const thisFile of filesToTest) {
    for (const thisLibrary of librariesToTest) {
      console.log(`Performing test ${thisFile} in ${thisLibrary}...`)
      await testPage(thisLibrary,thisFile,csvStream,{
        outputFolder,
        iterations,
        saveScreenshots,
        saveFiles
      })
      console.log(`Test ${thisFile} in ${thisLibrary} complete.`)
    }
  }

  // Clean up extra files
  if (!saveFiles) {
    console.log('Cleaning up traces...')
    const files = fs.readdirSync(outputFolder)
    for (const file of files) {
      if (file == 'data.csv') continue;
      fs.unlink(path.join(outputFolder,file), (err)=> {
        if (err) throw err;
      });
    }
  }
}

// Perform complete tests on an app
const testPage = async (library,test,csvStream,options) => {
  
  const appAddress = `${BASE_ADDRESS+library}/${testFiles[test]}`;
  const csvEntries = [];
  for (let i=0; i < options.iterations; i++) {
    await (async () => {
      console.log(`Starting test ${i}...`);

      const testName = `${options.outputFolder}${library}-${test}`
      // Configure settings
      const browser =  await puppeteer.launch({headless:'new'});
      const page = await browser.newPage()
      await page.setCacheEnabled(false);
      await page.setViewport({ width: 1920, height: 1080 });   
      // Generate puppeteer trace
      console.log(`Starting trace ${i}...`);
      await page.tracing.start({ screenshots: true, path: `${testName}-trace-${i}.json` });
      await page.goto(appAddress, { waitUntil:'networkidle0',timeout: 60000 });
      await new Promise((res,rej)=>setTimeout(res,5000)); // Extra time for commits to render
      await page.tracing.stop();
      await page.close();

      // Generate lighthouse report
      const lighthousePage = await browser.newPage();
      console.log(`Starting lighthouse report ${i}...`);
      const lighthoueResults = await lighthouse(appAddress,{
        onlyCategories:['performance'],
      },undefined,lighthousePage);
      fs.writeFileSync(`${testName}-lhr-${i}.json`,JSON.stringify(lighthoueResults.lhr));

      await browser.close();

      // Parse data
      console.log(`Parsing trace ${i}...`);
      // Open the trace
      const trace = JSON.parse(fs.readFileSync(`${testName}-trace-${i}.json` , 'utf8'));
        
      // follow the format defined in csvHeaders above
      const traceEntry = [];

      traceEntry.push(library);
      traceEntry.push(test);
      traceEntry.push(i);

      // Initial page request event
      const navigationStart = trace.traceEvents.filter(e=>(e.name === "navigationStart"))[0];


      // Get libraries requested and received
      const packages = libraries[library];
      const packageRequestTimes = [];
      const packageLoadedTimes = [];
      Object.keys(libraries[library]).forEach(libPackage => {
        const packageSent = trace.traceEvents.filter(e=>(e.name === "ResourceSendRequest" && e.args.data.url === packages[libPackage]));
        if (packageSent.length == 0) return;
        packageRequestTimes.push(packageSent[0].ts);
        const packageLoaded = trace.traceEvents.filter(e=>(e.name === "ResourceFinish" && e.args.data.requestId === packageSent[0].args.data.requestId));
        packageLoadedTimes.push(packageLoaded[0].ts);
      })

      // Timestamps of when the first package is requested and when the final package is loaded -- in milliseconds from navigation start
      const firstPackageRequest = Math.min(...packageRequestTimes);
      traceEntry.push(toMs(firstPackageRequest - navigationStart.ts));
      const finalPackageLoad = Math.max(...packageLoadedTimes);
      traceEntry.push(toMs(finalPackageLoad - navigationStart.ts));

      // Total library load time -- in milliseconds
      const totalLibraryLoadTime = finalPackageLoad - firstPackageRequest;
      traceEntry.push(toMs(totalLibraryLoadTime));

      
      // Get first and final commit ends
      const commitEnds = trace.traceEvents.filter(e => (e.name === "PrePaint" && e.ph === "X"));    
      let firstCommitEnd = commitEnds[0];
      let finalCommitEnd = commitEnds[0];
    
      for (let commit of commitEnds) {
        if (commit.ts < firstCommitEnd.ts) firstCommitEnd = commit;
        if (commit.ts > finalCommitEnd.ts) finalCommitEnd = commit;
      }
    
      // Timestamps of first and last commit end -- in milliseconds from navigation start
      traceEntry.push(toMs(firstCommitEnd.ts - navigationStart.ts))
      traceEntry.push(toMs(finalCommitEnd.ts+finalCommitEnd.dur - navigationStart.ts));

      // Total paint time -- in milliseconds
      const totalPaintTime = finalCommitEnd.ts - firstCommitEnd.ts;
      traceEntry.push(toMs(totalPaintTime));

      // Total load time from first request sent to final commit rendered -- in milliseconds
      const totalAppLoadTime = finalCommitEnd.ts - firstPackageRequest;
      traceEntry.push(toMs(totalAppLoadTime));

      // Puppeteer FCP and LCP
      const fcpTraces = trace.traceEvents.filter(e=>(e.name === "firstContentfulPaint"));

      let puppeteerFCP;
      if (fcpTraces.length == 0) {
        puppeteerFCP = 'NaN';
      }
      else puppeteerFCP = fcpTraces[0].ts - navigationStart.ts;

      const lcpTraces = trace.traceEvents.filter(e=>(e.name==="largestContentfulPaint::Candidate"));
      let puppeteerLCP;
      if (lcpTraces.length == 0) puppeteerLCP = puppeteerFCP;
      else puppeteerLCP = lcpTraces[0].ts - navigationStart.ts;

      // In milliseconds from page load
      traceEntry.push(toMs(puppeteerFCP));
      traceEntry.push(toMs(puppeteerLCP));

      // Lighthouse results

      // First contentful paint -- in milliseconds
      const firstPaint = lighthoueResults.lhr.audits['first-contentful-paint'];
      traceEntry.push(firstPaint.numericValue);

      // Largest contentful paint -- in milliseconds
      const largestPaint = lighthoueResults.lhr.audits['largest-contentful-paint']
      traceEntry.push(largestPaint.numericValue);

      // Total blocking time -- in milliseconds
      const tbt = lighthoueResults.lhr.audits['total-blocking-time'];
      traceEntry.push(tbt.numericValue);

      // Save to array
      csvEntries.push(traceEntry);
    
      if (options.saveScreenshots) {
        // write screenshots
        const traceScreenshots = trace.traceEvents.filter(x => (
          x.cat === 'disabled-by-default-devtools.screenshot' &&
          x.name === 'Screenshot' &&
          typeof x.args !== 'undefined' &&
          typeof x.args.snapshot !== 'undefined'
        ));
    
        traceScreenshots.forEach(function(snap, index) {
          console.log('Saving screenshots...')
          fs.writeFile(`${options.outputFolder}trace-${i}--screenshot-${index}.png`, snap.args.snapshot, 'base64', function(err) {
            if (err) {
              console.log('writeFile error', err);
            }
          });
        });
        console.log('Screenshots saved.',i);
      }

      console.log(`Test ${i} complete.`)

    })();
  }

  // TODO average values of all iterations
  const avgEntry = [];
  const iter1 = csvEntries[0];
  avgEntry.push(iter1[0]);
  avgEntry.push(iter1[1]);
  avgEntry.push('avg');
  for (let i=3;i<iter1.length;i++) {
    let sum=0;
    for (let j=0;j<csvEntries.length;j++) {
      sum += parseInt(csvEntries[j][i]);
    }
    const avg = (sum / parseFloat(csvEntries.length));
    avgEntry.push(avg);
  }
  csvEntries.push(avgEntry);

  for (const entry of csvEntries) {
    // write to csv file
    csvStream.write(entry.join(',')+'\n');
  }
}

// Appends the relevant information from a trace to the CSV
const toMs = (microsecond) => {
    return (microsecond / 1000).toFixed(6); // Six sig figs
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

console.log(library,test,options);

performTest(library,test,options);