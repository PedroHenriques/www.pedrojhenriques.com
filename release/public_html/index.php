<!DOCTYPE html>

<?php
// FIXME: turn this back on!!
// error_reporting(0);

// require the php file with all the custom functions
require(dirname(dirname(__FILE__))."/code/functions.php");

// grab the language, if any
// defaults to english
$lang = (isset($_GET["lang"]) ? strtoupper($_GET["lang"]) : "EN");

// get the info for index.php from the respective JSON file
$json_file = file_get_contents("../data/index_info.json");
$json_a = json_decode($json_file, true);

// check if we want to build the content of the page on the server
// will do so if the URL adress has "/complete" OR if the "HTTP_USER_AGENT" indicates a bot
$is_bot = isset($_SERVER["HTTP_USER_AGENT"]) && preg_match("/bot|crawl|slurp|spider/i", $_SERVER["HTTP_USER_AGENT"]);
$with_content = $is_bot || (isset($_GET["complete"]) && (int)$_GET["complete"] === 1);

// if we want to build the content on the server, do it
if ($with_content) {
	$content = buildContent($lang);

	// separate the information
	$full_style = $content["style"];
	unset($content["style"]);
	$full_script = $content["script"];
	unset($content["script"]);
}
?>

<html xmlns="http://www.w3.org/1999/xhtml" lang=<?php echo($lang); ?> >
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <meta name="description" content=<?php echo($json_a["description"][$lang]); ?> />
    <meta name="keywords" content=<?php echo($json_a["keywords"][$lang]); ?> />
	<meta name="author" content="http://www.pedrojhenriques.com">
	<meta name="copyright" content="<?php echo($json_a["copyright"][$lang]); ?>">

    <title><?php echo($json_a["title"][$lang]); ?></title>

    <link rel="icon" type="image/png" sizes='16x16' href="/assets/images/favicon_16x16.png"/>
    <link rel="icon" type="image/png" sizes='32x32' href="/assets/images/favicon_32x32.png"/>
    <link rel="icon" type="image/png" sizes='96x96' href="/assets/images/favicon_96x96.png"/>

    <link rel='stylesheet' type='text/css' href='/assets/css_js/joined.min.css'/>
</head>

<body <?php echo($with_content ? "onload='init(true);'" : "onload='init(false);'"); ?> >
    <style type='text/css'><?php echo($with_content ? $full_style : ""); ?></style>
    <div id='container'>
        <div id='work_area' <?php echo($with_content ? "" : "class='no_events'"); ?> >
			<?php
			// if we're loading the full content, add the text boxes
			if ($with_content) {
				foreach ($content as $text_box) {
					echo($text_box);
				}
			}
			?>
		</div> <!-- end of work_area -->
        <div id='footer'>
            <div id='footer_controls' <?php echo($with_content ? "class='no_events opacity_zero'" : ""); ?> >
                <span><strong><?php echo($json_a["speeds"][$lang]); ?></strong></span>
                <span class='speed selected' onclick='setSpeed(1);'>&gt;</span>
                <span class='speed clickable' onclick='setSpeed(2);'>&gt;&gt;</span>
                <span class='speed clickable' onclick='setSpeed(3);'>&gt;&gt;&gt;</span>
                <span id='pause_button' class='clickable' onclick='pauseExec();'><?php echo($json_a["pause"][$lang]); ?></span>
                <span id='resume_button' class='clickable hidden' onclick='resumeExec();'><?php echo($json_a["resume"][$lang]); ?></span>
				<?php
				if (!$is_bot) {
					echo("
                	<a class='clickable' href='http://pedrojhenriques.com/".$lang."/complete' target='_self'>".$json_a["skip"][$lang]."</a>
					");
				}
				?>
            </div>
            <div id='footer_lang'>
                <a href='/EN' target='_self'><img src="/assets/images/EN.jpg"></a>
                <a href='/PT' target='_self'><img src="/assets/images/PT.jpg"></a>
            </div>
            <div id='footer_links'>
                <a <?php echo("href='http://www.linkedin.com/in/pedrojhenriques/".strtolower($lang)."'"); ?> target='_blank'>LinkedIn</a>
                <a href='https://codepen.io/PedroHenriques/' target='_blank'>CodePen</a>
                <a href='https://github.com/PedroHenriques/' target='_blank'>GitHub</a>
                <a href='https://github.com/PedroHenriques/www.pedrojhenriques.com' target='_blank'><?php echo($json_a["source_code"][$lang]); ?></a>
            </div>
        </div> <!-- end of footer -->
    </div> <!-- end of container -->

	<script type='text/javascript' src='/assets/css_js/joined.min.js'></script>
	<?php
	// if we're loading the full content, add the script text
	if ($with_content) {
		echo("<script type='text/javascript'>".$full_script."</script>");
	}
	?>
</body>

</html>
