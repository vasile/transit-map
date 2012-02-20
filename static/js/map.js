/*global $, google, InfoBox */
var simulation_manager = (function(){
    var config = (function(){
        var params = {
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
                stations: 'feed/stations/sbb/list',
                vehicles: 'feed/vehicles/sbb/[hhmm]',
                station_vehicles: 'feed/station_vehicles/sbb/[station_id]/[hhmm]'
            }
        };
        
        var user_params = {};
        var url_parts = window.location.href.split('?');
        if (url_parts.length === 2) {
            var queryparam_groups = url_parts[1].split('&');
            $.each(queryparam_groups, function(index, queryparams_group){
                var queryparam_parts = queryparams_group.split('=');
                user_params[queryparam_parts[0]] = decodeURIComponent(queryparam_parts[1]);
            });
        }
        
        return {
            getParam: function(p) {
                return params[p];
            },
            getUserParam: function(p) {
                return typeof user_params[p] === 'undefined' ? null : user_params[p];
            }
        };
    })();
    
    var map = null;
    
    var simulation_vehicles = {};
    
    var listener_helpers = (function(){
        var listeners = {};
        
        function notify(type) {
            if (listeners[type] === 'undefined') {
                return;
            }
            
            $.each(listeners[type], function(i, fn){
                fn();
            });
        }

        function subscribe(type, fn) {
            if (typeof listeners[type] === 'undefined') {
                listeners[type] = [];
            }
            
            listeners[type].push(fn);
        }
        
        return {
            notify: notify,
            subscribe: subscribe
        };
    })();
    
    var stationsPool = (function(){
        var stations = {};
        
        function get(id) {
            return (typeof stations[id]) === 'undefined' ? '' : stations[id].get('name');
        }
        
        function location_get(id) {
            return (typeof stations[id]) === 'undefined' ? '' : stations[id].get('location');
        }
        
        function add(id, name, x, y) {
            var station = new google.maps.MVCObject();
            station.set('name', name);

            if (parseInt(x, 10) === 0) {
                station.set('location', null);
            } else {
                station.set('location', new google.maps.LatLng(parseFloat(y), parseFloat(x)));
            }
            
            stations[id] = station;
        }
        
        return {
            get: get,
            add: add,
            location_get: location_get
        };
    })();

    // Routes manager.
    // Roles:
    // - keep a reference for the routes between stations
    //      i.e. (Zürich HB-Bern, Zürich HB-Olten, Olten-Bern)
    //      Note: one route can contain one or more edges (the low-level entity in the simulation graph)
    // - interpolate position at given percent along a route
    var linesPool = (function() {
        var network_lines = {};
        var routes = {};
        var route_highlight = new google.maps.Polyline({
            path: [],
            strokeColor: "#FDD017",
            strokeOpacity: 0.8,
            strokeWeight: 5,
            map: null,
            ids: null
        });
        
        // TODO - that can be a nice feature request for google.maps.geometry lib
        function positionOnRouteAtPercentGet(a, b, perc) {
            var route = routes[a + '_' + b];
            
            var dC = 0;
            var dAC = route.length*perc;
            
            for (var i=1; i<route.points.length; i++) {
                var pA = route.points[i-1];
                var pB = route.points[i];
                var d12 = google.maps.geometry.spherical.computeDistanceBetween(pA, pB);
                if ((dC + d12) > dAC) {
                    return google.maps.geometry.spherical.interpolate(pA, pB, (dAC - dC)/d12);
                }
                dC += d12;
            }
            
            return null;
        }
        
        function routeAdd(a, b, edges) {
            if (typeof routes[a + '_' + b] !== 'undefined') {
                return;
            }
            
            var routePoints = [];
            $.each(edges, function(k, edgeID) {
                var points = network_lines[Math.abs(edgeID)];
                if (edgeID < 0) {
                    // slice() to the resue, otherwise reverse will alter network_lines
                    points = points.slice().reverse();
                }
                // TODO - use some MVCArray magic to remove the last element of edges when concatenating ?
                routePoints = routePoints.concat(points);
            });
            
            var routeLength = google.maps.geometry.spherical.computeLength(routePoints).toFixed(3);
            
            routes[a + '_' + b] = {
                'points': routePoints,
                'length': routeLength
            };
        }
        
        function lengthGet(a, b) {
            return routes[a + '_' + b].length;
        }
        
        function routeHighlight(station_ids) {
            if (route_highlight.get('ids') === station_ids.join(',')) { return; }
            route_highlight.set('ids', station_ids.join(','));
            
            var points = [];
            $.each(station_ids, function(index, id){
                if (index === 0) { return; }
                points = points.concat(routes[station_ids[index-1] + '_' + id].points);
            });
            
            route_highlight.setPath(points);
            route_highlight.setMap(map);
        }
        
        function routeHighlightRemove() {
            route_highlight.setMap(null);
            route_highlight.set('ids', null);
        }
        
        function loadEncodedEdges(edges) {
            $.each(edges, function(index, encoded_edge) {
                network_lines[index] = google.maps.geometry.encoding.decodePath(encoded_edge);
            });
        }
        
        return {
            positionGet: positionOnRouteAtPercentGet,
            routeAdd: routeAdd,
            lengthGet: lengthGet,
            routeHighlight: routeHighlight,
            routeHighlightRemove: routeHighlightRemove,
            loadEncodedEdges: loadEncodedEdges
        };
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
            // TODO - Round seconds to minutes, can be done nicer ?
            dayS = (dayS/60).toFixed(0)*60;
            var hms = s2hms(dayS);
            return hms.substr(0, 5);
        }
        
        return {
            hms2s: hms2s,
            s2hms: s2hms,
            s2hm: s2hm
        };
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
            if (hms !== null) {
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
        };
    })();
    
    var simulation_panel = (function(){
        var selected_vehicle = null;
        
        function Toggler(el_id) {
            var el = $(el_id);
            el.attr('data-value-original', el.val());
            
            var subscriber_types = {
                'enable': [function(){
                    el.addClass('toggled');
                    el.val(el.attr('data-value-toggle'));
                }],
                'disable': [function(){
                    el.removeClass('toggled');
                    el.val(el.attr('data-value-original'));
                }]
            };
            this.subscriber_types = subscriber_types;
            
            el.click(function(){
                var subscribers = el.hasClass('toggled') ? subscriber_types.disable : subscriber_types.enable;
                $.each(subscribers, function(index, fn){
                    fn();
                });
            });
        }
        Toggler.prototype.subscribe = function(type, fn) {
            this.subscriber_types[type].push(fn);
        };
        Toggler.prototype.trigger = function(type) {
            $.each(this.subscriber_types[type], function(index, fn){
                fn();
            });
        };
        
        var vehicle_follow = (function(){
            var toggler;
            function init() {
                toggler = new Toggler('#follow_trigger');
                toggler.subscribe('enable', function(){
                    selected_vehicle.marker.set('follow', 'yes-init');
                });
                toggler.subscribe('disable', function(){
                    if (selected_vehicle) {
                        selected_vehicle.marker.set('follow', 'no');
                    }
                    map.unbind('center');
                });
            }
            
            function start(vehicle) {
                selected_vehicle = vehicle;
                toggler.trigger('enable');
            }
            
            function stop() {
                toggler.trigger('disable');
            }
            
            return {
                init: init,
                start: start,
                stop: stop
            };
        })();
        
        var vehicle_route = (function(){
            var toggler;
            
            function init() {
                toggler = new Toggler('#route_show_trigger');
                toggler.subscribe('enable', function(){
                    linesPool.routeHighlight(selected_vehicle.stations);
                });
                toggler.subscribe('disable', function(){
                    linesPool.routeHighlightRemove();
                });
            }
            
            function hide() {
                toggler.trigger('disable');
            }
            
            return {
                init: init,
                hide: hide
            };
        })();
        
        function station_info_hide() {
            $('#station_info').addClass('hidden');
        }
        
        function vehicle_info_display(vehicle) {
            if ((selected_vehicle !== null) && (selected_vehicle.id === vehicle.id)) {
                if (selected_vehicle.marker.get('follow') === 'no') {
                    vehicle_follow.start(selected_vehicle);
                }
                if (selected_vehicle.marker.get('follow') === 'yes') {
                    vehicle_follow.stop();
                }
                return;
            }
            selected_vehicle = vehicle;
            
            vehicle_follow.stop();
            station_info_hide();

            $('.vehicle_name', $('#vehicle_info')).text(vehicle.name);
            
            var hms = timer.getTime();
            if (vehicle.has_multiple_days && (hms < vehicle.depS[0])) {
                hms += 24 * 3600;
            }
            
            var html_rows = [];
            $.each(vehicle.stations, function(index, stop_id) {
                var s_dep = (typeof vehicle.depS[index] === 'undefined') ? "n/a" : vehicle.depS[index];
                var html_row = '<tr data-dep-sec="' + s_dep + '"><td>' + (index + 1) + '.</td>';
                
                var station_location = stationsPool.location_get(stop_id);
                if (station_location === null) { 
                    html_row += '<td>' + stationsPool.get(stop_id) + '</td>';
                } else {
                    html_row += '<td><a href="#station_id=' + stop_id + '" data-station-id="' + stop_id + '">' + stationsPool.get(stop_id) + '</a></td>';
                }
                
                var hm_arr = (typeof vehicle.arrS[index - 1] === 'undefined') ? '' : time_helpers.s2hm(vehicle.arrS[index - 1]);
                html_row += '<td>' + hm_arr + '</td>';

                var hm_dep = (typeof vehicle.depS[index] === 'undefined') ? '' : time_helpers.s2hm(vehicle.depS[index]);
                html_row += '<td>' + hm_dep + '</td></tr>';

                html_rows.push(html_row);
            });
            
            $('#vehicle_timetable > tbody').html(html_rows.join(''));
            $('#vehicle_timetable tbody tr').each(function(){
                var row_dep_sec = $(this).attr('data-dep-sec');
                if (row_dep_sec === "n/a") {
                    return;
                }
                if (row_dep_sec < hms) {
                    $(this).addClass('passed');
                }
            });
            
            $('#vehicle_info').removeClass('hidden');
        }
        
        function vehicle_info_hide() {
            vehicle_follow.stop();
            vehicle_route.hide();
            selected_vehicle = null;
            $('#vehicle_info').addClass('hidden');
        }
        
        function station_info_display(station_id) {
            var url = config.getParam('json_paths').station_vehicles;
            url = url.replace(/\[station_id\]/, station_id);
            url = url.replace(/\[hhmm\]/, timer.getHM());
            
            $.ajax({
                url: url,
                dataType: 'json',
                success: function(vehicles) {
                    vehicle_info_hide();

                    var html_rows = [];
                    $.each(vehicles, function(index, vehicle) {
                        var html_row = '<tr><td>' + (index + 1) + '.</td>';
                        if (typeof simulation_vehicles[vehicle.id] === 'undefined') {
                            html_row += '<td>' + vehicle.name + '</td>';
                        } else {
                            html_row += '<td><a href="#vehicle_id=' + vehicle.id + '" data-vehicle-id="' + vehicle.id + '">' + vehicle.name + '</a></td>';
                        }
                        
                        html_row += '<td>' + stationsPool.get(vehicle.st_b) + '</td>';
                        html_row += '<td>' + time_helpers.s2hm(vehicle.dep) + '</td>';
                        html_rows.push(html_row);
                    });
                    $('#station_departures > tbody').html(html_rows.join(''));

                    $('#station_info').removeClass('hidden');
                    $('.station_name', $('#station_info')).text(stationsPool.get(station_id));
                }
            });
        }
        
        function init() {
            vehicle_follow.init();
            vehicle_route.init();
            
            $('#station_departures tbody tr a').live('click', function(){
                var vehicle_id = $(this).attr('data-vehicle-id');

                var vehicle = simulation_vehicles[vehicle_id];
                simulation_panel.displayVehicle(vehicle);
                simulation_panel.followVehicle(vehicle);

                return false;
            });
            
            $('#vehicle_timetable tbody tr a').live('click', function(){
                var station_id = $(this).attr('data-station-id');
                var station_location = stationsPool.location_get(station_id);
                if (station_location === null) { return; }
                
                map.setCenter(station_location);
                map.setZoom(config.getParam('zoom_station'));
                
                vehicle_info_hide();
                station_info_display(station_id);
                
                return false;
            });
            
            var location_el = $('#user_location');
            location_el.attr('value-default', location_el.attr('value'));

            var geocoder = new google.maps.Geocoder();
            function geocoding_handle(params) {
                geocoder.geocode(params, function(results, status) {
                    if (status === google.maps.GeocoderStatus.OK) {
                        location_el.val(results[0].formatted_address);
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
                if(e.which === 13) {
                    geocoding_handle({'address': $(this).val()});
                }
            });

            $('input.panel_collapsible').click(function() {
                var panel_content = $(this).closest('div[data-type="panel"]').children('div.panel_content');

                if ($(this).hasClass('expanded')) {
                    $(this).removeClass('expanded');
                    panel_content.addClass('hidden');
                } else {
                    $(this).addClass('expanded');
                    panel_content.removeClass('hidden');
                }
            });
        }
        
        return {
            init: init,
            displayVehicle: vehicle_info_display,
            followVehicle: vehicle_follow.start,
            displayStation: station_info_display
        };
    })();
    
    function map_init(){
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
        
        var map_inited = false;
        var map_options = {
            zoom: config.getParam('zoom_start'),
            center: config.getParam('center_start'),
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            styles: mapStyles,
            disableDefaultUI: true,
            zoomControl: true,
            scaleControl: true,
            streetViewControl: true,
            overviewMapControl: true
        };

        if (config.getUserParam('x') !== null) {
            map_options.center = new google.maps.LatLng(parseFloat(config.getUserParam('y')), parseFloat(config.getUserParam('x')));
            map_options.zoom = config.getParam('zoom_follow');
            map_options.mapTypeId = google.maps.MapTypeId.SATELLITE;
        }
        
        map = new google.maps.Map(document.getElementById("map_canvas"), map_options);
        
        map.setOptions({
            mapTypeControl: true,
            mapTypeControlOptions: {
                position: google.maps.ControlPosition.TOP_LEFT
            }
        });
        
        function map_layers_add(){
            var edges_layer = new google.maps.FusionTablesLayer({
                query: {
                    select: 'geometry',
                    from: config.getParam('ft_id_lines')
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
                from: config.getParam('ft_id_stations')
              },
              suppressInfoWindows: true,
              map: map
            });
            google.maps.event.addListener(stations_layer, 'click', function(ev){
                var station_id = ev.row.id.value;
                simulation_panel.displayStation(station_id);
            });
            
            var layer = new google.maps.FusionTablesLayer({
              query: {
                select: 'geometry',
                from: config.getParam('ft_id_mask')
              },
              clickable: false,
              map: map
            });

            function trigger_toggleLayerVisibility() {
                function toggleLayerVisibility(layer, show) {
                    if (show) {
                        if (layer.getMap() === null) {
                            layer.setMap(map);
                        }
                    } else {
                        if (layer.getMap() !== null) {
                            layer.setMap(null);
                        }
                    }
                }

                var zoom = map.getZoom();
                toggleLayerVisibility(stations_layer, zoom >= 12);            
            }

            google.maps.event.addListener(map, 'idle', trigger_toggleLayerVisibility);
            trigger_toggleLayerVisibility();
        }
        
        google.maps.event.addListener(map, 'idle', function() {
            if (map_inited === false) {
                // TODO - FIXME later ?
                // Kind of a hack, getBounds is ready only after a while since loading, so we hook in the 'idle' event
                map_inited = true;
                
                map_layers_add();
                listener_helpers.notify('map_init');
            }
        });
    }

    // Vehicle helpers
    // Roles:
    // - check backend for new vehicles
    // - manages vehicle objects(class Vehicle) and animates them (see Vehicle.render method)
    var vehicle_helpers = (function(){
        var vehicle_detect = (function(){
            var track_vehicle_name = config.getUserParam('vehicle_name');
            if (track_vehicle_name !== null) {
                track_vehicle_name = track_vehicle_name.replace(/[^A-Z0-9]/i, '');
            }
            
            var track_vehicle_id = config.getUserParam('vehicle_id');
            
            function match_by_name(vehicle_name) {
                if (track_vehicle_name === null) {
                    return false;
                }

                vehicle_name = vehicle_name.replace(/[^A-Z0-9]/i, '');
                if (track_vehicle_name !== vehicle_name) {
                    return false;
                }

                return true;
            }
            
            function match(vehicle_name, vehicle_id) {
                if (track_vehicle_id === vehicle_id) {
                    return true;
                }
                
                return match_by_name(vehicle_name);
            }
            
            listener_helpers.subscribe('vehicles_load', function(){
                if (config.getUserParam('action') !== 'vehicle_add') {
                    return;
                }
                
                function str_hhmm_2_sec_ar(str_hhmm) {
                    var sec_ar = [];
                    $.each(str_hhmm.split('_'), function(index, hhmm){
                        var hhmm_matches = hhmm.match(/([0-9]{2})([0-9]{2})/);
                        sec_ar.push(time_helpers.hms2s(hhmm_matches[1] + ':' + hhmm_matches[2] + ':00'));
                    });
                    return sec_ar;
                }
                
                var station_ids = config.getUserParam('station_ids').split('_');
                $.each(station_ids, function(index, station_id_s){
                    station_ids[index] = station_id_s;
                });
                
                var vehicle_data = {
                    arrs: str_hhmm_2_sec_ar(config.getUserParam('arrs')),
                    deps: str_hhmm_2_sec_ar(config.getUserParam('deps')),
                    id: 'custom_vehicle',
                    name: decodeURIComponent(config.getUserParam('vehicle_name')),
                    sts: station_ids,
                    type: config.getUserParam('vehicle_type'),
                    edges: []
                };
                
                var v = new Vehicle(vehicle_data);
                v.render();
                simulation_vehicles[vehicle_data.id] = v;
                
                simulation_panel.displayVehicle(v);
                simulation_panel.followVehicle(v);
            });
            
            return {
                match: match
            };
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
            };
        })();

        var vehicle_ib = new InfoBox({
            disableAutoPan: true,
            pixelOffset: new google.maps.Size(10, 10),
            vehicle_id: 0,
            closeBoxURL: ''
        });
        
        var vehicleIDs = [];

        function Vehicle(params) {
            var has_multiple_days = params.arrs[params.arrs.length - 1] > 24 * 3600;

            this.id                 = params.id;
            this.name               = params.name;
            this.stations           = params.sts;
            this.depS               = params.deps;
            this.arrS               = params.arrs;
            this.has_multiple_days  = has_multiple_days;
            
            $.each(params.edges, function(index, edges) {
                if (index === 0) { return; }
                linesPool.routeAdd(params.sts[index-1], params.sts[index], edges.split(','));
            });

            var marker = new google.maps.Marker({
                position: new google.maps.LatLng(0, 0),
                icon: imagesPool.iconGet(params.type),
                map: null,
                speed: 0,
                status: 'not on map'
            });
            this.marker = marker;
            
            // TODO - FIXME .apply
            var that = this;

            google.maps.event.addListener(marker, 'click', function() {
                simulation_panel.displayVehicle(that);
            });

            google.maps.event.addListener(marker, 'mouseover', function(){
                if (map.getZoom() < config.getParam('zoom_mouseover_min')) {
                    return;
                }

                if (vehicle_ib.get('vehicle_id') === params.id) { return; }
                vehicle_ib.set('vehicle_id', params.id);

                vehicle_ib.close();

                var popup_div = $('#vehicle_popup');
                $('span.vehicle_name', popup_div).text(params.name);
                $('.status', popup_div).text(marker.get('status'));

                vehicle_ib.setContent($('#vehicle_popup_container').html());
                vehicle_ib.open(map, marker);
            });
            google.maps.event.addListener(marker, 'mouseout', function(){
                vehicle_ib.set('vehicle_id', null);
                vehicle_ib.close();
            });
            
            if (vehicle_detect.match(this.name, this.id)) {
                simulation_panel.displayVehicle(this);
                simulation_panel.followVehicle(this);
            }
        }
        Vehicle.prototype.render = function() {
            // TODO - FIXME .apply
            var that = this;
            
            function animate() {
                var hms = timer.getTime();
                if (that.has_multiple_days && (hms < that.depS[0])) {
                    hms += 24 * 3600;
                }

                var vehicle_found = false;
                for (var i=0; i<that.arrS.length; i++) {
                    if (hms < that.arrS[i]) {
                        var station_a = that.stations[i];
                        var station_b = that.stations[i+1];

                        var vehicle_position = null;

                        if (hms > that.depS[i]) {
                            // Vehicle is in motion between two stations
                            vehicle_found = true;
                            if (that.marker.get('speed') === 0) {
                                var speed = linesPool.lengthGet(station_a, station_b) * 0.001 * 3600 / (that.arrS[i] - that.depS[i]);
                                that.marker.set('speed', parseInt(speed, 10));
                                that.marker.set('status', 'Heading to ' + stationsPool.get(station_b) + '(' + time_helpers.s2hm(that.arrS[i]) + ') with ' + that.marker.get('speed') + ' km/h');
                            }

                            var route_percent = (hms - that.depS[i])/(that.arrS[i] - that.depS[i]);

                            vehicle_position = linesPool.positionGet(station_a, station_b, route_percent);
                            if (vehicle_position === null) {
                                console.log('Couldn\'t get the position of ' + that.id + ' between stations: ' + [station_a, station_b]);
                                that.marker.setMap(null);
                                break;
                            }
                        } else {
                            // Vehicle is in a station
                            vehicle_found = true;
                            that.marker.set('status', 'Departing ' + stationsPool.get(station_a) + ' at ' + time_helpers.s2hm(that.depS[i]));
                            that.marker.set('speed', 0);

                            vehicle_position = stationsPool.location_get(station_a);
                            if (vehicle_position === null) {
                                console.log('Vehicle ' + that.name + ' is in a station without coordinates: ' + stationsPool.get(station_a) + '(' + station_a + ')');
                                break;
                            }
                        }
                        
                        if (that.marker.get('follow') === 'yes-init') {
                            that.marker.set('follow', 'yes');
                            
                            that.marker.setMap(map);
                            that.marker.setPosition(vehicle_position);
                            
                            map.panTo(vehicle_position);
                            map.setZoom(config.getParam('zoom_follow'));
                            map.setMapTypeId('satellite');

                            map.bindTo('center', that.marker, 'position');
                        }
                        
                        if (map.getBounds().contains(vehicle_position)) {
                            if (that.marker.getMap() === null) {
                                that.marker.setMap(map);
                            }
                            that.marker.setPosition(vehicle_position);
                        } else {
                            that.marker.setMap(null);
                        }

                        setTimeout(animate, 1000);
                        break;
                    }
                } // end arrivals loop

                if (vehicle_found === false) {
                    that.marker.setMap(null);
                }
            }
            
            animate();
        };

        return {
            load: function() {
                var url = config.getParam('json_paths').vehicles;
                url = url.replace(/\[hhmm\]/, timer.getHM());
                
                $.ajax({
                    url: url,
                    dataType: 'json',
                    success: function(vehicles) {
                        $.each(vehicles, function(index, data) {
                            if (typeof simulation_vehicles[data.id] !== 'undefined') {
                                return;
                            }
                            
                            var v = new Vehicle(data);
                            v.render();

                            simulation_vehicles[data.id] = v;
                        });
                        
                        listener_helpers.notify('vehicles_load');
                    }
                });
            }
        };
    })();
    
    listener_helpers.subscribe('map_init', function(){
        // LOAD network lines 
        $.ajax({
            url: config.getParam('json_paths').edges,
            dataType: 'json',
            success: function(edges) {
                linesPool.loadEncodedEdges(edges);
                
                // network lines loaded => LOAD stations
                $.ajax({
                    url: config.getParam('json_paths').stations,
                    dataType: 'json',
                    success: function(stations_data) {
                        $.each(stations_data, function(index, station) {
                            stationsPool.add(parseInt(station.id, 10), station.name, parseFloat(station.x), parseFloat(station.y));
                        });

                        // Stations loaded => LOAD vehicles
                        vehicle_helpers.load();
                        setInterval(vehicle_helpers.load, 5*60*1000);
                    }
                });
            }
        });
    });
    
    function ui_init() {
        var view_mode = config.getUserParam('view_mode');
        
        // Keep the UI clean (no additional DIVs) for IFRAME, mobile
        switch (view_mode) {
            case 'iframe':
                break;
            default:
                $('#panel').removeClass('hidden');
                break;
        }
    }
    
    return {
        subscribe: listener_helpers.subscribe,
        init: function(){
            ui_init();
            timer.init(config.getUserParam('hms'));
            map_init();
            simulation_panel.init();
        },
        getMap: function(){
            return map;
        }
    };
})();
    
$(document).ready(simulation_manager.init);
