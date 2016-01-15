<?php
error_reporting(0);

// build the path for a language insensitive file
$path = "../../data/".$_GET["fn"].".txt";
// check if the file exists in the data folder (not language dependent)
if (file_exists($path)) {
	// get and return th file's content
	echo(file_get_contents($path));
}else{
	// build the path for a language sensitive file
	$path = "../../data/".$_GET["lang"]."/".$_GET["fn"].".txt";
	if (file_exists($path)) {
		// get and return th file's content
		echo(file_get_contents($path));
	}else{
		// didn't find the file, so return empty string
		echo("");
	}
}

?>