$(document).ready(function(){
    var linesPool = (function() {
        // TODO - get rid of this, start to use separate fields for the coordinates
        function latlngFromString(s) {
            var parts = s.split(',');
            return new google.maps.LatLng(parseFloat(parts[0]), parseFloat(parts[1]));
        }
        
        function getPosition(id, perc) {
            if (typeof linesData[id] === 'undefined') {
                var idParts = id.split('_');
                var newID = idParts[1] + '_' + idParts[0];
                if (typeof linesData[newID] === 'undefined') {
                    return null;
                }
                var vxs = linesData[newID].p.slice().reverse();
                var lineL = linesData[newID].l;
            } else {
                var vxs = linesData[id].p;
                var lineL = linesData[id].l;
            }
            
            var dC = 0;
            var dAC = lineL*perc;
            
            for (var i=1; i<vxs.length; i++) {
                var d12 = google.maps.geometry.spherical.computeDistanceBetween(latlngFromString(vxs[i-1]), latlngFromString(vxs[i]));
                if ((dC + d12) > dAC) {
                    var p1Parts = vxs[i-1].split(',');
                    var p2Parts = vxs[i].split(',');
                    
                    var dx = (parseFloat(p2Parts[1]) - parseFloat(p1Parts[1]))*(dAC - dC)/d12;
                    var dy = (parseFloat(p2Parts[0]) - parseFloat(p1Parts[0]))*(dAC - dC)/d12;
                    
                    return new google.maps.LatLng(parseFloat(p1Parts[0]) + dy, parseFloat(p1Parts[1]) + dx);
                }
                dC += d12;
            }
            
            return null;
        }
        
        return {
            getPosition: getPosition
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
    
    function Vehicle(data) {
        this.id = data.id;
        this.stations = data.stations;
        this.depS = data.departures;
        this.arrS = data.arrivals;
    }
    Vehicle.prototype.render = function() {
        var marker = new google.maps.Marker({position: new google.maps.LatLng(0, 0), map: map});
        
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
                            stations: that.stations[i] + '_' + that.stations[i+1],
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
            
            switch (info.state) {
                case 'station':
                    // TODO - if is not yet on the map, add it. Use station coordinates
                    setTimeout(animate, info.timeLeft*1000);
                    break;
                case 'motion':
                    var pos = linesPool.getPosition(info.stations, info.percent);
                    if (pos === null) {
                        console.log('Couldnt get the position of ' + that.id + ' between stations: ' + info.stations);
                        break;
                    }
                    marker.setPosition(pos);
                    setTimeout(animate, 500);
                    break;
                default:
                    marker.setMap(null);
                    break;
            }
        }
        
        var that = this;
        animate();
    };
    
    var start = new google.maps.LatLng(47.378057, 8.5402338);
    var myOptions = {
      zoom: 15,
      center: start,
      mapTypeId: google.maps.MapTypeId.ROADMAP
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
    
    var nowHMS = '10:16:55';
    timer.init(nowHMS);
    
    $.ajax({
      url: '/feed/vehicles/' + timer.getHM(),
      dataType: 'json',
      success: function(vehicles) {
        $.each(vehicles, function(index, vehicle) { 
          var v = new Vehicle({
            id: vehicle['id'],
            stations: vehicle.sts,
            departures: vehicle.deps,
            arrivals: vehicle.arrs
          });
          v.render();
        });
      }
    });
});