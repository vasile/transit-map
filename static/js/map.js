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
            var strNotPadded = '0' + what;
            return strNotPadded.substring(strNotPadded.length - 2);
        }
        return {
            pad2Dec: pad2Dec
        }
    })();
    var time_helpers = (function(){
        function hm2m(hm) {
            var hmParts = hm.split(':');
            return parseInt(hmParts[0], 10)*60 + parseInt(hmParts[1], 10);
        }
        function m2hm(m) {
            var hS = helpers.pad2Dec(Math.floor(m/60));
            var mS = helpers.pad2Dec(m - (parseInt(hS, 10)*60));
            return hS + ':' + mS;
        }
        return {
            hm2m: hm2m,
            m2hm: m2hm
        }
    })();
    var timer = (function(){
        var delayM = 0;
        
        function getNow() {
            var now = new Date();
            var hours = now.getHours();
            var minutes = now.getMinutes();
            var seconds = now.getSeconds();
            
            var m = hours*60 + minutes + seconds/60;
            
            return m;
        }
        
        function getNowMinutes() {
            return getNow() - delayM;
        }
        
        function init(hm) {
            if (typeof(hm) !== 'undefined') {
                delayM = Math.floor(getNow()) - time_helpers.hm2m(hm);
            }
            
            var timeContainer = $('#day_time');
            function paintHM() {
                timeContainer.text(time_helpers.m2hm(Math.floor(getNowMinutes())));
            }
            
            paintHM();
            
            setInterval(function(){
                paintHM();
            }, 1000*60);
        }
        
        return {
            init: init,
            getMinutesDec: getNowMinutes
        }
    })();
    
    function Vehicle(data) {
        this.id = data.id;
        this.stations = data.stations;
        this.depM = [];
        this.arrM = [];
        // TODO - optimize introduce passedSteps
        for (var i in data.departures) {
            this.depM.push(time_helpers.hm2m(data.departures[i]));
            this.arrM.push(time_helpers.hm2m(data.arrivals[i]));
        }
    }
    Vehicle.prototype.render = function() {
        var marker = new google.maps.Marker({position: new google.maps.LatLng(0, 0), map: map});
        
        function animate() {
            var hm = timer.getMinutesDec();
            // Time to create a new helper_timer for hms ?
            var hms = time_helpers.m2hm(Math.floor(hm)) + ':' + (hm - Math.floor(hm)).toFixed(2);
            
            var info = {
                state: null
            };
            for (var i=0; i<that.arrM.length; i++) {
                if (hm < that.arrM[i]) {
                    if (hm > that.depM[i]) {
                        info = {
                            state: 'motion',
                            stations: that.stations[i] + '_' + that.stations[i+1],
                            percent: (hm - that.depM[i])/(that.arrM[i] - that.depM[i]),
                            message: that.id + '> ' + hms + '      ' + that.stations[i] + ' ---- ' + that.stations[i+1]
                        };
                    } else {
                        info = {
                            state: 'station',
                            station: that.stations[i],
                            timeLeft: that.depM[i] - hm,
                            message: that.id + '> ' + hms + ' Station ' + that.stations[i]
                        };
                    }
                    break;
                }
            }
            
            switch (info.state) {
                case 'station':
                    setTimeout(animate, info.timeLeft*60*1000);
                    break;
                case 'motion':
                    var pos = linesPool.getPosition(info.stations, info.percent);
                    if (pos === null) {
                        console.log('Couldnt get the position of ' + that.id + ' between stations: ' + info.stations);
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
    
    var nowHM = '10:16';
    timer.init(nowHM);
    
    var vehicleData = [
        {
            id: 'B1',
            stations: [11,22,3,4,5],
            departures: ['10:10','10:13','10:17','10:23'],
            arrivals: ['10:12','10:17','10:20','10:25']
        },
        {
            id: 'A2',
            stations: [5,4,3,22,11],
            departures: ['10:14','10:20','10:24','10:27'],
            arrivals: ['10:17','10:24','10:26','10:29']
        }
    ];

    var vs = [];
    for (var i in vehicleData) {
        vs[i] = new Vehicle(vehicleData[i]);
        vs[i].render();
    }
    
});