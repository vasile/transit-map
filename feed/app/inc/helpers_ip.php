<?php

class helpers_ip {
    public static function isWhiteListed() {
        $ips = array(
            '127.0.0.1'
        );
        $visitorIP = getenv('REMOTE_ADDR');
        
        return in_array($visitorIP, $ips);
    }
}