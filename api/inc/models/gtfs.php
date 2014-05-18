<?php
class GTFS {
    private static function getDayServiceIds() {
        $day_of_week = date('l');
        $day_of_week = strtolower($day_of_week);

        $ymd = date('Ymd');
        
        $calendar_rows = DB::getCalendarRows();
        $service_ids = array();
        foreach ($calendar_rows as $row) {
            if (($row['start_date'] <= $ymd) && ($ymd <= $row['end_date'])) {
                if ($row[$day_of_week] === 1) {
                    array_push($service_ids, $row['service_id']);
                }
                
                if (($row['monday'] === 0) && ($row['tuesday'] === 0) && ($row['wednesday'] === 0) && ($row['thursday'] === 0) && ($row['friday'] === 0) && ($row['saturday'] === 0) && ($row['sunday'] === 0)) {
                    array_push($service_ids, $row['service_id']);
                }
            }
        }
        
        if (count($service_ids) === 0) {
            error_log('GTFS::getDayServiceIds no service_id found for ' . $ymd . ' dow: ' . $day_of_week);
        }
        
        return $service_ids;
    }
    
    public static function getTripsByMinute($hhmm) {
        $service_ids = self::getDayServiceIds();
        
        $trips = DB::getTripsByMinute($hhmm, $service_ids);
        $new_trips = array();
        foreach ($trips as $k => $row) {
            $stops = DB::getStopsByTripId($row['trip_id']);
            foreach ($stops as $k1 => $stop) {
                $stops[$k1]['arrival_time'] = self::renderTime($stop['arrival_time']);
                $stops[$k1]['departure_time'] = self::renderTime($stop['departure_time']);
            }
            $trips[$k]['stops'] = $stops;
            array_push($new_trips, $trips[$k]);
        }
        
        return $new_trips;
    }
    
    private static function renderTime($hms) {
        $time_sec = substr($hms, 0, 2) * 3600 + substr($hms, 3, 2) * 60 + substr($hms, 6);
        $day_full_sec = 24 * 3600;
        if ($time_sec < $day_full_sec) {
            return $hms;
        }
        
        $time_sec -= $day_full_sec;
        $time_hh = floor($time_sec / 3600);
        $time_mm = floor(($time_sec - $time_hh * 3600) / 60);
        $time_ss = $time_sec - $time_hh * 3600 - $time_mm * 60;
        
        return sprintf('%02d:%02d:%02d', $time_hh, $time_mm, $time_ss);
    }
}
