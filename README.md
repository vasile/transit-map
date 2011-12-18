## About
Vehicle simulator creates a Google Maps mashup with animated markers(vehicles) that are moving according with given timetables along polylines(vehicle tracks). 

Projects that are using this script

* [Swiss Railways(SBB)](http://www.sbb.ch/en/home.html) network simulator - http://simcity.vasile.ch/sbb/
* [Romanian Railways(CFR)](http://www.infofer.ro/) network simulator - http://cfr.webgis.ro/

## Requirements

* a webserver(i.e. Apache)

## Usage

* clone the project in a location that can be accessible via your webserver (i.e. ~/Sites/)
* access the project in your browser (i.e. [http://localhost/vehicle-simulator/map.html](http://localhost/vehicle-simulator/map.html) ). 

You should already see some action on the map !

## Customize the project with your area
### Vehicle tracks

The network used for [Swisstrains v2](http://simcity.vasile.ch/sbb/) consists of two type of entities: 

* points(stations) - see [FT #1497361](http://www.google.com/fusiontables/DataSource?dsrcid=1497361)
* polylines(tracks) - see [FT #1497331](http://www.google.com/fusiontables/DataSource?dsrcid=1497331)

These are rendered via map_layers_add from `static/js/map.js`, so this is the place to insert/customize your own map layers. 

In addition, the polylines coordinates are exported as [Encoded Polyline](http://code.google.com/apis/maps/documentation/utilities/polylinealgorithm.html) format and stored in `static/js/edges_encoded.js`. 

The simulation use the coordinates from this file to move the vehicles along, so is important to contain all the polylines that your project will use. 

### Timetables
For demo purposes, this project use the SBB timetables from '09:00', that are cached in `api/vehicles/0900.json`. The JS format of one vehicle is:

    "id"    : "7974",
    "name"  : "S1821817",
    "type"  : "s",
    "sts"   : [8502007, 8502011, 8502008, 8502009, 8502020, 8502012, 8502028, 8502021, 8505000],
    "deps"  : [31680, 31815, 31935, 32220, 32415, 32595, 32820, 32895],
    "arrs"  : [31800, 31920, 32160, 32400, 32580, 32760, 32880, 33300],
    "edges" : ["", "-511", "-510", "-513", "-514", "-515", "-516,-2040", "-518", "-517,-433,-552,-551,160"]

The important keys are

* type: the vehicle type, used later for the vehicle icon, i.e. [images/vehicle-types/r.png](http://simcity.vasile.ch/sbb/static/images/vehicle-types/r.png)
* sts: vehicle station IDs (see [FT #1497361](http://www.google.com/fusiontables/DataSource?dsrcid=1497361))
* deps: vehicle departures computed in seconds from midnight. 
For example 31680 = 08:48
* arrs: vehicle arrivals computed in seconds from midnight
* edges: the polylines used to reach the previous staton. Negative value means that the polyline is used against its original direction. 

For example, in the example above from 8502007(Sursee) to 8502007(Oberkirch LU), the polyline 511 is used, but with direction inverted

Once you are able to generate a JSON file with this format, you can:

* change the vehicle API URL to the new one. Check vehicle_helpers.get() in `static/js/map.js`
* initialize the demo without custom time. Look in `static/js/map.js` 
for timer.init() call and remove the argument


### Stay in touch
- project updates are published [here](http://blog.vasile.ch/tag/swisstrains)

- just contact [me](http://www.vasile.ch) in case you need further assistance or have other questions. 

Have fun !