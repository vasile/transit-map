## About
Vehicle simulator creates a Google Maps mashup with animated markers(vehicles) that are moving according with given timetables along polylines(vehicle tracks). 

Projects that are using this script

* **Swiss railways(SBB)** network simulator - http://simcity.vasile.ch/sbb/
* **Romanian railways(CFR)** network simulator - http://cfr.webgis.ro/
* **Lausanne (TL)** public transport simulator - http://simcity.vasile.ch/lausanne/
* **Brașov (RAT)** public transport simulator - http://brasov.webgis.ro/

## Requirements

* a webserver(i.e. Apache)

## Usage

* clone the project in a location that can be accessible via your webserver
* access the project in your browser (i.e. [http://localhost/vehicle-simulator/](http://localhost/vehicle-simulator/) ). 

You should already see some action on the map !

## Customize the project with your area

Config: [static/js/map.js - simulation_manager > config > params](https://github.com/vasile/vehicle-simulator/blob/master/static/js/map.js)

    center_start: new google.maps.LatLng(47.378, 8.540),
    zoom_start: 13,
    zoom_follow: 17,
    zoom_station: 15,
    zoom_mouseover_min: 7,
    ft_id_mask: '812706',
    ft_id_lines: '1497331',
    ft_id_stations: '1497361',
    json_paths: {
        edges: 'static/geojson/edges-sbb.json',
        stations: 'static/geojson/stations-sbb.json',
        vehicles: 'api/vehicles/[hhmm]'
        station_vehicles: 'api/station_vehicles/[station_id]/[hhmm]'
    }

* *center_start:* initial coordinates
* *zoom_start:* initial zoom level
* *zoom_follow:* zoom level used to follow a vehicle
* *zoom_station:* zoom level used when clicking on a station
* *zoom_mouseover_min:* minimum zoom level where mousover vehicles shows an info panel
* *ft_id_mask:* Fusion Table ID containing the simulation mask (optional but cool :) - example [FT #812706](http://www.google.com/fusiontables/DataSource?dsrcid=812706) . Check [this script](https://github.com/vasile/Mask-KML-polygons) if you are not sure how to generate one
* *ft_id_lines:* Fusion Table ID of the polylines layer - example [FT #1497331](http://www.google.com/fusiontables/DataSource?dsrcid=1497331)
* *ft_id_stations:* Fusion Table ID of the stations layer - example [FT #1497361](http://www.google.com/fusiontables/DataSource?dsrcid=1497361)
* *json_paths.edges:* [GeoJSON](http://geojson.org/geojson-spec.html#linestring) file containing the simulation polylines. 
	
	**Example:** [static/geojson/edges-sbb.json](https://github.com/vasile/vehicle-simulator/blob/master/static/geojson/edges-sbb.json)
  
  	Polyline(edge) description:
    
        "type": "Feature",
        "properties": {
        	"edge_id": "1731"
        },
        "geometry": {
        	"type": "LineString",
            "coordinates": [ [9.131931, 47.65992], … ]
        }
        
     * *properties.edge_id:* polyline unique ID
     * *geometry.coordinates:* array of longitude, latitude pairs for each vertex of the polyline

  **Please note** that FT layers are used just for rendering the train lines on the map; to move the vehicles on the map, the json_paths.edges coordinates are used to accomplish this task.

* *json_paths.stations:* GeoJSON file containing the simulation stations.

    **Example:** [static/geojson/stations-sbb.json](https://github.com/vasile/vehicle-simulator/blob/master/static/geojson/stations-sbb.json) 
    
  	Station description:
        
        "type":"Feature",
        "properties": {
            "station_id": 8503000,
            "name": "Zürich HB"
        },
        "geometry": {
            "type": "Point",
            "coordinates": [ 8.53947,47.378777 ]
        }

    * *properties.station_id:* station unique ID
    * *properties.name:* station name
    * *geometry.coordinates:* pair for longitude, latitude of the station


* *json_paths.vehicles:* JSON file containing the vehicles running at given time (hhmm format)

    **Example:** [api/vehicles/[hhmm]](https://github.com/vasile/vehicle-simulator/blob/master/api/vehicles/0900.json) 
    
    Where a vehicle looks like:
        
        "id"    : "7974",
        "name"  : "S1821817",
        "type"  : "s",
        "sts"   : [8502007, 8502011, 8502008, 8502009, 8502020, 8502012, 8502028, 8502021, 8505000],
        "deps"  : [31680, 31815, 31935, 32220, 32415, 32595, 32820, 32895],
        "arrs"  : [31800, 31920, 32160, 32400, 32580, 32760, 32880, 33300],
        "edges" : ["", "-511", "-510", "-513", "-514", "-515", "-516,-2040", "-518", "-517,-433,-552,-551,160"]

    * *id:* vehicle unique ID
    * *name:* vehicle name
    * *type:* the vehicle type, used later for the vehicle icon, i.e. [images/vehicle-types/r.png](https://github.com/vasile/vehicle-simulator/blob/master/static/images/vehicle-types/r.png)
    * *sts:* vehicle station IDs
    * *deps:* vehicle departures computed in seconds from midnight. For example 31680 = 08:48.
    * *arrs:* vehicle arrivals computed in seconds from midnight
    * *edges:* the polylines used to reach the previous staton. Negative value means that the polyline is used against its original direction. For example, in the example above from 8502007(Sursee) to 8502007(Oberkirch LU), the polyline 511 is used, but with direction inverted

* *json_paths.station_vehicles:* JSON file containing the vehicles departing from a station given by *station_id* running at the time given by *hhmm*

    **Example:** [api/station_vehicles/[station_id]/[hhmm]](https://github.com/vasile/vehicle-simulator/blob/master/api/station_vehicles/8507000/0900.json) 
    
    Where a vehicle looks like:
        
        "id": "1015",
        "name": "IR 2517",
        "dep": "32400",
        "st_b": "8505000"

    * *id:* vehicle unique ID
    * *name:* vehicle name
    * *dep:* vehicle departure from the station computed in seconds from midnight. For example 31680 = 08:48.
    * *st_b:* final destination id

Next steps after you are able to generate these APIs programmatically:

* change the vehicle API URLs to use [station_id], [hhmm] parameters (see the comments in the config file)
* change the '09:00:00' custom time
    timer.init(config.getUserParam('hms'));


## Stay in touch
- project updates are published [here](http://blog.vasile.ch/tag/swisstrains)

- just contact [me](http://www.vasile.ch) in case you need further assistance or have other questions. 

### Have fun !