const lat = 34.027;
const lng = -118.805;
const zoom = 13;

const locations = [
    // { lat: 34.0012, lng: -118.8064, zoom:16, title: "location1" },
    // { lat: 34.074, lng: -118.814, zoom:14, title: "location2"},
    // { lat: 34.042, lng:-118.779, zoom: 18, title: "location3"},
    // { lat: 34.0919, lng: -118.602, zoom: 11, title: "location4"},
    { lat: 34.019, lng: -118.491, zoom: 16, title: "location5"}
];

let index = 0; 

function zoomToLocations(locations, map) {
    map.once('idle', function () {

        // do something only the first time the map is loaded
        console.log("====================================")

        // setcenter and zoom level to different lat lng and zoom level
        map.setCenter([locations[index].lng, locations[index].lat]);
        map.setZoom(locations[index].zoom);

        // recursiverly call performanceTesting function till all locations are covered
        index += 1;
        if (index < locations.length) {
            zoomToLocations(locations, map);
        }
    });
};