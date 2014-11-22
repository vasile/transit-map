<?php
define('APP_FOLDER_PATH', dirname(__FILE__) . '/../..');
include(APP_FOLDER_PATH . '/inc/init.php');

if (isset($_GET['file'])) {
    $file = APP_FOLDER_PATH . '/geojson/' . $_GET['file'];
    if (file_exists($file)) {
        $json = file_get_contents($file);
    } else {
        error_log('GeoJSON error: ' . $file . ' not found !');
        $json = array(
            'error' => 'Cannot load ' . $_GET['file'] . ' !'
        );
    }
} else {
    $json = array(
        'error' => 'Missing file parameter, i.e. file=stations.geojson'
    );
}

JsonView::dump($json);