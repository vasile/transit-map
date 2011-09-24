$(document).ready(function(){
    var imagesPool = (function(){
        var icons = {};
        function iconExists(type) {
            return typeof icons[type] !== 'undefined';
        }
        
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
    
    
    var linesPool = (function() {
        var routes = {};

        function positionOnRouteAtPercentGet(ids, perc) {
            var route = routes[ids[0] + '_' + ids[1]];
            
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
          if (typeof routes[a + '_' + b] !== 'undefined') {
              return true;
          }
          if (typeof routes[b + '_' + a] !== 'undefined') {
              return true;
          }
          
          return false;
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
            routes[b + '_' + a] = {
                'points': routePoints.slice().reverse(),
                'length': routeLength
            };
        }
        
        return {
            positionGet: positionOnRouteAtPercentGet,
            routeExists: routeExists,
            routeAdd: routeAdd
        }
    })();
    var time_helpers = (function(){
        function hms2s(hms) {
            var parts = hms.split(':');
            return parseInt(parts[0], 10)*3600 + parseInt(parts[1], 10)*60 + parseInt(parts[2], 10);
        }
        function s2hms(dayS) {
            function pad2Dec(what) {
                return (what < 10 ? '0' + what : what);
            }
            
            // From http://stackoverflow.com/questions/1322732/convert-seconds-to-hh-mm-ss-with-javascript
            var hours = Math.floor(dayS / 3600);
            dayS %= 3600;
            var minutes = Math.floor(dayS / 60);
            var seconds = dayS % 60;
            
            return pad2Dec(hours) + ':' + pad2Dec(minutes) + ':' + pad2Dec(seconds);
        }
        return {
            hms2s: hms2s,
            s2hms: s2hms
        }
    })();
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
          return hms.substring(0, 5);
        }
        
        return {
            init: init,
            getTime: getDaySeconds,
            getHM: getHM
        }
    })();
    
    function Vehicle(params) {
        this.id             = params['id'];
        this.stations       = params['sts'];
        this.depS           = params['deps'];
        this.arrS           = params['arrs'];
        
        $.each(params.edges, function(index, edge) {
            if (index === 0) { return; }
            
            if (linesPool.routeExists(params['sts'][index-1], params['sts'][index])) {
                return;
            }
            
            linesPool.routeAdd(params['sts'][index-1], params['sts'][index], params['edges'][index].split(','));
        });
        
        this.marker = new google.maps.Marker({
            position: new google.maps.LatLng(0, 0),
            icon: imagesPool.iconGet(params['type']),
            map: map,
            title: params['name'] + ' (' + this.id + ')'
        });
    }
    Vehicle.prototype.render = function() {
        function animate() {
            var hms = timer.getTime();
            
            var info = {
                state: null
            };
            for (var i=0; i<that.arrS.length; i++) {
                if (hms < that.arrS[i]) {
                    if (hms > that.depS[i]) {
                        info = {
                            state: 'motion',
                            stations: [that.stations[i], that.stations[i+1]],
                            percent: (hms - that.depS[i])/(that.arrS[i] - that.depS[i]),
                            message: that.id + '> ' + time_helpers.s2hms(hms) + ' From ' + that.stations[i] + ' --TO-- ' + that.stations[i+1]
                        };
                    } else {
                        info = {
                            state: 'station',
                            station: that.stations[i],
                            timeLeft: that.depS[i] - hms,
                            message: that.id + '> ' + time_helpers.s2hms(hms) + ' In station ' + that.stations[i] + ' until ' + time_helpers.s2hms(that.depS[i])
                        };
                    }
                    break;
                }
            }
            
            // TODO - move me above - is waste of code 
            switch (info.state) {
                case 'station':
                    // TODO - if is not yet on the map, add it (first vertex of the route)
                    setTimeout(animate, info.timeLeft*1000);
                    break;
                case 'motion':
                    var pos = linesPool.positionGet(info.stations, info.percent);
                    if (pos === null) {
                        console.log('Couldnt get the position of ' + that.id + ' between stations: ' + info.stations);
                        break;
                    }
                    
                    if (map.getBounds().contains(pos)) {
                        if (that.marker.getMap() === null) {
                            that.marker.setMap(map);
                        }
                        that.marker.setPosition(pos);
                    } else {
                        that.marker.setMap(null);
                    }

                    setTimeout(animate, 500);
                    break;
                default:
                    that.marker.setMap(null);
                    break;
            }
        }
        
        var that = this;
        animate();
    };
    
    
    // END HELPERS
    
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
      zoom: 15,
      center: start,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: mapStyles
    }
    var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

    var layer = null;
    layer = new google.maps.FusionTablesLayer({
      query: {
        select: 'geometry',
        from: '1497331'
      },
      map: map
    });
    layer = new google.maps.FusionTablesLayer({
      query: {
        select: 'geometry',
        from: '1497361'
      },
      map: map
    });
    layer = new google.maps.FusionTablesLayer({
      query: {
        select: 'geometry',
        from: '812706'
      },
      map: map
    });
    
    var nowHMS = '10:16:55';
    timer.init(nowHMS);
    
    // TODO: Connect again in x minutes
    $.ajax({
      url: 'feed/vehicles/' + timer.getHM(),
      dataType: 'json',
      success: function(vehicles) {
        $.each(vehicles, function(index, vehicleData) { 
          var v = new Vehicle(vehicleData);
          v.render();
        });
      }
    });
});