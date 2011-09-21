<?php
include(APP_ROOT . 'inc/helpers_ip.php');

ini_set('log_errors', 'On');
if (helpers_ip::isWhiteListed()) {
    error_reporting(E_ALL);
    ini_set('display_errors', 'On');
} else {
    error_reporting(0);
    ini_set('display_errors', 'Off');
}

class Vehicles {
    private static $DB = null;
    private static function init_db() {
        self::$DB = new PDO('sqlite:' . APP_ROOT . 'tmp/sbb_export.db');
    }
    
    public static function get($hm) {
        $hm_found = preg_match('/^([0-9]{2}):([0-9]{2})$/', $hm, $hm_matches);
        if (!$hm_found) {
            return array();
        }
        
        $time_sec = $hm_matches[1] * 3600 + $hm_matches[2] * 60;
        $time_sec_1d = $time_sec + 3600 * 24;
        
        // TODO - memcache ME
        // TODO - store the vehicles fetched already in a $_SESSION
        Vehicles::init_db();
        $sql = "SELECT id, name FROM vehicle WHERE (time_a_sec < " . $time_sec . " AND time_B_sec > " . $time_sec . ") OR (multiple_days = 1 AND time_a_sec < " . $time_sec_1d . " AND time_B_sec > " . $time_sec_1d . ")";
        $vehicles = self::$DB->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        
        $vehiclesData = array();
        foreach ($vehicles as $vehicle) {
            $vehicleData = array(
                'id'    => $vehicle['id'],
                'name'  => $vehicle['name'],
                'sts'   => array(),
                'deps'  => array(),
                'arrs'  => array(),
            );
            
            // TODO - memcache ME
            $sql = 'SELECT * FROM timetable WHERE vehicle_id = "' . $vehicle['id'] . '" ORDER BY timetable.id';
            $stops = self::$DB->query($sql)->fetchAll(PDO::FETCH_ASSOC);
            
            foreach ($stops as $k => $stop) {
                array_push($vehicleData['sts'], (int) $stop['station_id']);
                if ($k < (count($stops) - 1)) {
                    array_push($vehicleData['deps'], (int) $stop['time_departure_sec']);
                }
                if ($k > 0) {
                    array_push($vehicleData['arrs'], (int) $stop['time_arrival_sec']);
                }
            }
            array_push($vehiclesData, $vehicleData);
        }
        
        return $vehiclesData;
    }
    
    public static function json_dump($rows) {
        // TODO - handle GZIP output 
        header('Content-Type: text/javascript; charset=utf8');
        echo  json_encode($rows);
    }
}