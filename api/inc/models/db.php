<?php

class DB {
    private static $db = null;
    private static $use_file_cache = false;
    
    private static function getDB() {
        if (is_null(self::$db)) {
            $db_path = APP_FOLDER_PATH . '/gtfs-data/gtfs.db';
            $db = new SQLite3($db_path, SQLITE3_OPEN_READONLY);
            self::$db = $db;
        }
        
        return self::$db;
    }
    
    private static function getCachedResults($params) {
        if (self::$use_file_cache === FALSE) {
            return null;
        }
        
        $params_default = array(
            'cache_file' => null,
            'ttl' => null,
        );
        $params = array_merge($params_default, $params);
        
        if (is_null($params['cache_file'])) {
            return null;
        }
        
        if (file_exists($params['cache_file'])) {
            $cache_file = $params['cache_file'];
            if (is_null($params['ttl'])) {
                return json_decode(file_get_contents($cache_file), 1);
            } else {
                $file_ts = file_ts($cache_file);
                $now_ts = time();                
                if ($now_ts < ($file_ts + $params['ttl'])) {
                    return json_decode(file_get_contents($cache_file), 1);
                }                
            }
        }
        
        return null;
    }
    
    private static function parseDBResult($result, $cache_file = null) {
        $rows = array();
        while($row = $result->fetchArray(SQLITE3_ASSOC)) {
            array_push($rows, $row);
        }
        
        if ($cache_file) {
            self::cacheResults($cache_file, $rows);
        }
        
        return $rows;
    }
    
    private static function checkIfWritable($file) {
        if (file_exists($file)) {
            return is_writable($file);
        } else {
            return is_writable(dirname($file));
        }
        
        return false;
    }
    
    private static function cacheResults($file, $content) {
        if (self::$use_file_cache === FALSE) {
            return null;
        }
        
        if (self::checkIfWritable($file)) {
            file_put_contents($file, json_encode($content));
        } else {
            error_log('DB::cacheResults - no write rights for ' . $file);
        }
    }
    
    public static function getCalendarRows() {
        $cache_file = APP_FOLDER_PATH . '/tmp/cache/db/calendar.json';
        $cached_results = self::getCachedResults(array(
            'cache_file' => $cache_file
        ));
        if ($cached_results) {
            return $cached_results;
        }
        
        $db = self::getDB();
        $result = $db->query('SELECT * FROM calendar');
        $rows = self::parseDBResult($result, $cache_file);
        return $rows;
    }
    
    public static function getTripsByMinute($hhmm, $service_ids) {
        $cache_file = APP_FOLDER_PATH . '/tmp/cache/db/trips_' . sha1(implode('', $service_ids)) . '_' . $hhmm . '.json';
        $cached_results = self::getCachedResults(array(
            'cache_file' => $cache_file
        ));
        if ($cached_results) {
            return $cached_results;
        }
        
        $db = self::getDB();
        
        $hhmm_seconds = substr($hhmm, 0, 2) * 3600 + substr($hhmm, 2) * 60;
        $hhmm_seconds_midnight = $hhmm_seconds + 24 * 3600;
        
        $sql = "SELECT trip_id, route_short_name, route_long_name, route_color, route_text_color, trip_headsign, shape_id, service_id FROM trips, routes WHERE trips.route_id = routes.route_id AND ((trip_start_seconds < " . $hhmm_seconds . " AND trip_end_seconds > " . $hhmm_seconds . ") OR (trip_start_seconds < " . $hhmm_seconds_midnight . " AND trip_end_seconds > " . $hhmm_seconds_midnight . "))";
        $stmt = $db->prepare($sql);
        $result = $stmt->execute();
        
        $rows = array();
        while($row = $result->fetchArray(SQLITE3_ASSOC)) {
            if (empty($service_ids) || in_array($row['service_id'], $service_ids)) {
                array_push($rows, $row);
            }
        }
        
        if ($cache_file) {
            self::cacheResults($cache_file, $rows);
        }
        
        return $rows;
    }
    
    public static function getStopsByTripId($trip_id) {
        $cache_file = APP_FOLDER_PATH . '/tmp/cache/db/trip_' . $trip_id . '.json';
        $cached_results = self::getCachedResults(array(
            'cache_file' => $cache_file
        ));
        if ($cached_results) {
            return $cached_results;
        }
        
        $db = self::getDB();
        
        $stmt = $db->prepare('SELECT stops.stop_id, stops.stop_name, arrival_time, departure_time, stop_shape_percent FROM stop_times, stops WHERE stops.stop_id = stop_times.stop_id AND stop_times.trip_id = :trip_id ORDER BY stop_sequence;');
        $stmt->bindValue(':trip_id', $trip_id, SQLITE3_TEXT);
        $result = $stmt->execute();
        
        $rows = self::parseDBResult($result, $cache_file);
        return $rows;
    }
}