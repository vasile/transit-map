<?php
class GTFS {
    private static function getServiceId() {
        $day_of_week = date('l');
        $day_of_week = strtolower($day_of_week);

        $ymd = date('Ymd');
        
        $calendar_rows = DB::getCalendarRows();
        $service_ids = array();
        foreach ($calendar_rows as $row) {
            if (($row['start_date'] <= $ymd) && ($ymd <= $row['end_date'])) {
                if ($row[$day_of_week] === 1) {
                    return $row['service_id'];
                }
                
                if (($row['monday'] === 0) && ($row['tuesday'] === 0) && ($row['wednesday'] === 0) && ($row['thursday'] === 0) && ($row['friday'] === 0) && ($row['saturday'] === 0) && ($row['sunday'] === 0)) {
                    return $row['service_id'];
                }

                array_push($service_ids, $row['service_id']);
            }
        }

        error_log('GTFS::getServiceId cannot find a service_id for ' . $ymd . ' dow: ' . $day_of_week . ' Returning first row');
        return $calendar_rows[0]['service_id'];
    }
    
    public static function getTripsByMinute($hhmm) {
        $service_id = self::getServiceId();
        if (empty($service_id)) {
            return array();
        }
        
        $trips = DB::getTripsByMinute($hhmm, $service_id);
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
        $time_ss = $time_sec - ($time_mm * 60);
        
        return sprintf('%02d:%02d:%02d', $time_hh, $time_mm, $time_ss);
    }
}