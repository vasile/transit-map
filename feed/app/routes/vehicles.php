<?php
define( 'APP_ROOT', dirname(__FILE__) . '/../' );
include(APP_ROOT . 'inc/init.php');

$rows = Vehicles::get(@$_GET['hm']);
Vehicles::json_dump($rows);