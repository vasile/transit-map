var simulation_manager = (function(){
    var map = null;
    var is_mobile = (navigator.userAgent.indexOf('iPhone') !== -1) || (navigator.userAgent.indexOf('Android') != -1);
    
    var listeners = {
        map_init: []
    };
    
    function notify(type) {
        $.each(listeners[type], function(i, fn){
            fn();
        });
    }
    
    function subscribe(type, fn) {
        listeners[type].push(fn);
    }
    
    function setMap(o) {
        map = o;
    }
    
    function getMap() {
        return map;
    }
    
    function isMobile() {
        return is_mobile;
    }
    
    return {
        subscribe: subscribe,
        notify: notify,
        setMap: setMap,
        getMap: getMap,
        isMobile: isMobile
    }
})();

(function(){
    function map_layers_add(){
        var map = simulation_manager.getMap();
        
        var layer = null;
        layer = new google.maps.FusionTablesLayer({
            query: {
                select: 'geometry',
                from: '1497331'
            },
            clickable: false,
            map: map,
            styles: [
                {
                    polylineOptions: {
                        strokeColor: "#FF0000",
                        strokeWeight: 2
                    }
                },{
                    where: "type = 'tunnel'",
                    polylineOptions: {
                        strokeColor: "#FAAFBE",
                        strokeWeight: 1.5
                    }
                }
            ]
        });
        var stations_layer = new google.maps.FusionTablesLayer({
          query: {
            select: 'geometry',
            from: '1497361'
          },
          clickable: false,
          map: map
        });
        layer = new google.maps.FusionTablesLayer({
          query: {
            select: 'geometry',
            from: '812706'
          },
          clickable: false,
          map: map
        });
        
        google.maps.event.addListener(map, 'idle', function() {
            var zoom = map.getZoom();
            if (zoom < 12) {
                if (stations_layer.getMap() !== null) {
                    stations_layer.setMap(null);
                }
            } else {
                if (stations_layer.getMap() === null) {
                    stations_layer.setMap(map);
                }
            }
        });
    }
    
    simulation_manager.subscribe('map_init', map_layers_add);
})();

