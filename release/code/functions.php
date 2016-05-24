<?php

// this function will be called if we want to build the content on the server
function buildContent($lang) {
	// array of file names to use
	// NOTE: the textboxes will be created and ordered in the same order of the array
	$file_list = array("narrator_box", "style_box", "script_box", "about_box");

	// array with the strings to return
	$res = array("style" => "", "script" => "");

	// loop through the file list and create the textboxes HTML
	$file_count = 0;
	foreach ($file_list as $file) {
		// grab the file's content
		$file_content = getFileContent($file, $lang);

		// skip if this file has no content
		if (empty($file_content)) {
			continue;
		}

		// run this file's content through the CSS text color coding function
		$content_aux = addStyleTags(preg_replace("/(\n|\r\n)/", "\r", $file_content));
		// store the styles
		$res["style"] .= $content_aux["style"];

		// run this file's content through the CSS text color coding function
		$content_aux = addScriptTags($content_aux["color_coded"]);
		// store the scripts
		$res["script"] .= $content_aux["script"];

		// store this file's content with color coding
		// making sure to remove any "goto" tags and any "\r" after it (to avoid having empty lines int he final result)
		$res[$file] = preg_replace("/<goto[^>]*>\r?/i", "", $content_aux["color_coded"]);

		// create this file's text box (the final html for this file)
		$res[$file] = "<div id='".$file."' class='content flex_item' style='order:".$file_count++.";'>
			<div class='header header_expanded'>
				<div class='header_text'>".strtoupper($file)."</div>
				<div class='header_button hb_expanded'></div>
			</div>
			<div class='text text_expanded'>".$res[$file]."</div>
		</div>";
	}

	return($res);
}

// receives a file name and returns that file's content
// returns an empty string if no file is found
function getFileContent($file_name, $lang) {
	$res = "";

	// path to the data folder, where the .txt file are located
	$file_path = dirname(dirname(__FILE__))."/data/";

	// grab the file's content
	if (file_exists($file_path.$file_name.".txt")) {
		// the file is language independent
		$res = file_get_contents($file_path.$file_name.".txt");
	}else if (file_exists($file_path.$lang."/".$file_name.".txt")) {
		// the file is language dependent
		$res = file_get_contents($file_path.$lang."/".$file_name.".txt");
	}

	// sanity check
	if ($res === False) {
		// the content couldn't be retrieved, so unset this file's entry and move on to next one
		$res = "";
	}

	return($res);
}

// this function will add <span> tags to a string, to color code for CSS
// NOTE: this function has the following differences to the equivalent JS fuction:
//		- the opening and closing style tags will be removed (we don't need them after this function returns)
//		- returns also the style text without any color coding tags (to insert in the style tag)
function addStyleTags($text) {
	// variables used to execute this task
	$tag_start = 0;
	$tag_end = 0;
	$strs_final = array("color_coded" => "", "style" => "");
	$str_temp = "";
	$re_key_word = "/(@[\w\t ]+)\(/i";
	$re_selector = "/([\w\*\.\#\t: ]+)(\s?[\{,])/i";
	$re_property = "/([\{;\(]\s*)([\w-]+)(\s*:)/i";
	$re_value = "/:([^:;]*)([;)])/i";
	$re_value_units = "/(\d)(px|%|rem|em|vh|vw|s|ms)/i";

	// loop until we've added all necessary tags
	while (true) {
		// search the text for the next
		if (preg_match("/\<style[^\<]*\>/i", $text, $regex_matches, PREG_OFFSET_CAPTURE) === false) {
			// an error occured, so bail out
			break;
		}

		// if we've reached the end of the text OR there are no more style tags left
		// exit the loop
		if (empty($regex_matches)) {
			// add any parts of the text not processed at the end
			if (strlen($text) > 0) {
				$strs_final["color_coded"] .= substr($text, 0);
			}

			// all the text is processed, so exit the loop and continue code
			break;
		}

		// grab the index of the next style tag and place the index after the style tag
		$tag_start = $regex_matches[0][1] + strlen($regex_matches[0][0]);

		// add the text between the last character added and the < of the style tag
		$strs_final["color_coded"] .= substr($text, 0, $regex_matches[0][1]);

		// find the index of the next closing style tag
		$tag_end = strpos($text, "</style>", $tag_start);
		// if no closing style tag exists, then the block goes until the end of the text
		if ($tag_end === false) {
			$tag_end = strlen($text);
		}

		// grab the text inside the style tag
		$str_temp = substr($text, $tag_start, $tag_end - $tag_start);

		// store the styles text without any color coding tags
		$strs_final["style"] .= $str_temp;

		// add the Key Word spans
		$str_temp = preg_replace($re_key_word, "<span class='css_keyword'>$1</span>(", $str_temp);

		// add the selector spans
		$str_temp = preg_replace($re_selector, "<span class='css_selector'>$1</span>$2", $str_temp);

		// remove any selector span tags that might have been placed inside the property:value area
		$str_temp = preg_replace_callback("/\{([^{}]+)<span class='css_selector'>([^{}]+)<\/span>([^{}]+)\}/i", function($regex_matches) {
			return(preg_replace("/<span class='css_selector'\s*>([^\/]+)<\/span>/i", "$1", $regex_matches[0]));
		}, $str_temp);

		// add the property spans
		$str_temp = preg_replace($re_property, "$1<span class='css_property'>$2</span>$3", $str_temp);
		// add the value spans
		$str_temp = preg_replace($re_value, ":<span class='css_value'>$1</span>$2", $str_temp);
		// add the px spans
		$str_temp = preg_replace($re_value_units, "$1<span class='css_units'>$2</span>", $str_temp);

		// add the new style tag content
		$strs_final["color_coded"] .= $str_temp;

		// advance current index to the character after the closing style tag
		$text = substr($text, $tag_end + 8);
	}

	return($strs_final);
}

