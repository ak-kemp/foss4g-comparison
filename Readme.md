# Open source library shootout 
### _Code for presentations given at the FOSS4G and FOSS4G NA 2023 conferences_
#### _Anita Kemp, George Owen, Courtney Yatteau_ 

The purpose of the presentation is to compare performance metrics such as the total paint and the total load time for vector, map tile, and GeoJSON layers between the following open source mapping libraries: 

1. MapLibre GL JS
2. OpenLayers
3. Leaflet 

The first iteration of this presentation was given at the FOSS4G conference in Prizren, Kosovo. For the FOSS4G NA 2023 conference, a new trace script to automate testing was created to verify and expand on the inital results as well as to improve the methodology. 

### Research question 

How do different open source mapping libraries compare with one another based on the following metrics?  

* Features and capabilities  
* Library size 
* Vector tile layer support  
* Web GL support 
* Fetching tile layers 
* The rendering of vector and raster basemaps and layers  
* The rendering of GeoJSON data

### Methodology 

#### Tools 

* [Puppeteer](https://pptr.dev/): To create and automate traces
* [Lighthouse](https://github.com/GoogleChrome/lighthouse/blob/main/docs/puppeteer.md): To obtain performance metrics such as total blocking time

#### Libraries 

* MapLibre GL JS
* OpenLayers
* Leaflet
* CesiumJS (for feature and capability comparisons only)

#### Plugins 

* Esri Leaflet ([Vector basemap layer plugin](https://developers.arcgis.com/esri-leaflet/api-reference/layers/vector-basemap/))
* OpenLayers Mapbox Style ([ol-mapbox-style(https://github.com/openlayers/ol-mapbox-style))

#### Layers 

* Vector basemap style: [ArcGIS Light Gray](https://developers.arcgis.com/documentation/mapping-apis-and-services/maps/services/basemap-layer-service/#streets-and-navigation)
* Raster basemap: [ArcGIS Imagery](https://developers.arcgis.com/documentation/mapping-apis-and-services/maps/services/basemap-layer-service/#image-tile-service-url)
* [Vector tile layer](https://www.arcgis.com/home/item.html?id=f0298e881b5b4743bbdf2c7d378acc84)
* [Map tile layer](https://www.arcgis.com/home/item.html?id=47bb79dee97b41ae8c542211b3527a24)
* [GeoJSON layer](https://www.arcgis.com/home/item.html?id=66c5bd3cde384c448216bd7ed9f4061f) 

### Run the code 

1. Run `npm install` to install the dependencies
2. Sign up for a free [ArcGIS Developer account](https://developers.arcgis.com/sign-up/).
3. In the developer dashboard, copy the default API key.
4. In the code, go to **Tests** > **auth.js** and set your API key so that you can access the basemap styles. 
5. In the command line, specify the [library, test, other options](https://github.com/ak-kemp/foss4g-comparison/blob/main/trace-script.mjs#L51). 

### Resources 

* [ArcGIS Developers documentation](https://developers.arcgis.com/documentation/)
* [Puppeteer](https://pptr.dev/)
