<?php

// Add a "production mode" based on localhost ?
ini_set('display_errors', 1);
error_reporting(E_ALL);

$api_config_file = dirname(__FILE__) . '/config.json';
$api_config = json_decode(file_get_contents($api_config_file), 1);

ini_set('date.timezone', $api_config['SERVER_TIMEZONE']);

include(APP_FOLDER_PATH . '/inc/models/db.php');
include(APP_FOLDER_PATH . '/inc/models/gtfs.php');
include(APP_FOLDER_PATH . '/inc/views/json.php');