// this function will add <span> tags to a string, to color code for JS
// NOTE: this function has the following differences to the equivalent JS fuction:
//		- the opening and closing script tags will be removed (we don't need them after this function returns)
//		- returns also the script text without any color coding tags (to insert in the style tag)
function addScriptTags($text) {
	// local variables used to execute this task
	$tag_start = 0;
	$tag_end = 0;
	$strs_final = array("color_coded" => "", "script" => "");
	$str_temp = "";
	$re_function_declaration = "/(function[\t ]+)(\w+[\t ]*)\(([^\)]*)\)([\t ]*{)/i";
	$re_key_word = "/([\w])?(new|while|for|break|continue|try|catch|return|if|else|typeof)([^\w])/i";
	$re_math_operator = "/([^<])(\++|\-+|\*|\/)/i";
	$re_logic_operator = "/(&&|\|\||!=|={1,3}|<|>)/i";
	$re_object = "/(Object|var|document)/i";
	$re_value = "/(\d|true|false|null)/i";
	$re_method = "/\.(\w+)/i";
	$re_string = "/(\"[^\"]*\")/i";
	$re_regexp = "/([^<>])(\/[^\/]+\/[gmi]*)/i";

	// loop until we've added all necessary tags
	while (true) {
		// search the text for the next
		if (preg_match("/\<script[^\<]*\>/i", $text, $regex_matches, PREG_OFFSET_CAPTURE) === false) {
			// an error occured, so bail out
			break;
		}

		// if we've reached the end of the text OR there are no more script tags left
		// exit the loop
		if (empty($regex_matches)) {
			// add any parts of the text not processed at the end
			if (strlen($text) > 0) {
				$strs_final["color_coded"] .= substr($text, 0);
			}

			// all the text is processed, so exit the loop and continue code
			break;
		}

		// grab the index of the next script tag and place the index after the script tag
		$tag_start = $regex_matches[0][1] + strlen($regex_matches[0][0]);

		// add the text between the last character added and the < of the script tag
		$strs_final["color_coded"] .= substr($text, 0, $regex_matches[0][1]);

		// find the index of the next closing script tag
		$tag_end = strpos($text, "</script>", $tag_start);
		// if no closing script tag exists, then the block goes until the end of the text
		if ($tag_end === false) {
			$tag_end = strlen($text);
		}

		// grab the text inside the script tag
		$str_temp = substr($text, $tag_start, $tag_end - $tag_start);

		// store the script text without any color coding tags
		// ony add function declarations --> no function calls, since we're not building the content with the Js code
		$strs_final["script"] .= processScriptText($re_function_declaration, $str_temp);

		// add the logic operator spans
		$str_temp = preg_replace($re_logic_operator, "<span class='js_logicoperator'>$1</span>", $str_temp);
		// add the math operator spans
		$str_temp = preg_replace($re_math_operator, "$1<span class='js_mathoperator'>$2</span>", $str_temp);
		// add the function declaration spans
		$str_temp = preg_replace($re_function_declaration, "<span class='js_func_word'>$1</span><span class='js_func_name'>$2</span>(<span class='js_func_param'>$3</span>)$4", $str_temp);
		// add the keyWord spans
		$str_temp = preg_replace($re_key_word, "$1<span class='js_keyword'>$2</span>$3", $str_temp);
		// add the object spans
		$str_temp = preg_replace($re_object, "<span class='js_object'>$1</span>", $str_temp);
		// add the value spans
		$str_temp = preg_replace($re_value, "<span class='js_value'>$1</span>", $str_temp);
		// add the method spans
		$str_temp = preg_replace($re_method, ".<span class='js_method'>$1</span>", $str_temp);

		// remove the math operator span tag from the / with the meaning of start and end of a regexp
		$str_temp = preg_replace("/<span class='js_mathoperator'\s*>\/<\/span>([^\/]+)<span class='js_mathoperator'\s*>\/<\/span>([gmi]*)/i", "/$1/$2", $str_temp);

		// if there are any regexp in the script text
		// first remove any of the span tags placed above from text inside regexp
		// then add the regexp spans
		if (preg_match($re_regexp, $str_temp, $re_match, PREG_OFFSET_CAPTURE) !== false && !empty($re_match)) {
			// auxiliary variable used to store the cleaned regexp
			$str_aux = "";

			// loop until there are no more regexp to process
			do {
				// grab the text before the regexp (no processing needed)
				$str_aux .= substr($str_temp, 0, $re_match[0][1]);

				// for the text inside the regexp, first remove any other color coding span tags from previous steps
				$str_aux .= preg_replace(
					$re_regexp,
					"$1<span class='js_regexp'>$2</span>",
					preg_replace_callback(
						$re_regexp,
						function($regex_matches) {
							// explicitely remove any js_mathoperator span tags that may have been placed around other html tags
							return(preg_replace("/<span class='js_mathoperator'\s*>([<>]+)<\/span>/i", "$1", $regex_matches[0]));
						},
						substr($str_temp, $re_match[0][1], strlen($re_match[0][0]))
					)
				);

				// remove the processed text from the non-processed text
				$str_temp = substr($str_temp, $re_match[0][1] + strlen($re_match[0][0]));
			} while (preg_match($re_regexp, $str_temp, $re_match, PREG_OFFSET_CAPTURE) !== false && !empty($re_match));

			// add any final characters that don't need to be processed
			$str_aux .= $str_temp;
			// store the final string on the original variable
			$str_temp = $str_aux;
		}

		// if there are any strings in the script text
		// first remove any of the span tags placed above from text inside strings
		// then add the string spans
		if (preg_match($re_string, $str_temp, $re_match, PREG_OFFSET_CAPTURE) !== false && !empty($re_match)) {
			// auxiliary local variable used to store the cleaned string
			$str_aux = "";

			// loop until there are no more strings to process
			do {
				// grab the text before the string (no processing needed)
				$str_aux .= substr($str_temp, 0, $re_match[0][1]);

				// for the text inside the string, first remove any other color coding span tags from previous steps
				$str_aux .= preg_replace(
					$re_string,
					"<span class='js_string'>$1</span>",
					preg_replace_callback(
						$re_string,
						function($regex_matches) {
							// explicitely remove any js_mathoperator span tags that may have been placed around other html tags
							return(preg_replace(
								"/<span\s+class='(css|js)_\w+'\s*>([^>]*)<\/span>/i",
								"$2",
								preg_replace(
									"/<span class='js_mathoperator'\s*>([<>]+)<\/span>/i",
									"$1",
									$regex_matches[0]
								)
							));
						},
						substr($str_temp, $re_match[0][1], strlen($re_match[0][0]))
					)
				);

				// remove the processed text from the non-processed text
				$str_temp = substr($str_temp, $re_match[0][1] + strlen($re_match[0][0]));
			} while (preg_match($re_string, $str_temp, $re_match, PREG_OFFSET_CAPTURE) !== false && !empty($re_match));

			// add any final characters that don't need to be processed
			$str_aux .= $str_temp;
			// store the final string on the original variable
			$str_temp = $str_aux;
		}

		// add the new script tag content
		$strs_final["color_coded"] .= $str_temp;

		// advance current index to the character after the closing script tag
		$text = substr($text, $tag_end + 9);
	}

	return($strs_final);
}

