<?php
define('APP_FOLDER_PATH', dirname(__FILE__) . '/../..');
include(APP_FOLDER_PATH . '/inc/init.php');

$json = file_get_contents(APP_FOLDER_PATH . '/gtfs-data/' . $_GET['file']);
JsonView::dump($json);