<?php

// handles building the page's content on the server, for the given language
function buildContent($lang) {
	// stores the textbox file names to use
	// NOTE: the textboxes will be created and ordered in the same order of this array
	$file_list = array("narrator_box", "style_box", "script_box", "about_box");

	// stores the content to be returned
	$res = array("style" => "", "script" => "");

	// loop through the file list and create the textboxes HTML
	for ($i = 0; $i < count($file_list); $i++) {
		// get this file's content
		$file_content = getFileContent($file_list[$i], $lang);

		// check if this file has no content
		if (empty($file_content)) {
			// it doesn't, so skip it
			continue;
		}

		// standardize the line breaks used in the file's content
		$file_content = preg_replace("/(\n|\r\n)/", "\r", $file_content);

		// run this file's content through the CSS color coding function
		$content_parts = addStyleTags($file_content);

		// store the raw CSS code (without any color coding tags)
		$res["style"] .= $content_parts["style"];

		// store the new file content, now with the CSS color coding tags
		$file_content = $content_parts["color_coded"];

		// run this file's content through the JS color coding function
		$content_parts = addScriptTags($file_content);

		// store the raw JS code (without any color coding tags)
		$res["script"] .= $content_parts["script"];

		// store the new file content, now with the JS color coding tags
		$file_content = $content_parts["color_coded"];

		// store this file's content (with color coding)
		// making sure to remove any "goto" tags and any "\r" after it (avoiding empty lines in the final result)
		$res[$file_list[$i]] = preg_replace("/<goto[^>]*>\r?/i", "", $file_content);

		// create this file's textbox HTML
		$res[$file_list[$i]] = "<div id='".$file_list[$i]."' class='content flex_item' style='order:".$i.";'>
			<div class='header header_expanded'>
				<div class='header_text'>".strtoupper($file_list[$i])."</div>
				<div class='header_button hb_expanded'></div>
			</div>
			<div class='text text_expanded'>".$res[$file_list[$i]]."</div>
		</div>";
	}

	// return the processed data
	return($res);
}

// receives a file name and returns that file's content
// returns an empty string if no file is found
function getFileContent($file_name, $lang) {
	// stores the file's content
	$file_content = "";

	// build path to the data folder, where the .txt files are located
	$data_path = dirname(dirname(__FILE__))."/data/";

	// check if the file is language independent
	if (file_exists($data_path.$file_name.".txt")) {
		// it is
		// get the requested file's content
		$file_content = file_get_contents($data_path.$file_name.".txt");
	// check if the file is language dependent
	}else if (file_exists($data_path.$lang."/".$file_name.".txt")) {
		// it is
		// get the requested file's content
		$file_content = file_get_contents($data_path.$lang."/".$file_name.".txt");
	}

	// check if the file_get_contents() returned a failure
	if ($file_content === False) {
		// it did
		// the content couldn't be retrieved, so set this file's content to an empty string
		$file_content = "";
	}

	// return this file's content
	return($file_content);
}

// handles adding <span> tags for CSS color coding
// NOTE: this function has the following differences to the equivalent JS fuction:
//		- the opening and closing style tags will be removed (we don't need them after this function returns)
//		- returns also the style text without any color coding tags (to insert in the style tag)
function addStyleTags($text) {
	// variables used to execute this task
	$tag_content_start = 0;
	$tag_end = 0;
	$strs_final = array("color_coded" => "", "style" => "");
	$str_temp = "";
	$re_key_word = "/(@[\w\t ]+)\(/i";
	$re_selector = "/([\w\*\.\#\t: ]+)(\s?[\{,])/i";
	$re_property = "/([\{;\(]\s*)([\w-]+)(\s*:)/i";
	$re_value = "/:([^:;]*)([;)])/i";
	$re_value_units = "/(\d)(px|%|rem|em|vh|vw|s|ms)/i";

	// loop while there are style tags to process
	while (preg_match("/\<style[^\<]*\>/i", $text, $regex_matches, PREG_OFFSET_CAPTURE) !== false && !empty($regex_matches)) {
		// get the index of the character after this opening tag
		$tag_content_start = $regex_matches[0][1] + strlen($regex_matches[0][0]);

		// add the text between the last processed tag and the start of this style tag
		$strs_final["color_coded"] .= substr($text, 0, $regex_matches[0][1]);

		// find the index of the next closing style tag
		$tag_end = strpos($text, "</style>", $tag_content_start);

		// check if a closing style tag was found
		if ($tag_end === false) {
			// it wasn't
			// assume the tag goes to the end of the text
			$tag_end = strlen($text);
		}

		// get the text inside this style tag
		$str_temp = substr($text, $tag_content_start, $tag_end - $tag_content_start);

		// store this tag's content without any color coding tags
		$strs_final["style"] .= $str_temp;

		// add the keyword spans
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

		// add the units spans
		$str_temp = preg_replace($re_value_units, "$1<span class='css_units'>$2</span>", $str_temp);

		// store this tag's content with the color coding tags
		$strs_final["color_coded"] .= $str_temp;

		// remove this tag's content from the text to process
		$text = substr($text, $tag_end + 8);
	}

	// add any text after the last processed style tag to the final string
	$strs_final["color_coded"] .= $text;

	// return the processed strings
	return($strs_final);
}

