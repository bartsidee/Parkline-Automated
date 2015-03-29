<?php
require_once(dirname(__FILE__) . "/proxy.whitelist.php");

//support NGINX server which is missing getallheaders function
if (!function_exists('getallheaders')) 
{
    function getallheaders() 
    {
       foreach ($_SERVER as $name => $value) 
       {
           if (substr($name, 0, 5) == 'HTTP_') 
           {
               $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
           }
       }
       return $headers;
    }
}

function get_ip_address() { 
	$ip; 
	if (getenv("HTTP_CLIENT_IP")) 
		$ip = getenv("HTTP_CLIENT_IP"); 
	else if(getenv("HTTP_X_FORWARDED_FOR")) 
		$ip = getenv("HTTP_X_FORWARDED_FOR"); 
	else if(getenv("REMOTE_ADDR")) 
		$ip = getenv("REMOTE_ADDR"); 
	else 
		$ip = null;
	return $ip; 
}

if (isset($_SERVER['QUERY_STRING']) && is_array(parse_url($_SERVER['QUERY_STRING'])) && preg_match("(".$whitelist.")", $_SERVER['QUERY_STRING'])) {
    //Setup headers
    $headers = array();
    
    //insert Client IP to pass GEOBindings
	$ip = get_ip_address();
    if ($ip) {
    	$headers[] = "X-Forwarded-For: $ip";
   	}
    
    //pass all custom X-HEADERS
    foreach (getallheaders() as $name => $value) {
        if (strpos($name, "Authorization") !== false || strpos($name, "Content-Type") !== false || strpos($name, "Username") !== false || strpos($name, "Password") !== false || strpos($name, "Country") !== false || strpos($name, "Accept") !== false) {
            $headers[] = "$name: $value";
        }
    }

	//Init Curl
    $ch = curl_init();
    
    //Add post data if available
    if ( $_SERVER['REQUEST_METHOD'] == 'POST' ) {
      $POSTDATA = (isset($_POST)) ? file_get_contents("php://input") : $_POST; 
      curl_setopt( $ch, CURLOPT_POST, true );
      curl_setopt( $ch, CURLOPT_POSTFIELDS, $POSTDATA );
    }
  	
  	//Set other attributes
    curl_setopt($ch, CURLOPT_URL, $_SERVER['QUERY_STRING']);
    curl_setopt($ch, CURLOPT_HEADER, 0);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_ENCODING, "identity");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 30);
    curl_setopt($ch, CURLOPT_USERAGENT, isset($_GET['user_agent']) ? $_GET['user_agent'] : $_SERVER['HTTP_USER_AGENT'] );
    
    //Execute curl request
    $rs = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    
    //return info
    if ($info['http_code'] == 200) {
      header('Content-type: ' . $info['content_type']);
      print $rs;
    } else {
      header('HTTP/1.1 ' . $info['http_code']);
      header('Content-type: ' . $info['content_type']);
      print $rs;
    }
} else {
  header ('HTTP/1.1 400 Bad Request');
}
?>