// this function will remove any JS code that isn't a function declaration
// NOTE: this function checks for { and } as the block delimiters, but doesn't check if
//		 the { and } found are inside comments, strings or regex. It will count them as block delimiters
function processScriptText($re_function_declaration, $text) {
	// this variable will store the function declarations
	$res = "";

	// variables used to control the flow of the algorithm
	$block_start = 0;
	$block_end = 0;
	$net_count_brakets = 0;

	// check if there is any function declarations
	while (preg_match($re_function_declaration, $text, $re_match, PREG_OFFSET_CAPTURE) !== false && !empty($re_match)) {
		// store the index of the function's block start
		$block_start = $re_match[0][1];

		// start by searching for the closing braket from the opening of the funtion declaration
		$block_end = $block_start;

		do {
			// find the potential closing braket for this function block
			$block_end = strpos($text, "}", $block_end);
			// if there are no more closing brakets, go to the end of the text
			if ($block_end === false) {
				$block_end = strlen($text) - 1;
			}

			// grab this block's string
			$aux = substr($text, $block_start, $block_end - $block_start + 1);

			// count the net number of opening vs closing brakets in this substr
			$net_count_brakets = substr_count($aux, "{") - substr_count($aux, "}");

			// advance the block_end 1 position
			$block_end++;
		} while ($net_count_brakets != 0 && $block_end < strlen($text) - 1);

		// store the function declaration block
		$res .= substr($text, $block_start, $block_end - $block_start + 1);

		// update the source text
		$text = substr($text, $block_end);
	}

	return($res);
}

?>
