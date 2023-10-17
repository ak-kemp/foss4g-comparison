import puppeteer from 'puppeteer';
//import lighthouse from 'lighthouse';
import fs from 'fs';

const OUTPUT_FOLDER = './output/';
const BASE_ADDRESS = 'http://127.0.0.1:5501/';

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
  'firstCommitEnd',
  'lastCommitEnd',
  'totalPaintTime',
  'totalAppLoadTime',
  //'totalBlockingTime',
  //'firstContentfulPaint',
  //'largestContentfulPaint'
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
  if (library !== 'all' && !Object.keys(libraries).includes(library)) throw new Error('Must set library param to openlayers, leaflet, or maplibre.');
  if (library !== 'all' && !Object.keys(testFiles).includes(test)) throw new Error('Invalid test provided.');

  const librariesToTest = library == 'all' ? Object.keys(libraries) : [library];
  const filesToTest = test == 'all' ? Object.keys(testFiles) : [test];


  const iterations = options.iterations ? parseInt(options.iterations) : 5;
  const saveCSV = (options.saveCSV === 'false') ? false : true;
  const saveScreenshots = (options.saveScreenshots === 'true') ? true : false;

  const typeFolder = `${OUTPUT_FOLDER+library}/${test}/`;
  if (!fs.existsSync(typeFolder)) fs.mkdirSync(typeFolder);

  const testTime = new Date(Date.now()).toLocaleString('en-US').replaceAll('/','-').replaceAll(':','.');
  const outputFolder = `${typeFolder+testTime}/`;
  fs.mkdirSync(outputFolder);

  // TODO initialize csv
  let csvStream;
  if (saveCSV) {
    console.log(csvHeaders.join(',')+'\n','');
    fs.writeFileSync(outputFolder+'data.csv','');
    csvStream = fs.createWriteStream(outputFolder+'data.csv')
    csvStream.write(csvHeaders.join(',')+'\n');
  }

  for (const thisFile of filesToTest) {
    for (const thisLibrary of librariesToTest) {
      console.log(`Performing test ${thisFile} in ${thisLibrary}...`)
      await testPage(thisLibrary,thisFile,{
        outputFolder,
        iterations,
        csvStream,
        saveScreenshots
      })
    }
  }
}

// Perform complete tests on an app
const testPage = async (library,test,options) => {
  
  const appAddress = `${BASE_ADDRESS+library}/${testFiles[test]}`;

  for (let i=0; i < options.iterations; i++) {
    await (async () => {
      // Configure settings
      const browser =  await puppeteer.launch()
      const page = await browser.newPage()
      await page.setCacheEnabled(false);
      await page.setViewport({ width: 1920, height: 1080 });   
      // Trace app load
      console.log(`Starting trace ${i}...`);
      await page.tracing.start({ screenshots: true, path: `${options.outputFolder}trace-${i}.json` });
      await page.goto(appAddress, {waitUntil: ['networkidle0'], timeout: 60000 });
      // const metrics = await page.evaluate(()=> JSON.stringify(window.performance));
      // console.log(JSON.parse(metrics))
      // const pageMetrics = await page.metrics();
      // console.log(pageMetrics);
      await page.tracing.stop();
      await page.close();
      // lighthouse report
      /*
      const lighthousePage = await browser.newPage();
      const {lhr} = await lighthouse(appAddress, undefined, undefined, lighthousePage);

      console.log(lhr.categories.performance);
      */
      //console.log(`Lighthouse scores: ${Object.values(lhr.categories).map(c => c.score).join(', ')}`);
      await browser.close();

      console.log(`Parsing trace ${i}...`);
      // Open the trace
      const trace = JSON.parse(fs.readFileSync(`${options.outputFolder}trace-${i}.json` , 'utf8'));

      if (options.csvStream) {
        
        // follow the format defined in csvHeaders above
        const traceEntry = [];

        traceEntry.push(library);
        traceEntry.push(test);
        traceEntry.push(i);

        // library requested and received
        const packages = libraries[library];
        const packageRequestTimes = [];
        const packageLoadedTimes = [];
        Object.keys(libraries[library]).forEach(libPackage => {
          const packageSent = trace.traceEvents.filter(e=>(e.name === "ResourceSendRequest" && e.args.data.url === packages[libPackage]));
          if (packageSent.length == 0) return;
          console.log(packages[libPackage]);
          packageRequestTimes.push(packageSent[0].ts);
          const packageLoaded = trace.traceEvents.filter(e=>(e.name === "ResourceFinish" && e.args.data.requestId === packageSent[0].args.data.requestId));
          packageLoadedTimes.push(packageLoaded[0].ts);
        })

        // record time of first request sent
        // record time of final package loaded
        const firstPackageRequest = Math.min(...packageRequestTimes);
        traceEntry.push(firstPackageRequest);
        const finalPackageLoad = Math.max(...packageLoadedTimes);
        traceEntry.push(finalPackageLoad);
        const totalLibraryLoadTime = finalPackageLoad - firstPackageRequest;
        traceEntry.push(totalLibraryLoadTime);

        
        // first and final commit ends
        const commitEnds = trace.traceEvents.filter(e => (e.name === "Commit" && e.ph === "e"));    
        let firstCommitEnd = commitEnds[0];
        let finalCommitEnd = commitEnds[0];
      
        for (let commit of commitEnds) {
          if (commit.ts < firstCommitEnd.ts) firstCommitEnd = commit;
          if (commit.ts > finalCommitEnd.ts) finalCommitEnd = commit;
        }
      
        //console.log(firstCommitEnd.ts,finalCommitEnd.ts);
        traceEntry.push(firstCommitEnd.ts)
        traceEntry.push(finalCommitEnd.ts);

        // total paint time
        const totalPaintTime = finalCommitEnd.ts - firstCommitEnd.ts;
        traceEntry.push(totalPaintTime);


        // TODO first visible data

        // Total load time for app content: from library request sent to app finished rendering
        const totalAppLoadTime = finalCommitEnd.ts - firstPackageRequest;
        traceEntry.push(totalAppLoadTime);
        // TODO total blocking time (lighthouse report)

        // write to csv file
        options.csvStream.write(traceEntry.join(',')+'\n');
        
      }
    
      if (options.saveScreenshots) {
        // write screenshots
        const traceScreenshots = trace.traceEvents.filter(x => (
          x.cat === 'disabled-by-default-devtools.screenshot' &&
          x.name === 'Screenshot' &&
          typeof x.args !== 'undefined' &&
          typeof x.args.snapshot !== 'undefined'
        ));
    
        traceScreenshots.forEach(function(snap, index) {
          console.log('saving screenshots...')
          fs.writeFile(`${options.outputFolder}trace-${i}--screenshot-${index}.png`, snap.args.snapshot, 'base64', function(err) {
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

// Appends the relevant information from a trace to the CSV
const toCSV = (trace) => {
  
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