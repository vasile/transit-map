/*global $, google, InfoBox */
var simulation_manager = (function(){
    google.maps.visualRefresh = true;
    var ua_is_mobile = navigator.userAgent.indexOf('iPhone') !== -1 || navigator.userAgent.indexOf('Android') !== -1;
    
    var config = (function(){
        var params = {
            center_start: new google.maps.LatLng(47.378, 8.540),
            zoom_start: 13,
            zoom_follow: 17,
            zoom_station: 15,
            zoom_mouseover_min: 7,
            ft_id_mask: '1tDHsjdz7uhhAmWlmmwjR1P2Huf2LKMMiICPVdw',
            ft_id_lines: '1-1B2tYIO2JSnaacEHO8sfWVjm1S387lMEkHkjc4',
            ft_id_stations: '1YppDCNud7566oK_VwHsuUhGJqnm_CLDStMS3IuM',
            json_paths: {
                edges: 'static/geojson/edges-sbb.json',
                stations: 'static/geojson/stations-sbb.json',
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
            if (typeof listeners[type] === 'undefined') {
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
            strokeColor: "white",
            strokeOpacity: 0.8,
            strokeWeight: 3,
            map: null,
            icons: [{
                icon: {
                    path: 'M 0,-2 0,2',
                    strokeColor: 'black',
                    strokeOpacity: 1.0,          
                },
                repeat: '40px'
            }],
            timer: null
        });

        
        // TODO - that can be a nice feature request for google.maps.geometry lib
        function positionOnRouteAtPercentGet(ab_edges, percent) {
            function routeIsDetailedAtPercent() {
                for (var k=0; k<route.detailed_parts.length; k++) {
                    if ((percent >= route.detailed_parts[k].start) && (percent < route.detailed_parts[k].end)) {
                        return true;
                    }
                }

                return false;
            }
            
            var route = routes[ab_edges];

            var dAC = route.length*percent;
            
            var is_detailed = map_helpers.isDetailView() ? routeIsDetailedAtPercent() : false;
            var position_data = positionDataGet(route, dAC, is_detailed);
            if (position_data !== null) {
                position_data.is_detailed = is_detailed;
            }
            
            return position_data;
        }
        
        function routeAdd(ab_edges) {
            if (typeof routes[ab_edges] !== 'undefined') {
                return;
            }
            
            var edges = ab_edges.split(',');
            var routePoints = [];
            $.each(edges, function(k, edgeID) {
                if (edgeID.substr(0, 1) === '-') {
                    edgeID = edgeID.substr(1);
                    var points = network_lines[edgeID].points.slice().reverse();
                } else {
                    var points = network_lines[edgeID].points;
                }
                routePoints = routePoints.concat(points);
            });

            var dAB = parseFloat(google.maps.geometry.spherical.computeLength(routePoints).toFixed(3));

            var routeDetailedParts = [];
            var routeDetailedParts_i = 0;
            var is_detailed_last = false;
            var dAC = 0;
            $.each(edges, function(k, edgeID) {
                if (edgeID.substr(0, 1) === '-') {
                    edgeID = edgeID.substr(1);
                }
                
                var is_detailed = network_lines[edgeID].is_detailed;
                if (is_detailed === false) {
                    if (is_detailed_last) {
                        routeDetailedParts[routeDetailedParts_i].end = dAC / dAB;
                        routeDetailedParts_i += 1;
                    }
                } else {
                    if (is_detailed_last === false) {
                        routeDetailedParts[routeDetailedParts_i] = {
                            start: dAC / dAB,
                            end: 1
                        };
                    }
                }
                
                is_detailed_last = is_detailed;
                
                dAC += parseFloat(google.maps.geometry.spherical.computeLength(network_lines[edgeID].points).toFixed(3));
            });
            
            var route = {
                points: routePoints,
                length: dAB,
                detailed_parts: routeDetailedParts
            };
            
            routes[ab_edges] = route;
        }
        
        function addShape(shape_id) {
            if (typeof routes[shape_id] !== 'undefined') {
                return;
            }
            
            var feature = network_lines[shape_id];
            var dAB = parseFloat(google.maps.geometry.spherical.computeLength(feature.points).toFixed(3));
            var route = {
                points: feature.points,
                length: dAB,
                detailed_parts: []
            };
            
            routes[shape_id] = route;
        }
        
        function lengthGet(ab_edges) {
            return routes[ab_edges].length;
        }
        
        function routeHighlight(vehicle) {
            var points = [];
            if (vehicle.source === 'gtfs') {
                points = routes[vehicle.shape_id].points;
            } else {
                $.each(vehicle.edges, function(k, ab_edges){
                    if (k === 0) { return; }
                    points = points.concat(routes[ab_edges].points);
                });
            }
            
            route_highlight.setPath(points);
            route_highlight.setMap(map);

            var icon_offset = 0;
            route_highlight.set('timer', setInterval(function(){
                if (icon_offset > 39) {
                    icon_offset = 0;
                } else {
                    icon_offset += 2;
                }

                var icons = route_highlight.get('icons');
                icons[0].offset = icon_offset + 'px';
                route_highlight.set('icons', icons);
            }, 20));
        }
        
        function routeHighlightRemove() {
            route_highlight.setMap(null);
            clearInterval(route_highlight.get('timer'));
        }
        
        function loadEncodedEdges(edges) {
            $.each(edges, function(edge_id, encoded_edge) {
                network_lines[edge_id] = {
                    points: google.maps.geometry.encoding.decodePath(encoded_edge),
                    is_detailed: false
                };
            });
        }
        
        function loadGeoJSONEdges(features) {
            $.each(features, function(index, feature) {
                var edge_coords = [];
                $.each(feature.geometry.coordinates, function(i2, feature_coord){
                    edge_coords.push(new google.maps.LatLng(feature_coord[1], feature_coord[0]));
                });

                if (typeof(feature.properties.shape_id) === 'undefined') {
                    var edge_id = feature.properties.edge_id;
                } else {
                    var edge_id = feature.properties.shape_id;
                }

                network_lines[edge_id] = {
                    points: edge_coords,
                    is_detailed: feature.properties.detailed === 'yes'
                };
            });
        }

        function positionDataGet(route, dAC, is_detailed) {
            var dC = 0;
            
            for (var i=1; i<route.points.length; i++) {
                var pA = route.points[i-1];
                var pB = route.points[i];
                var d12 = google.maps.geometry.spherical.computeDistanceBetween(pA, pB);
                if ((dC + d12) > dAC) {
                    var data = {
                        position: google.maps.geometry.spherical.interpolate(pA, pB, (dAC - dC)/d12)
                    };
                    if (is_detailed) {
                        data.heading = google.maps.geometry.spherical.computeHeading(pA, pB);
                    }
                    
                    return data;
                }
                dC += d12;
            }
            
            return null;
        }

        function projectDistanceAlongRoute(ab_edges, dAC) {
            var route = routes[ab_edges];
            return positionDataGet(route, dAC, true);
        }
        
        return {
            positionGet: positionOnRouteAtPercentGet,
            routeAdd: routeAdd,
            lengthGet: lengthGet,
            routeHighlight: routeHighlight,
            routeHighlightRemove: routeHighlightRemove,
            loadEncodedEdges: loadEncodedEdges,
            loadGeoJSONEdges: loadGeoJSONEdges,
            projectDistanceAlongRoute: projectDistanceAlongRoute,
            addShape: addShape
        };
    })();
    
    // Time manager
    // Roles:
    // - manages the current number of seconds that passed since midnight
    // - 'init' can be used with given hh:mm:ss in order to simulate different timestamps
    var timer = (function(){
        var timer_refresh = 100;
        var ts_midnight = null;
        var ts_now = null;
        var ts_minute = null;

        var seconds_multiply = null;
        
        function init(hms) {
            (function(){
                var d = new Date();
                
                hms = hms || config.getUserParam('hms');
                if (hms !== null) {
                    var hms_matches = hms.match(/^([0-9]{2}):([0-9]{2}):([0-9]{2})$/);
                    if (hms_matches) {
                        d.setHours(parseInt(hms_matches[1], 10));
                        d.setMinutes(parseInt(hms_matches[2], 10));
                        d.setSeconds(parseInt(hms_matches[3], 10));
                    }
                }
                
                ts_now = d.getTime() / 1000;

                d.setHours(0);
                d.setMinutes(0);
                d.setSeconds(0);
                d.setMilliseconds(0);
                ts_midnight = d.getTime() / 1000;
            })();
            
            seconds_multiply = parseFloat($('#time_multiply').val());
            $('#time_multiply').change(function(){
                seconds_multiply = parseInt($(this).val(), 10);
            });
            
            var timeContainer = $('#day_time');
            
            function timeIncrement() {
                var d_now = new Date(ts_now * 1000);
                
                var ts_minute_new = d_now.getMinutes();
                if (ts_minute !== ts_minute_new) {
                    if (ts_minute !== null) {
                        listener_helpers.notify('minute_changed');
                    }
                    ts_minute = ts_minute_new;
                }
                
                timeContainer.text(getHMS());
                
                ts_now += (timer_refresh / 1000) * seconds_multiply;
                setTimeout(timeIncrement, timer_refresh);
            }
            timeIncrement();
        }
        
        function pad2Dec(what) {
            return (what < 10 ? '0' + what : what);
        }
        
        function getHMS(ts) {
            ts = ts || ts_now;

            var d = new Date(ts * 1000);
            
            var hours = pad2Dec(d.getHours());
            var minutes = pad2Dec(d.getMinutes());
            var seconds = pad2Dec(d.getSeconds());
            
            return hours + ':' + minutes + ':' + seconds;
        }
        
        return {
            init: init,
            getTS: function(ts) {
                return ts_now;
            },
            getHM: function(ts) {
                var hms = getHMS(ts);
                return hms.substring(0, 2) + ':' + hms.substring(3, 5);
            },
            getTSMidnight: function() {
                return ts_midnight;
            },
            getRefreshValue: function() {
                return timer_refresh;
            },
            getHMS2TS: function(hms) {
                var hms_parts = hms.split(':');

                var hours = parseInt(hms_parts[0], 10);
                var minutes = parseInt(hms_parts[1], 10);
                var seconds = parseInt(hms_parts[2], 10);
                
                return ts_midnight + hours * 3600 + minutes * 60 + seconds;
            }
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
                    linesPool.routeHighlight(selected_vehicle);
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
            vehicle_route.hide();

            $('.vehicle_name', $('#vehicle_info')).text(vehicle.name + ' (' + vehicle.id + ')');
            
            var ts = timer.getTS();
            
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
                
                var hm_arr = (typeof vehicle.arrS[index - 1] === 'undefined') ? '' : timer.getHM(vehicle.arrS[index - 1]);
                html_row += '<td>' + hm_arr + '</td>';

                var hm_dep = (typeof vehicle.depS[index] === 'undefined') ? '' : timer.getHM(vehicle.depS[index]);
                html_row += '<td>' + hm_dep + '</td></tr>';

                html_rows.push(html_row);
            });
            
            $('#vehicle_timetable > tbody').html(html_rows.join(''));
            $('#vehicle_timetable tbody tr').each(function(){
                var row_dep_sec = $(this).attr('data-dep-sec');
                if (row_dep_sec === "n/a") {
                    return;
                }
                if (row_dep_sec < ts) {
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
            var hm = timer.getHM();
            
            var url = config.getParam('json_paths').station_vehicles;
            url = url.replace(/\[station_id\]/, station_id);
            url = url.replace(/\[hhmm\]/, hm.replace(':', ''));
            
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
                        html_row += '<td>' + timer.getHM(vehicle.dep) + '</td>';
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
            
            $(document).on("click", '#station_departures tbody tr a', function(){
                var vehicle_id = $(this).attr('data-vehicle-id');
                var vehicle = simulation_vehicles[vehicle_id];
                simulation_panel.displayVehicle(vehicle);
                simulation_panel.followVehicle(vehicle);

                return false;
            });
            
            $(document).on("click", '#vehicle_timetable tbody tr a', function(){
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
    
    var map_helpers = (function(){
        var geolocation_marker = null;
        var has_detail_view = false;
        var extended_bounds = null;
        
        function init(){
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
            
            geolocation_marker = new google.maps.Marker({
                icon: {
                    url: 'static/images/geolocation-bluedot.png',
                    size: new google.maps.Size(17, 17),
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point(8, 8)
                },
                map: null,
                position: new google.maps.LatLng(0, 0)
            });

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
                overviewMapControl: true,
                rotateControl: true,
                mapTypeControl: true,
                mapTypeControlOptions: {
                    position: google.maps.ControlPosition.TOP_LEFT,
                    mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.TERRAIN, google.maps.MapTypeId.SATELLITE, 'stamen']
                }
            };

            if (config.getUserParam('x') !== null) {
                map_options.center = new google.maps.LatLng(parseFloat(config.getUserParam('y')), parseFloat(config.getUserParam('x')));
                map_options.zoom = config.getParam('zoom_follow');
                map_options.mapTypeId = google.maps.MapTypeId.SATELLITE;
            }
            
            if (config.getUserParam('zoom') !== null) {
                map_options.zoom = parseInt(config.getUserParam('zoom'), 10);
            }
            
            if (config.getUserParam('map_type_id') !== null) {
                map_options.mapTypeId = config.getUserParam('map_type_id');
            }
            
            if (config.getUserParam('tilt') !== null) {
                map_options.tilt = parseInt(config.getUserParam('tilt'), 10);
            }

            map = new google.maps.Map(document.getElementById("map_canvas"), map_options);
            
            var stamen_map = new google.maps.StamenMapType('watercolor');
            stamen_map.set('name', 'Stamen watercolor');
            map.mapTypes.set('stamen', stamen_map);

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
                    var map_type_id = map.getMapTypeId();
                    
                    var show_layer = true;
                    if ((map_type_id === google.maps.MapTypeId.SATELLITE) && (map.getTilt() === 0)) {
                        if (zoom >= 17) {
                            show_layer = false;
                        }
                    }
                    
                    toggleLayerVisibility(stations_layer, show_layer);
                    toggleLayerVisibility(edges_layer, show_layer);
                }

                google.maps.event.addListener(map, 'idle', trigger_toggleLayerVisibility);
                google.maps.event.addListener(map, 'maptypeid_changed', trigger_toggleLayerVisibility);
                trigger_toggleLayerVisibility();
            }

            google.maps.event.addListener(map, 'idle', function() {
                if (map_inited === false) {
                    // TODO - FIXME later ?
                    // Kind of a hack, getBounds is ready only after a while since loading, so we hook in the 'idle' event
                    map_inited = true;
                    
                    map_layers_add();
                    listener_helpers.notify('map_init');
                    
                    function update_detail_view_state() {
                        if (map.getMapTypeId() !== google.maps.MapTypeId.SATELLITE) {
                            has_detail_view = false;
                            return;
                        }

                        if (map.getZoom() < 17) {
                            has_detail_view = false;
                            return;
                        }
                        
                        if (map.getTilt() !== 0) {
                            has_detail_view = false;
                            return;
                        }
                        
                        has_detail_view = true;
                    }
                    google.maps.event.addListener(map, 'zoom_changed', update_detail_view_state);
                    google.maps.event.addListener(map, 'tilt_changed', update_detail_view_state);
                    google.maps.event.addListener(map, 'maptypeid_changed', update_detail_view_state);
                    update_detail_view_state();
                    
                    function update_extended_bounds() {
                        var map_bounds = map.getBounds();

                        var bounds_point = map_bounds.getSouthWest();
                        var new_bounds_sw = new google.maps.LatLng(bounds_point.lat() - map_bounds.toSpan().lat(), bounds_point.lng() - map_bounds.toSpan().lng());

                        var bounds_point = map_bounds.getNorthEast();
                        var new_bounds_ne = new google.maps.LatLng(bounds_point.lat() + map_bounds.toSpan().lat(), bounds_point.lng() + map_bounds.toSpan().lng());

                        extended_bounds = new google.maps.LatLngBounds(new_bounds_sw, new_bounds_ne);
                    }
                    google.maps.event.addListener(map, 'bounds_changed', update_extended_bounds);
                    update_extended_bounds();
                }
            });
        }
        
        function geolocation_update(x, y) {
            geolocation_marker.setPosition(new google.maps.LatLng(y, x));
            if (geolocation_marker.getMap() === null) {
                geolocation_marker.setMap(map);
            }
        }

        return {
            init: init,
            updateGeolocation: geolocation_update,
            isDetailView: function() {
                return has_detail_view;
            },
            getExtendedBounds: function() {
                return extended_bounds;
            }
        };
    })();
    
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
                        sec_ar.push(timer.getHMS2TS(hhmm_matches[1] + ':' + hhmm_matches[2] + ':00'));
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
                simulation_vehicles[vehicle_data.id] = v;
                v.render();
                
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

                var icon = {
                    url: 'static/images/vehicle-types/' + type + '.png',
                    size: new google.maps.Size(20, 20),
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point(10, 10)
                };
                icons[type] = icon;

                return icon;
            }

            var vehicle_detail_base_zoom = 17;            
            var vehicle_detail_config = {
                "s-bahn-rear": {
                    base_zoom_width: 33,
                    width: 228
                },
                "s-bahn-middle": {
                    base_zoom_width: 33,
                    width: 247
                },
                "s-bahn-front": {
                    base_zoom_width: 33,
                    width: 239
                },

                "s-bahn_old-rear": {
                    base_zoom_width: 26,
                    width: 153
                },
                "s-bahn_old-middle": {
                    base_zoom_width: 35,
                    width: 228
                },
                "s-bahn_old-front": {
                    base_zoom_width: 35,
                    width: 224
                },

                "ic-loco-c2": {
                    base_zoom_width: 36,
                    width: 225
                },
                "ic-coach": {
                    base_zoom_width: 36,
                    width: 254
                },
                "ic-loco": {
                    base_zoom_width: 19,
                    width: 126
                },

                "icn-rear": {
                    base_zoom_width: 32,
                    width: 207
                },
                "icn-middle": {
                    base_zoom_width: 32,
                    width: 218
                },
                "icn-front": {
                    base_zoom_width: 32,
                    width: 207
                },
                
                "ir-coach": {
                    base_zoom_width: 32,
                    width: 223
                },
            };
            var vehicle_detail_icons = {};
            
            var service_parts = {
                s: {
                    offsets: [-40, -13, 14, 41],
                    vehicles: ['s-bahn-rear', 's-bahn-middle', 's-bahn-middle', 's-bahn-front']
                },
                sbahn_old: {
                    offsets: [-39, -14, 15, 44],
                    vehicles: ['s-bahn_old-rear', 's-bahn_old-middle', 's-bahn_old-middle', 's-bahn_old-front']
                },
                ic: {
                    offsets: [-110, -87, -58, -29, 0, 29, 58, 87],
                    vehicles: ['ic-loco', 'ic-coach', 'ic-coach', 'ic-coach', 'ic-coach', 'ic-coach', 'ic-coach', 'ic-loco-c2']
                },
                icn: {
                    offsets: [-78, -52, -26, 0, 26, 52, 78],
                    vehicles: ['icn-rear', 'icn-middle', 'icn-middle', 'icn-middle', 'icn-middle', 'icn-middle', 'icn-front']
                },
                ir: {
                    offsets: [-93, -67, -41, -15, 11, 37, 63, 84],
                    vehicles: ['ir-coach', 'ir-coach', 'ir-coach', 'ir-coach', 'ir-coach', 'ir-coach', 'ir-coach', 'ic-loco']
                }
            };
            
            function getVehicleIcon(zoom, type, heading) {
                var key = zoom + '_' + type + '_' + heading;
                if (typeof vehicle_detail_icons[key] === 'undefined') {
                    var original_width = vehicle_detail_config[type].width;
                    var icon_width = vehicle_detail_config[type].base_zoom_width * Math.pow(2, parseInt(zoom - vehicle_detail_base_zoom, 10));
                    
                    var base_url;
                    if (document.location.host.match(/simcity2\.ch/)) {
                        base_url = 'http://static.vasile2.ch';
                    } else {
                        base_url = 'http://static.vasile.ch';
                    }
                    base_url += '/simcity/service-vehicle-detail';
                    
                    var icon = {
                        url: base_url + '/' + type + '/' + heading + '.png',
                        size: new google.maps.Size(original_width, original_width),
                        origin: new google.maps.Point(0, 0),
                        scaledSize: new google.maps.Size(icon_width, icon_width),
                        anchor: new google.maps.Point(parseInt(icon_width/2, 10), parseInt(icon_width/2, 10))
                    };
                    vehicle_detail_icons[key] = icon;
                }
                
                return vehicle_detail_icons[key];
            }

            return {
                iconGet: iconGet,
                getServicePartsConfig: function(key) {
                    if ((typeof service_parts[key]) === 'undefined') {
                        key = 's';
                    }
                    return service_parts[key];
                },
                getVehicleIcon: getVehicleIcon
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
            function parseTimes(times) {
                var time_ar = [];
                
                $.each(times, function(k, time){
                    // 32855 = 9 * 3600 + 7 * 60 + 35
                    if ((typeof time) === 'number') {
                        if (time < (2 * 24 * 3600)) {
                            time += timer.getTSMidnight();
                        }                        

                        time_ar.push(time);
                        return;
                    }
                    
                    // 09:07:35
                    if (time.match(/^[0-9]{2}:[0-9]{2}:[0-9]{2}$/) !== null) {
                        time = timer.getHMS2TS(time);
                        
                        time_ar.push(time);
                        return;
                    }
                    
                    // 09:07
                    if (time.match(/^[0-9]{2}:[0-9]{2}$/) !== null) {
                        var hms = time + ':00';

                        time = timer.getHMS2TS(hms);
                        
                        time_ar.push(time);
                        return;
                    }
                });
                
                return time_ar;
            }
            
            this.id                 = params.id;
            this.name               = params.name;
            this.stations           = params.sts;
            this.edges              = params.edges;
            this.depS               = parseTimes(params.deps);
            this.arrS               = parseTimes(params.arrs);
            this.service_type       = params.service_type;
            
            $.each(params.edges, function(k, edges) {
                if (k === 0) { return; }
                linesPool.routeAdd(edges);
            });

            var marker = new google.maps.Marker({
                position: new google.maps.LatLng(0, 0),
                map: null,
                speed: 0,
                status: 'not on map'
            });
            var icon = imagesPool.iconGet(params.type);
            if (icon !== null) {
                marker.setIcon(icon);
            }
            
            this.marker = marker;
            this.detail_markers = [];
            
            // TODO - FIXME .apply
            var that = this;

            google.maps.event.addListener(marker, 'click', function() {
                simulation_panel.displayVehicle(that);
            });

            this.mouseOverMarker = function() {
                if (map.getZoom() < config.getParam('zoom_mouseover_min')) {
                    return;
                }

                if (vehicle_ib.get('vehicle_id') === params.id) { return; }
                vehicle_ib.set('vehicle_id', params.id);

                vehicle_ib.close();

                var popup_div = $('#vehicle_popup');
                $('span.vehicle_name', popup_div).text(params.name);
                $('.status', popup_div).html(marker.get('status'));

                vehicle_ib.setContent($('#vehicle_popup_container').html());
                vehicle_ib.open(map, this);
            }
            this.mouseOutMarker = function() {
                vehicle_ib.set('vehicle_id', null);
                vehicle_ib.close();
            }
            google.maps.event.addListener(marker, 'mouseover', this.mouseOverMarker);
            google.maps.event.addListener(marker, 'mouseout', this.mouseOutMarker);
            
            if (vehicle_detect.match(this.name, this.id)) {
                simulation_panel.displayVehicle(this);
                simulation_panel.followVehicle(this);
            }
        }
        Vehicle.prototype.render = function() {
            // TODO - FIXME .apply
            var that = this;
            
            function animate() {
                var ts = timer.getTS();

                var vehicle_position = null;
                var route_percent = 0;
                var d_AC = 0;
                var animation_timeout = 1000;

                for (var i=0; i<that.arrS.length; i++) {
                    if (ts < that.arrS[i]) {
                        var station_a = that.stations[i];
                        var station_b = that.stations[i+1];

                        if (ts > that.depS[i]) {
                            var routeLength = linesPool.lengthGet(that.edges[i+1]);
                            
                            // Vehicle is in motion between two stations
                            if (that.marker.get('speed') === 0) {
                                var speed = routeLength * 0.001 * 3600 / (that.arrS[i] - that.depS[i]);
                                that.marker.set('speed', parseInt(speed, 10));
                                that.marker.set('status', 'Heading to ' + stationsPool.get(station_b) + '(' + timer.getHM(that.arrS[i]) + ')<br/>Speed: ' + that.marker.get('speed') + ' km/h');
                            }
                            
                            route_percent = (ts - that.depS[i])/(that.arrS[i] - that.depS[i]);
                            
                            d_AC = routeLength * route_percent;
                        } else {
                            // Vehicle is in a station
                            if (that.marker.get('speed') !== 0) {
                                that.marker.set('status', 'Departing ' + stationsPool.get(station_a) + ' at ' + timer.getHM(that.depS[i]));
                                that.marker.set('speed', 0);
                            }
                        }
                        
                        var vehicle_position_data = linesPool.positionGet(that.edges[i+1], route_percent);
                        if (vehicle_position_data === null) {
                            break;
                        }

                        var vehicle_position = vehicle_position_data.position;
                        
                        if (that.marker.get('follow') === 'yes-init') {
                            that.marker.set('follow', 'yes');
                            
                            map.panTo(vehicle_position);
                            if (map.getZoom() < config.getParam('zoom_follow')) {
                                map.setZoom(config.getParam('zoom_follow'));
                            }
                            map.setMapTypeId(google.maps.MapTypeId.SATELLITE);

                            map.bindTo('center', that.marker, 'position');
                        }
                        
                        that.updateIcon(vehicle_position_data, d_AC, i);
                        if (map.getZoom() >= 12) {
                            animation_timeout = timer.getRefreshValue();
                        }
                        
                        setTimeout(animate, animation_timeout);
                        break;
                    }
                } // end arrivals loop

                if (vehicle_position === null) {
                    delete simulation_vehicles[that.id];
                }
            }
            
            animate();
        };
        Vehicle.prototype.updateIcon = function(data, d_AC, i) {
            var service_parts = imagesPool.getServicePartsConfig(this.service_type);
            var render_in_detail = data.is_detailed && (service_parts !== null);
            var vehicle_position = data.position;
            this.marker.setPosition(data.position);
            
            if (render_in_detail) {
                if (this.marker.getMap() !== null) {
                    this.marker.setMap(null);
                }
                
                if (map_helpers.getExtendedBounds().contains(vehicle_position)) {
                    var that = this;
                    $.each(service_parts.offsets, function(k, offset){
                        if ((typeof that.detail_markers[k]) === 'undefined') {
                            that.detail_markers[k] = new google.maps.Marker({
                                map: null
                            });

                            var marker = that.detail_markers[k];
                            google.maps.event.addListener(marker, 'mouseover', that.mouseOverMarker);
                            google.maps.event.addListener(marker, 'mouseout', that.mouseOutMarker);
                            google.maps.event.addListener(marker, 'click', function(){
                                simulation_panel.displayVehicle(that);
                            });
                        }

                        var marker = that.detail_markers[k];

                        var route = that.edges[i+1];
                        var route_length = linesPool.lengthGet(route);
                        var d_AC_new = d_AC + offset;

                        if ((d_AC + offset) > route_length) {
                            d_AC_new -= route_length;
                            route = that.edges[i+2];
                        }
                        var position_data = linesPool.projectDistanceAlongRoute(route, d_AC_new);

                        if (position_data === null) {
                            marker.setMap(null);
                            return;
                        }

                        var heading = parseInt(position_data.heading, 10);
                        if (heading < 0) {
                            heading += 360;
                        }
                        heading = ('00' + heading).slice(-3);

                        var zoom = map.getZoom();
                        var icon = imagesPool.getVehicleIcon(zoom, service_parts.vehicles[k], heading);
                        if (((typeof marker.getIcon()) === 'undefined') || (marker.getIcon().url !== icon.url) || (marker.get('zoom') !== zoom)) {
                            marker.setIcon(icon);
                            marker.set('zoom', map.getZoom());
                        }

                        marker.setPosition(position_data.position);
                        if (marker.getMap() === null) {
                            marker.setMap(map);
                        }
                    });
                } else {
                    $.each(this.detail_markers, function(k, marker){
                        marker.setMap(null);
                    });
                    this.detail_markers = [];
                }
            } else {
                $.each(this.detail_markers, function(k, marker){
                    marker.setMap(null);
                });
                this.detail_markers = [];
                
                if (map.getBounds().contains(vehicle_position)) {
                    if (this.marker.getMap() === null) {
                        this.marker.setMap(map);
                    }
                } else {
                    if (this.marker.getMap() !== null) {
                        this.marker.setMap(null);
                    }
                }
            }
        };

        return {
            load: function() {
                var hm = timer.getHM();
                
                var url = config.getParam('json_paths').vehicles;
                url = url.replace(/\[hhmm\]/, hm.replace(':', ''));
                
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
            success: function(geojson) {
                linesPool.loadGeoJSONEdges(geojson.features);
                // network lines loaded => LOAD stations
                $.ajax({
                    url: config.getParam('json_paths').stations,
                    dataType: 'json',
                    success: function(geojson) {
                        $.each(geojson.features, function(index, feature) {
                            stationsPool.add(
                                feature.properties.station_id, 
                                feature.properties.name, 
                                parseFloat(feature.geometry.coordinates[0]), 
                                parseFloat(feature.geometry.coordinates[1])
                            );
                        });
                        
                        vehicle_helpers.load();
                        listener_helpers.subscribe('minute_changed', vehicle_helpers.load);
                    }
                });
            }
        });
    });
    
    function ui_init() {
        var view_mode = config.getUserParam('view_mode');
        
        var panel_display = (ua_is_mobile === false) && (view_mode !== 'iframe');
        if (panel_display) {
            $('#panel').removeClass('hidden');
        }
        
        if (config.getUserParam('time_multiply') !== null) {
            $('#time_multiply').val(config.getUserParam('time_multiply'));
        }
    }
    
    function geolocation_init() {
        function location_get(position) {
            var x = position.coords.longitude;
            var y = position.coords.latitude;
            
            listener_helpers.subscribe('map_init', function(){
                map_helpers.updateGeolocation(x, y);
            });
        }
        function location_error(error) {
            var errorMessage = [
                'Geolocation: we are not quite sure what happened.',
                'Sorry. Permission to find your location has been denied.',
                'Sorry. Your position could not be determined.',
                'Sorry. Geolocation requst timed out.'
            ];
            alert(errorMessage[ error.code ]);
        }
        
        navigator.geolocation.getCurrentPosition(location_get, location_error);
    }
    
    return {
        init: function(){
            ui_init();
            geolocation_init();
            timer.init();
            map_helpers.init();
            simulation_panel.init();
        },
        getMap: function(){
            return map;
        }
    };
})();
    
$(document).ready(simulation_manager.init);