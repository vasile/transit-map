$(document).ready(function(){
    var linesPool = (function() {
        var linesData = {
            '11_22': {
                p: [
                    '47.416739,8.5501539',
                    '47.411599,8.5438883'
                ],
                l: 742
            },
            '22_3': {
                p: [
                    '47.411599,8.5438883',
                    '47.409101,8.5386526',
                    '47.398790,8.5324299',
                    '47.393009,8.5293400'
                ],
                l: 2407
            },
            '3_4': {
                p: [
                    '47.393009,8.5293400',
                    '47.387837,8.5261213',
                    '47.384583,8.5206282',
                    '47.381735,8.5225165',
                    '47.381253,8.5270587',
                    '47.378057,8.5402338'
                ],
                l: 2924
            },
            '4_5': {
                p: [
                    '47.378057,8.5402338',
                    '47.375064,8.5437957'
                ],
                l: 428
            }
        };
        
        function latlngFromString(s) {
            var parts = s.split(',');
            return new google.maps.LatLng(parseFloat(parts[0]), parseFloat(parts[1]));
        }
        
        function draw() {
            $.each(linesData, function(k1, lineData) {
                var lineCoords = [];
                $.each(lineData.p, function(k2, p) {
                    lineCoords.push(latlngFromString(p));
                });
                var lineMap = new google.maps.Polyline({
                  path: lineCoords,
                  strokeColor: '#FF0000',
                  strokeOpacity: 1.0,
                  strokeWeight: 2,
                  map: map
                });
            });
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
            
            // We do not use google.maps.Polyline because most probably the lines 
            //      will be plotted via FusionTables.
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
            draw: draw,
            getPosition: getPosition
        }
    })();
    var helpers = (function(){
        function pad2Dec(what) {
            return (what < 10 ? '0' + what : what);
        }
        return {
            pad2Dec: pad2Dec
        }
    })();
    var time_helpers = (function(){
        function hms2s(hms) {
            var parts = hms.split(':');
            return parseInt(parts[0], 10)*3600 + parseInt(parts[1], 10)*60 + parseInt(parts[2], 10);
        }
        function s2hms(dayS) {
            // From http://stackoverflow.com/questions/1322732/convert-seconds-to-hh-mm-ss-with-javascript
            var hours = Math.floor(dayS / 3600);
            dayS %= 3600;
            var minutes = Math.floor(dayS / 60);
            var seconds = dayS % 60;
            
            return helpers.pad2Dec(hours) + ':' + helpers.pad2Dec(minutes) + ':' + helpers.pad2Dec(seconds);
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
        
        return {
            init: init,
            getTime: getDaySeconds
        }
    })();
    
    function Vehicle(data) {
        this.id = data.id;
        this.stations = data.stations;
        this.depM = [];
        this.arrM = [];
        // TODO - optimize introduce passedSteps
        for (var i in data.departures) {
            this.depM.push(time_helpers.hms2s(data.departures[i]));
            this.arrM.push(time_helpers.hms2s(data.arrivals[i]));
        }
    }
    Vehicle.prototype.render = function() {
        var marker = new google.maps.Marker({position: new google.maps.LatLng(0, 0), map: map});
        
        function animate() {
            var hms = timer.getTime();
            
            var info = {
                state: null
            };
            for (var i=0; i<that.arrM.length; i++) {
                if (hms < that.arrM[i]) {
                    if (hms > that.depM[i]) {
                        info = {
                            state: 'motion',
                            stations: that.stations[i] + '_' + that.stations[i+1],
                            percent: (hms - that.depM[i])/(that.arrM[i] - that.depM[i]),
                            message: that.id + '> ' + time_helpers.s2hms(hms) + ' From ' + that.stations[i] + ' --TO-- ' + that.stations[i+1]
                        };
                    } else {
                        info = {
                            state: 'station',
                            station: that.stations[i],
                            timeLeft: that.depM[i] - hms,
                            message: that.id + '> ' + time_helpers.s2hms(hms) + ' In station ' + that.stations[i] + ' until ' + time_helpers.s2hms(that.depM[i])
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
    linesPool.draw();
    
    var nowHMS = '10:17:05';
    timer.init(nowHMS);
    
    var vehicleData = [
        {
            id: 'B1',
            stations: [11,22,3,4,5],
            departures: ['10:10:00','10:13:00','10:17:15','10:23:00'],
            arrivals: ['10:12:00','10:17:00','10:20:00','10:25:00']
        },
        {
            id: 'A2',
            stations: [5,4,3,22,11],
            departures: ['10:14:00','10:20:00','10:24:30','10:27:00'],
            arrivals: ['10:17:00','10:24:00','10:26:00','10:29:00']
        }
    ];

    var vs = [];
    for (var i in vehicleData) {
        vs[i] = new Vehicle(vehicleData[i]);
        vs[i].render();
    }
    
});