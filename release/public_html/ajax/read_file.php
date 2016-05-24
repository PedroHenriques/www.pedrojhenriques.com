<?php
error_reporting(0);

// require the php file with all the custom functions
require(dirname(dirname(dirname(__FILE__)))."/code/functions.php");

// grab the file name
if (isset($_GET["fn"])) {
	$file_name = $_GET["fn"];
}else{
	// no file name was passed, so echo an empty stringe
	echo("");
	exit;
}

// grab the language
if (isset($_GET["lang"])) {
	$lang = $_GET["lang"];
}else{
	// default to english
	$lang = "EN";
}

// grab the file's content and echo it
echo(getFileContent($file_name, $lang));

?>