$(document).ready(function(){
    var map;
    var vehicle_ib = new InfoBox({
        disableAutoPan: true,
        pixelOffset: new google.maps.Size(10, 10),
        vehicle_id: 0
    });
    google.maps.event.addListener(vehicle_ib, 'closeclick', function(){
        linesPool.routeHighlightRemove();
    });
    
    var stationsPool = (function(){
        var stations = {};
        
        function get(id) {
            return typeof stations[id] === 'undefined' ? '' : stations[id];
        }
        
        function add(id, name) {
            stations[id] = name;
        }
        
        return {
            get: get,
            add: add
        }
    })();

    // Vehicle icons manager. 
    // Roles:
    // - keep a reference for each vehicle type (IC, ICE, etc..)
    var imagesPool = (function(){
        var icons = {};
        function iconGet(type) {
            if (typeof icons[type] !== 'undefined') {
                return icons[type];
            }

            var icon = new google.maps.MarkerImage(
                'static/images/vehicle-types/' + type + '.png',
                 new google.maps.Size(20, 20),
                 new google.maps.Point(0, 0),
                 new google.maps.Point(10, 10)
            );
            icons[type] = icon;

            return icon;
        }
        
        return {
            iconGet: iconGet
        }
    })();
    
    // Routes manager.
    // Roles:
    // - keep a reference for the routes between stations
    //      i.e. (Zürich HB-Bern, Zürich HB-Olten, Olten-Bern)
    //      Note: one route can contain one or more edges (the low-level entity in the simulation graph)
    // - interpolate position at given percent along a route
    var linesPool = (function() {
        var routes = {};
        var route_highlight_active = null;
        var route_highlight_polyline = new google.maps.Polyline({
            path: [],
            strokeColor: "#FDD017",
            strokeOpacity: 0.8,
            strokeWeight: 5,
            map: null
        });
        
        // TODO - that can be a nice feature request for google.maps.geometry lib
        function positionOnRouteAtPercentGet(a, b, perc) {
            var route = routes[a + '_' + b];
            
            var dC = 0;
            var dAC = route['length']*perc;
            
            for (var i=1; i<route['points'].length; i++) {
                var pA = route['points'][i-1];
                var pB = route['points'][i];
                var d12 = google.maps.geometry.spherical.computeDistanceBetween(pA, pB);
                if ((dC + d12) > dAC) {
                    return google.maps.geometry.spherical.interpolate(pA, pB, (dAC - dC)/d12);
                }
                dC += d12;
            }
            
            return null;
        }
        
        function routeExists(a, b) {
          return typeof routes[a + '_' + b] !== 'undefined';
        }
        
        function routeAdd(a, b, edges) {
            var routePoints = [];
            $.each(edges, function(k, edgeID) {
                var edge = simcity_topology_edges[Math.abs(edgeID)];
                
                var points = google.maps.geometry.encoding.decodePath(edge);
                if (edgeID < 0) {
                    points.reverse();
                }
                // TODO - use some MVCArray magic to remove the last element of edges when concatenating ?
                routePoints = routePoints.concat(points);
            });
            
            routeLength = google.maps.geometry.spherical.computeLength(routePoints).toFixed(3);
            
            routes[a + '_' + b] = {
                'points': routePoints,
                'length': routeLength
            };
        }
        
        function lengthGet(a, b) {
            return routes[a + '_' + b].length;
        }
        
        function routeHighlight(station_ids) {
            if (route_highlight_active === station_ids.join(',')) { return; }
            route_highlight_active = station_ids.join(',');
            
            var points = [];
            $.each(station_ids, function(index, id){
                if (index === 0) { return; }
                points = points.concat(routes[station_ids[index-1] + '_' + id].points);
            });
            
            route_highlight_polyline.setPath(points);
            route_highlight_polyline.setMap(map);
        }
        
        function routeHighlightRemove() {
            route_highlight_polyline.setMap(null);
            vehicle_ib.set('vehicle_id', null);
            route_highlight_active = null;
        }
        
        return {
            positionGet: positionOnRouteAtPercentGet,
            routeExists: routeExists,
            routeAdd: routeAdd,
            lengthGet: lengthGet,
            routeHighlight: routeHighlight,
            routeHighlightRemove: routeHighlightRemove
        }
    })();
    
    // Time helpers
    // Roles:
    // - convert seconds that passed from midnight into nicely formatted hh:mm:ss
    // and viceversa
    var time_helpers = (function(){
        function hms2s(hms) {
            var parts = hms.split(':');
            return parseInt(parts[0], 10)*3600 + parseInt(parts[1], 10)*60 + parseInt(parts[2], 10);
        }
        function s2hms(dayS) {
            function pad2Dec(what) {
                return (what < 10 ? '0' + what : what);
            }
            
            if (dayS >= 3600*24) {
                dayS -= 3600*24;
            }
            
            // From http://stackoverflow.com/questions/1322732/convert-seconds-to-hh-mm-ss-with-javascript
            var hours = Math.floor(dayS / 3600);
            dayS %= 3600;
            var minutes = Math.floor(dayS / 60);
            var seconds = dayS % 60;
            
            return pad2Dec(hours) + ':' + pad2Dec(minutes) + ':' + pad2Dec(seconds);
        }
        function s2hm(dayS) {
            var hms = s2hms(dayS);
            return hms.substr(0, 5);
        }
        
        return {
            hms2s: hms2s,
            s2hms: s2hms,
            s2hm: s2hm
        }
    })();

    // Time manager
    // Roles:
    // - manages the current number of seconds that passed since midnight
    // - 'init' can be used with given hh:mm:ss in order to simulate different timestamps
    var timer = (function(){
        var delay = 0;
        
        function getNow() {
            var now = new Date();

            var hours = now.getHours();
            var minutes = now.getMinutes();
            var seconds = now.getSeconds();
            
            return hours*3600 + minutes*60 + seconds;
        }
        
        function getDaySeconds() {
            return getNow() - delay;
        }
        
        function init(hms) {
            if (typeof(hms) !== 'undefined') {
                delay = getNow() - time_helpers.hms2s(hms);
            }
            
            var timeContainer = $('#day_time');
            function paintHM() {
                timeContainer.text(time_helpers.s2hms(getDaySeconds()));
            }
            
            setInterval(function(){
                paintHM();
            }, 1000);
        }
        
        function getHM() {
          var hms = time_helpers.s2hms(getDaySeconds());
          return hms.substring(0, 2) + hms.substring(3, 5);
        }
        
        return {
            init: init,
            getTime: getDaySeconds,
            getHM: getHM
        }
    })();
    
    // Map manager
    // Roles:
    // - initialize the map canvas with available layers (tracks, stations)
    // - styles the maps
    // - add map controls
    // - handle location lookups
    var map_helpers = (function(){
        function init() {
            var mapStyles = [
              {
                featureType: "poi.business",
                stylers: [
                  { visibility: "off" }
                ]
              },{
                featureType: "road",
                elementType: "labels",
                stylers: [
                  { visibility: "off" }
                ]
              },{
                featureType: "road",
                elementType: "labels",
                stylers: [
                  { visibility: "off" }
                ]
              },{
                featureType: "road",
                elementType: "geometry",
                stylers: [
                  { visibility: "simplified" },
                  { lightness: 70 }
                ]
              },{
                featureType: "transit.line",
                stylers: [
                  { visibility: "off" }
                ]
              },{
                featureType: "transit.station.bus",
                stylers: [
                  { visibility: "off" }
                ]
              }
            ];

            var start = new google.maps.LatLng(47.378057, 8.5402338);
            var myOptions = {
                zoom: 13,
                center: start,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                styles: mapStyles,
                disableDefaultUI: true,
                zoomControl: true,
                scaleControl: true,
                streetViewControl: true,
                overviewMapControl: true
            }
            map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
            
            map.setOptions({
                mapTypeControl: true,
                mapTypeControlOptions: {
                    position: google.maps.ControlPosition.TOP_LEFT
                }
            });
            
            google.maps.event.addListener(map, 'idle', function() {
                if (simulation_manager.getMap() === null) {
                    // TODO - FIXME later ?
                    // Kind of a hack, getBounds is ready only after a while since loading, so we hook in the 'idle' event
                    simulation_manager.setMap(map);
                    simulation_manager.notify('map_init');
                }
            });
            
            // START HANDLE LOCATION
            // TODO - find out why we need to put this before map_control part below
            var location_el = $('#user_location');
            location_el.attr('value-default', location_el.attr('value'));

            var geocoder = new google.maps.Geocoder();
            function geocoding_handle(params) {
                geocoder.geocode(params, function(results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        location_el.val(results[0].formatted_address.replace(/, Switzerland/, ''));
                        map.setCenter(results[0].geometry.location);
                        map.setZoom(15);
                    }
                });
            }
            
            $('#geolocation_click').click(function(){
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function (position) {
                        geocoding_handle({'latLng': new google.maps.LatLng(position.coords.latitude, position.coords.longitude)});
                    });
                }
            });
            location_el.focus(function(){
                if ($(this).val() === $(this).attr('value-default')) {
                    $(this).val('');
                }
            });
            location_el.keypress(function(e) {
                if(e.which == 13) {
                    geocoding_handle({'address': $(this).val()});
                }
            });
            // END
            
            var map_control = document.createElement('DIV');
            map_control.index = 1;
            map_control.appendChild($('#panel')[0]);
            map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(map_control);
        }
        
        return {
            init: init
        }
    })();
    
    // Vehicle helpers
    // Roles:
    // - check backend for new vehicles
    // - manages vehicle objects(class Vehicle) and animates them (see Vehicle.render method)
    var vehicle_helpers = (function(){
        var vehicleIDs = [];

        function Vehicle(params) {
            this.id             = params['id'];
            this.stations       = params['sts'];
            this.depS           = params['deps'];
            this.arrS           = params['arrs'];
            this.multiple_days  = params['arrs'][params['arrs'].length - 1] > 24 * 3600;
            
            $.each(params.edges, function(index, edges) {
                if (index === 0) { return; }

                if (linesPool.routeExists(params['sts'][index-1], params['sts'][index])) {
                    return;
                }

                linesPool.routeAdd(params['sts'][index-1], params['sts'][index], edges.split(','));
            });

            var marker = new google.maps.Marker({
                position: new google.maps.LatLng(0, 0),
                icon: imagesPool.iconGet(params['type']),
                map: null,
                speed: 0,
                status: 'not on map',
            });
            
            var vehicleName = params['name'] + ' (' + this.id + ')';
            var vehicleFromTo = stationsPool.get(this.stations[0]);
            vehicleFromTo += '(' + time_helpers.s2hm(this.depS[0]) + ')';
            vehicleFromTo += ' - ';
            vehicleFromTo += stationsPool.get(this.stations[this.stations.length-1]);
            vehicleFromTo += '(' + time_helpers.s2hm(this.arrS[this.arrS.length-1]) + ')';
            
            google.maps.event.addListener(marker, 'mouseover', function() {
                if (vehicle_ib.get('vehicle_id') === params['id']) { return; }
                vehicle_ib.set('vehicle_id', params['id']);
                
                vehicle_ib.close();
                
                var popup_div = $('#vehicle_popup');
                $('.name', popup_div).text(vehicleName);
                $('.fromto', popup_div).text(vehicleFromTo);
                $('.status', popup_div).text(marker.get('status'));
                $('.speed', popup_div).text(marker.get('speed') + ' km/h');
                
                vehicle_ib.setContent($('#vehicle_popup_container').html());
                vehicle_ib.open(map, marker);
                
                linesPool.routeHighlight(params['sts']);
            });
            
            this.marker = marker;
        }
        Vehicle.prototype.render = function() {
            function animate() {
                var hms = timer.getTime();
                if (that.multiple_days && (hms < that.depS[0])) {
                    hms += 24 * 3600;
                }
                
                var vehicle_found = false;
                for (var i=0; i<that.arrS.length; i++) {
                    if (hms < that.arrS[i]) {
                        var station_a = that.stations[i];
                        var station_b = that.stations[i+1];
                        
                        if (hms > that.depS[i]) {
                            // Vehicle is in motion between two stations
                            vehicle_found = true;
                            if (that.marker.get('speed') === 0) {
                                that.marker.set('status', 'Next stop: ' + stationsPool.get(station_b) + '(' + time_helpers.s2hm(that.arrS[i]) + ')');

                                var speed = linesPool.lengthGet(station_a, station_b) * 0.001 * 3600 / (that.arrS[i] - that.depS[i]);
                                that.marker.set('speed', parseInt(speed, 10));
                            }
                            
                            var route_percent = (hms - that.depS[i])/(that.arrS[i] - that.depS[i]);

                            var pos = linesPool.positionGet(station_a, station_b, route_percent);
                            if (pos === null) {
                                console.log('Couldn\'t get the position of ' + that.id + ' between stations: ' + [station_a, station_b]);
                                that.marker.setMap(null);
                                break;
                            } else {
                                if (map.getBounds().contains(pos)) {
                                    if (that.marker.getMap() === null) {
                                        that.marker.setMap(map);
                                    }
                                    that.marker.setPosition(pos);
                                } else {
                                    that.marker.setMap(null);
                                }                                
                            }

                            setTimeout(animate, 500);
                        } else {
                            // Vehicle is in a station
                            vehicle_found = true;
                            that.marker.set('status', 'Departing ' + stationsPool.get(station_a) + ' at ' + time_helpers.s2hm(that.depS[i]));
                            that.marker.set('speed', 0);

                            if (that.marker.getMap() === null) {
                                var pos = linesPool.positionGet(station_a, station_b, 0);
                                that.marker.setPosition(pos);
                                that.marker.setMap(map);
                            }

                            var seconds_left = that.depS[i] - hms;
                            setTimeout(animate, seconds_left*1000);
                        }
                        break;
                    }
                } // end arrivals loop
                
                if (vehicle_found === false) {
                    that.marker.setMap(null);
                }
            }

            var that = this;
            animate();
        };

        return {
            get: function() {
                $.ajax({
                    url: 'feed/vehicles/sbb/' + timer.getHM(),
                    dataType: 'json',
                    success: function(vehicles) {
                        $.each(vehicles, function(index, data) {
                            if (vehicleIDs.indexOf(data['id']) !== -1) { return; }

                            var v = new Vehicle(data);
                            v.render();
                            vehicleIDs.push(data['id']);
                        });
                    }
                });
            }
        }
    })();
    
    // END HELPERS

    simulation_manager.subscribe('map_init', function(){
        vehicle_helpers.get();
        setInterval(vehicle_helpers.get, 5*60*1000);
    });
    
    $.ajax({
        url: 'feed/stations/sbb/list',
        dataType: 'json',
        success: function(stations_data) {
            $.each(stations_data, function(index, station) {
                stationsPool.add(parseInt(station['id'], 10), station['name']);
            });
        }
    });
    
    timer.init();
    map_helpers.init();
});