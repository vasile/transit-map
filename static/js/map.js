$(document).ready(function(){
    var linesPool = (function() {
        var linesData = {
            '1_2': [
                '47.416739,8.5501539',
                '47.411599,8.5438883'
            ],
            '2_3': [
                '47.411599,8.5438883',
                '47.409101,8.5386526',
                '47.398790,8.5324299',
                '47.393009,8.5293400'
            ],
            '3_4': [
                '47.393009,8.5293400',
                '47.387837,8.5261213',
                '47.384583,8.5206282',
                '47.381735,8.5225165',
                '47.381253,8.5270587',
                '47.378057,8.5402338'
            ],
            '4_5': [
                '47.378057,8.5402338',
                '47.375064,8.5437957'
            ]
        };
        
        function draw() {
            $.each(linesData, function(k1, lineData) {
                var lineCoords = [];
                $.each(lineData, function(k2, p) {
                    var pParts = p.split(',');
                    lineCoords.push(new google.maps.LatLng(parseFloat(pParts[0]), parseFloat(pParts[1])));
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
        
        return {
            draw: draw
        }
    })();
    
    var start = new google.maps.LatLng(47.378057, 8.5402338);
    var myOptions = {
      zoom: 15,
      center: start,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    }
    var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
    
    var vehicleStations = [1,2,3,4,5];
    var vehicleStops_dep = ['10:10','10:13','10:17','10:23'];
    var vehicleStops_arr = ['10:12','10:17','10:20','10:25'];
    
    linesPool.draw();
});