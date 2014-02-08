<?php
define('APP_FOLDER_PATH', dirname(__FILE__) . '/../..');
include(APP_FOLDER_PATH . '/inc/init.php');

$trip_rows = GTFS::getTripsByMinute($_GET['hhmm']);
JsonView::dump($trip_rows);