// handles adding <span> tags for JS color coding
// NOTE: this function has the following differences to the equivalent JS fuction:
//		- the opening and closing script tags will be removed (we don't need them after this function returns)
//		- returns also the script text without any color coding tags (to insert in the style tag)
function addScriptTags($text) {
	// local variables used to execute this task
	$tag_content_start = 0;
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
	$re_js_string = "/(\"[^\"]*\")/i";
	$re_js_regexp = "/([^<>])(\/[^\/]+\/[gmi]*)/i";

	// loop while there are script tags to process
	while (preg_match("/\<script[^\<]*\>/i", $text, $regex_matches, PREG_OFFSET_CAPTURE) !== false && !empty($regex_matches)) {
		// get the index of the character after this opening tag
		$tag_content_start = $regex_matches[0][1] + strlen($regex_matches[0][0]);

		// add the text between the last processed tag and the start of this style tag
		$strs_final["color_coded"] .= substr($text, 0, $regex_matches[0][1]);

		// find the index of the next closing script tag
		$tag_end = strpos($text, "</script>", $tag_content_start);

		// check if a closing script tag was found
		if ($tag_end === false) {
			// it wasn't
			// assume the tag goes to the end of the text
			$tag_end = strlen($text);
		}

		// get the text inside this script tag
		$str_temp = substr($text, $tag_content_start, $tag_end - $tag_content_start);

		// store this tag's content without the color coding tags
		// ony add function declarations --> no function calls
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

		// stores the tag identifiers that need to be processed with special treatment
		$regex_keys = ["js_regexp", "js_string"];

		// stores the replacement regex string for the values of regex_keys
		$regex_strings = [
			"$1<span class='js_regexp'>$2</span>",
			"<span class='js_string'>$1</span>"
		];

		// loop through the relevant tag identifiers in the stated order
		for ($i = 0; $i < count($regex_keys); $i++) {
			// get this iteration's tag identifier
			$regex_key = $regex_keys[$i];

			// stores the processed chunk of text as its being cleaned up below
			$str_aux = "";

			// get the regex match object for the existance of this tag in the text
			$re_match = null;

			// loop while there are tags to process in the text
			while (preg_match(${"re_".$regex_key}, $str_temp, $re_match, PREG_OFFSET_CAPTURE) !== false && !empty($re_match)) {
				$str_aux .= substr($str_temp, 0, $re_match[0][1]);

				// for the text inside this tag, remove any other color coding span tags from previous steps
				// and finaly add this tag's color coding spans
				$str_aux .= preg_replace(
					${"re_".$regex_key},
					$regex_strings[$i],
					preg_replace_callback(
						${"re_".$regex_key},
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
			}

			// add any final characters that didn't need to be processed
			$str_aux .= $str_temp;

			// store the processed text
			$str_temp = $str_aux;
		}

		// add the new script tag content
		$strs_final["color_coded"] .= $str_temp;

		// remove this tag's content from the text to process
		$text = substr($text, $tag_end + 9);
	}

	// add any text after the last processed script tag to the final string
	$strs_final["color_coded"] .= $text;

	return($strs_final);
}

// handles removing any JS code that isn't a function declaration
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
