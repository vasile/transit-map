## About

This project animates vehicles (markers) on a map using the public transport timetables to interpolate their positions along the routes (polylines).

**NEW: Plug and play your GTFS files !** Check the [GTFS-viz](https://github.com/vasile/GTFS-viz) for more information.

![Swiss railways(SBB)](https://raw.github.com/vasile/transit-map/master/static/images/github_badge_800px.png "Swiss railways(SBB)")
SBB network - http://simcity.vasile.ch/sbb/

### Live applications using this project

* **Swiss National Railways (SBB)** network - http://simcity.vasile.ch/sbb/
* **Romanian Railways (CFR)** network - http://cfr.webgis.ro/
* **Lausanne (TL)** public transport - http://simcity.vasile.ch/lausanne/
* **Brașov (RAT)** public transport - http://brasov.webgis.ro/
* **Grenoble (TAG)** public transport - http://simcity.vasile.ch/grenoble/
* **Genève (TPG)** public transport - http://simcity.vasile.ch/geneva/

![Swiss railways(SBB)](http://simcity.vasile.ch/sbb/static/images/embed_social_200px.png "Swiss railways(SBB)") ![Romanian railways(CFR)](http://cfr.webgis.ro/static/images/embed_social_200px.png "Romanian railways(CFR)") ![Lausanne (TL)](http://simcity.vasile.ch/lausanne/static/images/embed_social_200px.png "Lausanne (TL)") ![Brașov (RAT)](http://brasov.webgis.ro/static/images/embed_social_200px.png "Brașov (RAT)") ![Grenoble (TAG)](http://simcity.vasile.ch/grenoble/static/images/embed_social_200px.png "Grenoble (TAG)") ![Genève (TPG)](http://simcity.vasile.ch/geneva/static/images/embed_social_200px.png "Genève (TPG)")

## Install

You need is a webserver(i.e. Apache) and a (modern) browser.

Steps:

* clone / download the project in a location that can be accessible via your webserver
* access the project in the browser (i.e. [http://localhost/transit-map/](http://localhost/transit-map/) ). 

You should already see some action on the map !

## Customize

### Parameters in config.js

File [static/js/config.js](https://github.com/vasile/transit-map/blob/master/static/js/config.js)

| Key | Required | Sample Value | Description |
| ------------ | ------------- | ------------ | ------------ |
| center.x | **YES** | 8.540 | Longitude of the map center. Values in decimal degrees. |
| center.x | **YES** | 47.378 | Latitude of the map center. Values in decimal degrees. |
| map_type_id | **YES** | roadmap | Initial map type. Values: **roadmap**, **satellite**, **terrain**, **stamen** |
| zoom.start | **YES** | 13 | Initial map zoom level. Values from 1 to 21. |
| zoom.min |  | 7 | Minimum map zoo level. |
| zoom.max |  | 7 | Maximum map zoo level. |
| zoom.to_stops | **YES** | 17 | Zoom to this value when a stop(station) is clicked / selected |
| zoom.roadmap.stops_min |  | 15 | Minimum zoom level for which the stops(stations) layer is visible when the roadmap view is rendered |
| zoom.roadmap.stops_max |  | 20 | Maximum zoom level ... |
| zoom.roadmap.shapes_min |  | 7 | Minimum zoom level for which the shapes(tracks) ... |
| zoom.roadmap.shapes_min |  | 20 | Maximum zoom level ... |
| zoom.satellite.stops_min |  | 15 | Minimum zoom level for which the stops(stations) layer is visible when the satellite view is rendered |
| zoom.satellite.stops_max |  | 20 | Maximum zoom level ... |
| zoom.satellite.shapes_min |  | 7 | Minimum zoom level for which the shapes(tracks) ... |
| zoom.satellite.shapes_min |  | 18 | Maximum zoom level ... |
| zoom.vehicle_follow | **YES** | 17 | Zoom to this value when a vehicle is "followed" |
| zoom.vehicle_mouseover_min | **YES** | 7 | Prohibit vehicle popups when hovering under this zoom value |
| ft_layer_ids.mask |  | *string* | Fusion Table ID of the area mask. Example: [SBB network mask](https://www.google.com/fusiontables/DataSource?docid=1tDHsjdz7uhhAmWlmmwjR1P2Huf2LKMMiICPVdw) |
| ft_layer_ids.gtfs_shapes |  | *string* | Fusion Table ID of the GTFS shapes. Example: [SF Muni shapes](https://www.google.com/fusiontables/DataSource?docid=1P8sj1Nte_-84dNqcdeKhVeIhVFZ3PGJsNHShVBE) |
| ft_layer_ids.gtfs_stops |  | *string* | Fusion Table ID of the GTFS stops. Example: [SF Muni stops](https://www.google.com/fusiontables/DataSource?docid=1Md8PkM899quqFiCnfv4bpaGOKbVWMn4u9HBiQiY) |
| ft_layer_ids.topology_edges |  | *string* | Fusion Table ID of the custom network edges. Example: [SBB edges](https://www.google.com/fusiontables/DataSource?docid=1-1B2tYIO2JSnaacEHO8sfWVjm1S387lMEkHkjc4) . **Use this for non-GTFS projects** |
| ft_layer_ids.topology_stations |  | *string* | Fusion Table ID of the custom network stations. Example: [SBB edges](https://www.google.com/fusiontables/DataSource?docid=1YppDCNud7566oK_VwHsuUhGJqnm_CLDStMS3IuM) . **Use this for non-GTFS projects** |
| api_paths.trips | **YES** | api/getTrips/[hhmm] | Vehicles (or GTFS trips) API with all vehicles that run at given hhmm - hour minutes. |
| api_paths.departures |  | api/getDepartures/[stop_id]/[hhmm] | Departures API of the vehicles that stop in [stop_id] station at given [hhmm] time. |
| geojson.gtfs_shapes | **YES** | api/geojson/gtfs_shapes.json | GeoJSON FeatureCollection with the GTFS shapes. **This param is not required if geojson.topology_* are used. |
| geojson.gtfs_stops | **YES** | api/geojson/gtfs_shapes.json | GeoJSON FeatureCollection with the GTFS stops. **This param is not required if geojson.topology_* are used.** |
| geojson.topology_edges |  | static/geojson/edges-sbb.json | GeoJSON FeatureCollection with the network edges. **This param is required if the project is NOT GTFS based.** |
| geojson.topology_stations |  | static/geojson/edges-sbb.json | GeoJSON FeatureCollection with the network stations. **This param is required if the project is NOT GTFS based.** |
| routes |  | Hash | JS Hash containing the route defintions.** |

**Notes:**

- no one of the FT Layers are needed, they are just used for displaying the network stations and lines on the map.
- ft_layer_ids.gtfs\_\* and ft_layer_ids.topology\_\* are mutually exclusive, the first one  should be used if the project is GTFS-based . Same for geojson.gtfs\_\* vs geojson.topology\_\* keys
- check the [GTFS-viz](https://github.com/vasile/GTFS-viz) script if you plan to animate a GTFS dataset

### Override parameters

All the config parameters above can be overriden using query string parameters, for instance add **?center.x=8.2&center.y=46.9** to override the map center.

### Other parameters

In addition to these, other optional parameters can be used as querystring parameters or in the config.js

| Key | Sample Value | Description |
| ------------ | ------------- | ------------ |
| hms | 10:20:30 | Override time of day, using hh:mm:vv format |
| time_multiply | 10 | Accelerate the simulation :) Possible values: 1, 5, 10, 100 |
| view_mode | iframe | Will remove the info panel; suitable for IFRAME integrations |
| vehicle_name | ICN10017 | The application will try to locate the vehicle by name and follow it |
| vehicle_id | *string* | Same as above for vehicle_id |


**Examples:**

* Stamen watercolor map, centered on 8.47 longitude with 47.18 latitude, initial zoom level 11 and simulation time set for 10:20:30 with time increasing 10x
    
    [?center.x=8.7&center.y=47.18&zoom.start=11&map_type_id=stamen&hms=11:20:30&time_multiply=10](http://simcity.vasile.ch/sbb/?center.x=8.7&center.y=47.18&zoom.start=11&map_type_id=stamen&hms=11:20:30&time_multiply=10)

* Roadmap, swiss-centered, included as an iframe
    
    [?center.x=8.2&center.y=46.9&zoom.start=9&map_type_id=roadmap&hms=11:20:30&time_multiply=100&view_mode=iframe](http://simcity.vasile.ch/sbb/?center.x=8.2&center.y=46.9&zoom.start=9&map_type_id=roadmap&hms=11:20:30&time_multiply=100&view_mode=iframe) 

* Track ICN10017 (Zürich HB - Lugano)
    
    [?hms=11:25:30&vehicle_name=ICN10017&time_multiply=5](http://simcity.vasile.ch/sbb/?hms=11:25:30&vehicle_name=ICN10017&time_multiply=5)     

## Contact ?
Have other questions or do you want to use this application for your area and got stuck ? 

Then ping me on [Twitter](https://twitter.com/vasile23) or drop [me](http://www.vasile.ch) a line. 
 
## License

**Copyright (c) 2014 Vasile Coțovanu** - http://www.vasile.ch
 
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the **following conditions:**
 
* **The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.**
 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
