<?php
error_reporting(0);

// require the php file with all the custom functions
require(dirname(dirname(dirname(__FILE__)))."/code/functions.php");

// check if a file name was provided
if (isset($_GET["fn"])) {
	// it was
	// get the desired file's name
	$file_name = $_GET["fn"];
}else{
	// it wasn't, so echo an empty string and bail out
	echo("");
	exit;
}

// check if a language tag was provided
if (isset($_GET["lang"])) {
	// it was
	// get the language
	$lang = $_GET["lang"];
}else{
	// it wasn't
	// default to english
	$lang = "EN";
}

// get the file's content and echo it
echo(getFileContent($file_name, $lang));

?>
