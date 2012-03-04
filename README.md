## About
Vehicle simulator creates a Google Maps mashup with animated markers(vehicles) that are moving according with given timetables along polylines(vehicle tracks). 

Projects that are using this script

* [Swiss Railways(SBB)](http://www.sbb.ch/en/home.html) network simulator - http://simcity.vasile.ch/sbb/
* [Romanian Railways(CFR)](http://www.infofer.ro/) network simulator - http://cfr.webgis.ro/
* [Lausanne (TL)](http://www.t-l.ch/) network simulator - http://simcity.vasile.ch/lausanne/

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
        edges: 'static/js/edges_encoded-sbb.js',
        stations: 'api/stations.json',
        vehicles: 'api/vehicles/[hhmm]'
        station_vehicles: 'api/station_vehicles/[station_id]/[hhmm]'
    }

* *center_start:* initial coordinates
* *zoom_start:* initial zoom level
* *zoom_follow:* zoom level used to follow a vehicle
* *zoom_station:* zoom level used when clicking on a station
* *zoom_mouseover_min:* minimum zoom level where mousover vehicles brings a panel
* *ft_id_mask:* Fusion Table ID containing the simulation mask (optional but cool :) - example [FT #812706](http://www.google.com/fusiontables/DataSource?dsrcid=812706) . Check [this script](https://github.com/vasile/Mask-KML-polygons) if you are not sure how to generate one
* *ft_id_lines:* Fusion Table ID of the polylines layer - example [FT #1497331](http://www.google.com/fusiontables/DataSource?dsrcid=1497331)
* *ft_id_stations:* Fusion Table ID of the stations layer - example [FT #1497361](http://www.google.com/fusiontables/DataSource?dsrcid=1497361)
* *json_paths.edges:* JSON file containing the simulation polylines. For now only [Encoded Polylines](http://code.google.com/apis/maps/documentation/utilities/polylinealgorithm.html) are supported. **Please note** that the FT layers are used just to render the lines, the actual coordinates for moving the vehicles along are in this JSON file. 

    **Example:** [static/js/edges_encoded-sbb.js](https://github.com/vasile/vehicle-simulator/blob/master/static/js/edges_encoded-sbb.js)

* *json_paths.stations:* JSON file containing the simulation stations.

    **Example:** [api/stations.json](https://github.com/vasile/vehicle-simulator/blob/master/api/stations.json) 
    
    Where a station looks like:
        
        "id": "8509197",
        "x": "9.746402",
        "y": "46.631779",
        "name": "Bergün/Bravuogn"

    * *id:* station unique ID
    * *x:* station longitude (decimal degrees)
    * *y:* station latitude (decimal degrees)
    * *name:* station name

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

Once you are able to generate these APIs programmatically, you can:

* change the vehicle API URLs to use [station_id], [hhmm] parameters (see the comments in the config file)
* change the '09:00:00' custom time
    timer.init(config.getUserParam('hms'));


### Stay in touch
- project updates are published [here](http://blog.vasile.ch/tag/swisstrains)

- just contact [me](http://twitter.com/vasile23) in case you need further assistance or have other questions. 

**Have fun !**