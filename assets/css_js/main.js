// runs once the document is done loading
// sets basic parameters used to run the application
// then starts the application (if building the content dynamically with JS)
// OR simply sets the expand/collapse event listeners (if the content as built on the server)
function init(built_on_server) {
	// list of file names to use
	// the files must be .txt and should have the name of the DOM element's ID where their
	// content will be written to
	var file_list = ["narrator_box", "style_box", "script_box", "about_box"];

	// the name of the first file to run
	var first_file = "narrator_box";

	// get the currently active language
	lang_ = document.getElementsByTagName("html")[0].lang.toUpperCase();
	// validate lang
	var valid_langs = new Array("PT", "EN"); // valid lang tags
	if (valid_langs.indexOf(lang_) == -1) {
		// if not a valid lang tag, set to default
		lang_ = "EN";
	}

	// global variable used to store all the DIV elements where files are written to
	tag_divs_ = new Array;

	// if the content was built on the server, populate tag_divs_ and return
	if (built_on_server) {
		// loop through the files and grab a reference to the respective element
		for (var i = 0; i < file_list.length; i++) {
			tag_divs_[file_list[i]] = document.getElementById(file_list[i]);
		}
	}

	// grab relevant document elements
	tag_style_ = document.body.getElementsByTagName("style")[0];
	div_work_area_ = document.getElementById("work_area");

	// global variable where all the text files' content are stored
	// together with the index, in each file, that we're on
	files_content_ = new Object;

	// set global variables used to control the application
	textbox_count_ = 0;
	setDefaultSpeeds(); // sets the global variable with the default speeds
	forced_speed_ = null; // used to force the application into a specific speed, regardless of what character we're writing to screen
	building_style_ = false;
	building_script_ = false;
	str_style_ = new String;
	str_script_ = new String;
	write_by_Line_ = false; // used to force the application to write line by line, instead of by character
	re_by_line_ = new RegExp("byline", "i");
	str_tag_content_ = "\\w\\/\\s=\\'\\\"\\.\\:\\-";
	re_tag_content_ = new RegExp("<[" + str_tag_content_ + "]+>", "gi");
	tag_open_ = new Array;
	var str_new_line = "\\r\\n";
	re_new_line_ = new RegExp("[" + str_new_line + "]", "i");
	str_short_pause_ = "^(,)";
	str_medium_pause_ = "^(\\.|!)";
	str_long_pause_ = "^([" + str_new_line + "]{2})";
	/* REGEX NOTES
		- testing for an empty line (long pause) by checking for 2 new lines in a row
	*/

	// global variables used for max speed mode
	global_write_by_line_ = false;
	global_speed_ = null;

	// global variables used to pause/resume the application
	timeout_id_ = null;
	is_paused_ = false;
	cur_file_ = new String;

	// global variable used to store the duration of the css transitions in use
	css_transition_dur_ = null; // in milliseconds

	// populate the flow control object
	while (file_list.length > 0) {
		var file_name = file_list.shift();

		Object.defineProperty(files_content_, file_name, {
			value: {
				"used" : false,
				"expanded" : true,
				"text" : ""
			},
			writable: true
		});
	};

	// do the final steps, either add the event listeners or start the content building
	if (built_on_server) {
		// add the event listeners to all the relevant elements
		addHeaderClickEvent();
	}else{
		// start the application via the 1st file on the list
		buildFileContent(first_file);
	}
}

// grabs the content of a file
// then calls the start of the processing of the file's text
function buildFileContent(file_name) {
	try{
		if (window.XMLHttpRequest) {
			// code for IE7+, Firefox, Chrome, Opera, Safari
			http_request = new XMLHttpRequest();
		}else{
			// code for IE6, IE5
			http_request = new ActiveXObject("Microsoft.XMLHTTP");
		}

		http_request.onreadystatechange = function() {
			if (http_request.readyState == 4 && http_request.status == 200) {
				// got the answer
				var file_text = http_request.responseText;

				if (file_text != "") {
					// check if the this file's target element exists
					// and if it doesn't, create it first
					if (document.getElementById(file_name) == null) {
						createElem(file_name);
					}

					// add <span> tags for color coding the text
					file_text = addStyleTags(file_text.replace(/(\n|\r\n)/g, "\r"));
					file_text = addScriptTags(file_text);

					// start the writing to screen process
					writeToScreen(file_name, file_text);
				}
			}
		}
	}catch(e){
		return(false);
	}

	http_request.open("GET", "/ajax/read_file.php?fn=" + file_name + "&lang=" + lang_, true);
	http_request.send();
}

// runs a string and writes it to the screen at a certain speed
// also responsible for writing any styles and scripts to the correct tag on the document
function writeToScreen(file_name, text) {
	// store the current file's name, in case a pause execution is called
	cur_file_ = file_name;

	// if no text was passed, then continue where we left it
	if (text == "") {
		text = files_content_[file_name]["text"];
	}else{ // if text was passed, then store it
		files_content_[file_name]["text"] = text;
		files_content_[file_name]["used"] = true;
	}

	// local variables used to control the movement along the string
	var speed = speeds_.default;
	var num_chars_remove = 1; // #characters to advance on the string at the end of this function
	var goto_name = "";
	var str_to_write = new String;
	// grab the length of the currently opened tags, if any
	var tag_open_length = (tag_open_.length > 0 ? tag_open_.reduce(function (n1, n2) { return(n1+n2) }) : 0);

	// local variables used to control when to write text to the style and script tags of the document
	var activate_style = false;
	var activate_script = false;

	// grab the character to work with in this cycle of the function
	var cur_str = text.substr(0, 1);

	// check if the current character is the start of a tag
	// process any tags until we reach a non tag character or the end of the text
	while (cur_str.match(/\</i) != null) {
		// check if the "<" found represents the start of a tag
		// and if it doesn't exit the loop
		if (text.search(re_tag_content_) != 0) {
			// the first tag found is not at the start of cur_str OR there are no
			// more actual tags left, i.e., this "<" is not the start of a tag
			// so exit loop and write it as is to screen
			break;
		}

		// grab the tag content
		var tag_content = text.substr(num_chars_remove-1, text.indexOf(">", num_chars_remove-1) - num_chars_remove + 2);
		var goto_char_after_tag = true;

		// if the tag is a style or script tag (don't write the tag to the screen)
		if (tag_content.match(/\<\/?(script|style)[\s\w]*\>/i) != null) {
			// process the tag
			if (tag_content.match(/\<script.*\>/i) != null) { // starting a script block
				// flag that we're inside a script block
				// in order to write it to the tag
				building_script_ = true;

				// check if there are any modifiers in this tag
				if (tag_content.match(re_by_line_) != null) {
					// we want to write line by line
					write_by_Line_ = true;
				}
			}else if (tag_content.match(/\<style.*\>/i) != null) { // starting a style block
				// flag that we're inside a style block
				// in order to write it to the tag
				building_style_ = true;

				// check if there are any modifiers in this tag
				if (tag_content.match(re_by_line_) != null) {
					// we want to write line by line
					write_by_Line_ = true;
				}
			}else if (tag_content.match(/\<\/script\>/i) != null) { // ending a script block
				// we're no longer inside a script block
				building_script_ = false;

				// force the application to go back to writing character by character
				write_by_Line_ = false;

				// flag the need to write the finished block to the respective tag on the document
				activate_script = true;
			}else if (tag_content.match(/\<\/style\>/i) != null) { // ending a style block
				// we're no longer inside a style block
				building_style_ = false;

				// force the application to go back to writing character by character
				write_by_Line_ = false;

				// flag the need to write the finished block to the respective tag on the document
				activate_style = true;
			}
		}else if (tag_content.match(/\<goto \w+\>/i) != null) { // it's a goto tag (signals a jump to a new file)
			// grab the target file's name
			var re_temp = new RegExp("\\<goto (\\w+)\\>", "i");
			goto_name = tag_content.match(re_temp)[1];

			// in this case we don't want to continue reading this file
			// so don't advance after the tag
			goto_char_after_tag = false;
			cur_str = "";
		}else if (tag_content.match(/\<\/?speed[\s\w]*\>/i) != null) { // it's a tag to force the application into a specific speed
			if (tag_content.match(/\<speed.*\>/i) != null) { // starting a speed tag
				// grab the desired speed
				var re_temp = new RegExp("\\<speed\\s+(\\w+)\\>", "i");
				forced_speed_ = speeds_[tag_content.match(re_temp)[1]];
			}else{ // ending a speed tag
				forced_speed_ = null;
			}
		}else if (tag_content.match(/\<\/?byline\>/i) != null) { // it's a tag to force the application into write line by line mode
			if (tag_content.match(/\<byline\>/i) != null) { // starting a byline tag
				write_by_Line_ = true;
			}else{ // ending a byline tag
				write_by_Line_ = false;
			}
		}else if (!write_by_Line_ && !global_write_by_line_) { // it's another tag (ignore if not writing character by character)
			// add it to the screen
			str_to_write += tag_content;

			// if it's a closing tag
			var re_temp = new RegExp("<\\/[" + str_tag_content_ + "]+>", "i");
			if (tag_content.match(re_temp) != null) {
				// remove the last open tag in the array
				tag_open_.pop();
			}else{ // it's an opening tag
				// grab the tag type and add it's length to the open tag array
				re_temp = new RegExp("<(\\w+)[" + str_tag_content_ + "]*>", "i");
				tag_open_.push(tag_content.match(re_temp)[1].length + 3); // add 3 for the </> characters
			}
		}else{ // found a "<" and it's not one of the relevant tags when writing line by line
			// leave as is
			break;
		}

		// skip the tag characters when advancing to next character, in the next cycle
		num_chars_remove += tag_content.length;

		// change the current character to the 1st character after the tag, if we want to
		if (goto_char_after_tag) {
			cur_str = text.substr(num_chars_remove - 1, 1);
		}

		// if we're writing by line, exit loop
		if (write_by_Line_ || global_write_by_line_) {
			break;
		}
	}

	// if we're writing by line, grab the characters to write
	if (write_by_Line_ || global_write_by_line_) {
		// grab the remaining text
		var test_str = text.substr(num_chars_remove - 1);
		// grab the index of the next line break
		var lb_index = test_str.search(re_new_line_);

		// find the next relevant closing tag, for the block we're in at the moment
		if (building_script_) {
			var ct_index = test_str.search(/\<\/script\>/i);
		}else if (building_style_) {
			var ct_index = test_str.search(/\<\/style\>/i);
		}else{
			var ct_index = test_str.search(/\<\/byline\>/i);
		}

		// if there are no more line breaks or closing tags in this file, go to EOF
		if (lb_index == -1 && ct_index == -1) {
			lb_index = text.length - 1;
			ct_index = text.length;
		}else{
			if (lb_index == -1) {
				lb_index = text.length;
			}
			if (ct_index == -1) {
				ct_index = text.length;
			}
		}

		// depending on which comes first, deal with it
		if (lb_index >= 0 && lb_index < ct_index) {
			// line break comes first
			if (goto_name.length > 0) {
				// going to jump to a new file, don't grab the line break after the goto tag
				// grab all the text until the line break (excluding)
				cur_str = test_str.substr(0, lb_index);

				// advance the index on this file
				// NOTE: not doing -1, because we want to skip the line break after the goto tag
				num_chars_remove += cur_str.length;
			}else{
				// grab all the text until the line break (including)
				cur_str = test_str.substr(0, lb_index + 1);

				// advance the index on this file
				num_chars_remove += cur_str.length - 1;
			}
		}else{
			// the closing tag for the block comes first
			// grab all the text until the closing tag (exclusive)
			cur_str = test_str.substr(0, ct_index);

			// advance the index on this file
			num_chars_remove += cur_str.length - 1;
		}
	}

	// if we're inside a style block see if we finished a code block, testing for a }
	// if we did, write that code block to the document
	// only if the string to write ends on the }
	if (building_style_ && cur_str.match(/\}\s?$/i) != null) {
		activate_style = true;
	}

	// add the current valid characters to be written to the screen
	str_to_write += cur_str;

	// if we're inside tag block, add the current character to the relevant buffer
	if (building_style_) {
		// remove any tags
		str_style_ += str_to_write.replace(re_tag_content_, "");
	}else if (building_script_) {
		// remove any tags
		str_script_ += str_to_write.replace(re_tag_content_, "");
	}

	if (str_to_write.length > 0) {
		// before writing to the textbox, make sure it's expanded, and if not expand it first
		if (typeof textboxExpandCollapse == "function") {
			textboxExpandCollapse(file_name, true);
		}

		// write the current character to the screen
		tag_divs_[file_name].lastElementChild.innerHTML = tag_divs_[file_name].lastElementChild.innerHTML.substr(0, tag_divs_[file_name].lastElementChild.innerHTML.length - tag_open_length) + str_to_write;

		// vertical scrollbar: scroll to the bottom of the div
		tag_divs_[file_name].lastElementChild.scrollTop = tag_divs_[file_name].lastElementChild.scrollHeight;
	}

	// if we just finished a block write it to the respective tag on the document
	if (activate_style) {
		// write the finished block to the correct tag
		// replace all < and > from their html encoding to the actual characters
		tag_style_.innerHTML += str_style_;
		// reset the block string
		str_style_ = "";

		// reset this flag
		activate_style = false;
	}else if (activate_script) {
		// create a script tag
		var tag_script = document.createElement("script");

		// write the finished block to the tag
		// replace all < and > from their html encoding to the actual characters
		tag_script.innerHTML = str_script_;

		// add the tag to the document
		document.body.appendChild(tag_script);

		// reset the block string
		str_script_ = "";

		// reset this flag
		activate_script = false;
	}

	// if there are characters left to process, call this function in a certain amount of time
	// with the remaining string as input
	if (goto_name.length > 0 || text.length - num_chars_remove > 0) {
		// if we paused the application, during this function's execution, stop running
		if (!is_paused_) {
			// if no forced speed is set, check the normal speed types
			if (forced_speed_ === null && global_speed_ === null) {
				// determine if a non default speed is to be used
				// if we're inside a style or script block, always use the default speed
				if (!building_style_ && !building_script_) {
					// create a string with the current character and the next character to be written
					// used to test for the speed to be used
					var test_str = cur_str + text.substr(num_chars_remove, 1);

					if (write_by_Line_) {
						speed = speeds_.text_by_line;
					}else if (test_str.match(new RegExp(str_short_pause_, "i")) != null) {
						speed = speeds_.short_pause;
					}else if (test_str.match(new RegExp(str_medium_pause_, "i")) != null) {
						speed = speeds_.medium_pause;
					}else if (test_str.match(new RegExp(str_long_pause_, "i")) != null) {
						speed = speeds_.longPause;
					}
				}else if (building_style_) { // if inside a style tag
					if (write_by_Line_) {
						speed = speeds_.style_by_line;
					}else{
						speed = speeds_.style_by_char;
					}
				}else if (building_script_) { // if inside a script tag
					if (write_by_Line_) {
						speed = speeds_.script_by_line;
					}else{
						speed = speeds_.script_by_char;
					}
				}
			}else{ // else, use the forced speed
				// if not in fastforward mode, use forced_speed_
				if (global_speed_ === null) {
					speed = forced_speed_;
				}else{ // else, we're in fastforward mode
					speed = global_speed_;
				}
			}

			// remove the text already used
			files_content_[file_name]["text"] = files_content_[file_name]["text"].slice(num_chars_remove);

			// set the delayed call for the next character to be written
			timeout_id_ = window.setTimeout(function() {
				// if we're staying in the same file
				if (goto_name.length == 0) {
					writeToScreen(file_name, "");
				}else if (files_content_[goto_name]["used"] == false) {
					// if we're changing files, but the new file hasn't been use yet
					// grab the files' content first
					buildFileContent(goto_name);
				}else{
					// if we're changing files and the new file has been used already
					// continue where we left off
					writeToScreen(goto_name, "");
				}
			}, speed);
		}
	}else{
		// there are no more files/text to run, so the application ended
		// remove the speed control buttons from the UI
		document.getElementById("footer_controls").className += " no_events opacity_zero";

		// unblock mouse events on the textboxes
		// allowing the user to expand/collapse them
		blockMouseEvents(false);
	}
}

// creates a DIV element on the DOM, under the BODY tag, with class content
function createElem(elem_id) {
	// create a new DIV element -> text box
	var new_div = document.createElement("div");
	// insert the div's ID and class
	new_div.id = elem_id;
	new_div.className = "content flex_item";
	new_div.style.order = textbox_count_++;

	// create the text inner div
	var new_div_text = document.createElement("div");
	// insert the class
	new_div_text.className = "text text_expanded";

	// add the text DIV to the text box DIV
	new_div.appendChild(new_div_text);

	// add the DIV to the DOM's body
	div_work_area_.appendChild(new_div);

	tag_divs_[elem_id] = document.getElementById(elem_id);

	// if the addHeaders() function is already defined, call it
	if (typeof addHeaders == "function") {
		addHeaders(elem_id);
	}
}

// received the file's content and adds <span> tags for color coding of CSS text
function addStyleTags(text) {
	// local variables used to execute this task
	var tag_start = 0;
	var tag_end = 0;
	var str_final = new String;
	var str_temp = new String;
	var re_key_word = new RegExp("(@[\\w\\t ]+)\\(", "gi");
	var re_selector = new RegExp("([\\w\\*\\.\\#\\t: ]+)(\\s?[\\{,])", "gi");
	var re_property = new RegExp("([\\{;\\(]\\s*)([\\w-]+)(\\s*:)", "gi");
	var re_value = new RegExp(":([^:;]*)([;)])", "gi");
	var re_value_units = new RegExp("(\\d)(px|%|rem|em|vh|vw|s|ms)", "gi");

	// loop until we've added all necessary tags
	while (true) {
		// grab the index of the next style tag
		tag_start = text.search(/\<style[^\<]*\>/i);

		// if we've reached the end of the text OR there are no more style tags left
		// exit the loop
		if (tag_start == -1) {
			// add any parts of the text not processed at the end
			if (text.length > 0) {
				str_final += text.substr(0);
			}

			// all the text is processed, so exit the loop and continue code
			break;
		}

		// place the index after the style tag
		tag_start += text.substr(tag_start, text.indexOf(">", tag_start) - tag_start).length + 1;

		// add the text between the last character added and the > of the style tag
		str_final += text.substr(0, tag_start);

		// find the index of the next closing style tag
		tag_end = text.indexOf("</style>", tag_start);
		// if no closing style tag exists, then the block goes until the end of the text
		if (tag_end == -1) {
			tag_end = text.length;
		}

		// grab the text inside the style tag
		str_temp = text.substr(tag_start, tag_end - tag_start);

		// add the Key Word spans
		str_temp = str_temp.replace(re_key_word, "<span class='css_keyword'>$1</span>(");

		// add the selector spans
		str_temp = str_temp.replace(re_selector, "<span class='css_selector'>$1</span>$2");

		// remove any selector span tags that might have been placed inside the property:value area
		str_temp = str_temp.replace(/\{([^{}]+)<span class='css_selector'>([^{}]+)<\/span>([^{}]+)\}/ig, function(string) {
			return(string.replace(/<span class='css_selector'\s*>([^\/]+)<\/span>/ig, "$1"));
		});

		// add the property spans
		str_temp = str_temp.replace(re_property, "$1<span class='css_property'>$2</span>$3");
		// add the value spans
		str_temp = str_temp.replace(re_value, ":<span class='css_value'>$1</span>$2");
		// add the px spans
		str_temp = str_temp.replace(re_value_units, "$1<span class='css_units'>$2</span>");

		// add the new style tag content and the closing style tag
		str_final += str_temp + "</style>";

		// advance current index to the character after the closing style tag
		text = text.slice(tag_end + 8);
	}

	return(str_final);
}

// received the file's content and adds <span> tags for color coding of JS text
function addScriptTags(text) {
	// local variables used to execute this task
	var tag_start = 0;
	var tag_end = 0;
	var str_final = new String;
	var str_temp = new String;
	var re_function_declaration = new RegExp("(function[\\t ]+)(\\w+[\\t ]*)\\(([^\)]*)\\)([\\t ]*{)", "gi");
	var re_key_word = new RegExp("([\\w])?(new|while|for|break|continue|try|catch|return|if|else|typeof)([^\\w])", "gi");
	var re_math_operator = new RegExp("([^<])(\\++|\\-+|\\*|\\/)", "gi");
	var re_logic_operator = new RegExp("(&&|\\|\\||!=|={1,3}|<|>)", "gi");
	var re_object = new RegExp("(Object|var|document)", "gi");
	var re_value = new RegExp("(\\d|true|false|null)", "gi");
	var re_method = new RegExp("\\.(\\w+)", "gi");
	var re_string = new RegExp("(\\\"[^\\\"]*\\\")", "i");
	var re_regexp = new RegExp("([^<>])(\\/[^/]+\\/[gmi]*)", "i");

	// loop until we've added all necessary tags
	while (true) {
		// grab the index of the next script tag
		tag_start = text.search(/\<script[^\<]*\>/i);

		// if we've reached the end of the text OR there are no more script tags left
		// exit the loop
		if (tag_start == -1) {
			// add any parts of the text not processed at the end
			if (text.length > 0) {
				str_final += text.substr(0);
			}

			// all the text is processed, so exit the loop and continue code
			break;
		}

		// place the index after the script tag
		tag_start += text.substr(tag_start, text.indexOf(">", tag_start) - tag_start).length + 1;

		// add the text between the last character added and the > of the script tag
		str_final += text.substr(0, tag_start);

		// find the index of the next closing script tag
		tag_end = text.indexOf("</script>", tag_start);
		// if no closing script tag exists, then the block goes until the end of the text
		if (tag_end == -1) {
			tag_end = text.length;
		}

		// grab the text inside the script tag
		str_temp = text.substr(tag_start, tag_end - tag_start);

		// add the logic operator spans
		str_temp = str_temp.replace(re_logic_operator, "<span class='js_logicoperator'>$1</span>");
		// add the math operator spans
		str_temp = str_temp.replace(re_math_operator, "$1<span class='js_mathoperator'>$2</span>");
		// add the function declaration spans
		str_temp = str_temp.replace(re_function_declaration, "<span class='js_func_word'>$1</span><span class='js_func_name'>$2</span>(<span class='js_func_param'>$3</span>)$4");
		// add the keyWord spans
		str_temp = str_temp.replace(re_key_word, "$1<span class='js_keyword'>$2</span>$3");
		// add the object spans
		str_temp = str_temp.replace(re_object, "<span class='js_object'>$1</span>");
		// add the value spans
		str_temp = str_temp.replace(re_value, "<span class='js_value'>$1</span>");
		// add the method spans
		str_temp = str_temp.replace(re_method, ".<span class='js_method'>$1</span>");

		// remove the math operator span tag from the / with the meaning of start and end of a regexp
		str_temp = str_temp.replace(/<span class='js_mathoperator'\s*>\/<\/span>([^\/]+)<span class='js_mathoperator'\s*>\/<\/span>([gmi]*)/ig, "/$1/$2");

		// if there are any regexp in the script text
		// first remove any of the span tags placed above from text inside regexp
		// then add the regexp spans
		var re_match = str_temp.match(re_regexp); // find the 1st match of a regexp
		if (re_match != null) {
			// auxiliary local variable used to store the cleaned regexp
			var str_aux = new String;

			// loop until there are no more regexp to process
			do {
				// grab the text before the regexp (no processing needed)
				str_aux += str_temp.substr(0, re_match.index);

				// for the text inside the regexp, first remove any other color coding span tags from previous steps
				str_aux += str_temp.substr(re_match.index, re_match[0].length).replace(re_regexp, function(string){
					// explicitely remove any js_mathoperator span tags that may have been placed around other html tags
					return(string.replace(/<span class='js_mathoperator'\s*>([<>]+)<\/span>/ig, "$1").replace(/<span\s+class='(css|js)_\w+'\s*>([^>]*)<\/span>/ig, "$2"));
				}).replace(re_regexp, "$1<span class='js_regexp'>$2</span>");

				// remove the processed text from the non-processed text
				str_temp = str_temp.slice(re_match.index + re_match[0].length);

				// determine the next regexp's data, if any
				re_match = str_temp.match(re_regexp);
			} while (re_match != null)

			// add any final characters that don't need to be processed
			str_aux += str_temp;
			// store the final string on the original variable
			str_temp = str_aux;
		}

		// if there are any strings in the script text
		// first remove any of the span tags placed above from text inside strings
		// then add the string spans
		var re_match = str_temp.match(re_string); // find the 1st match of a string
		if (re_match != null) {
			 // auxiliary local variable used to store the cleaned string
			var str_aux = new String;

			// loop until there are no more strings to process
			do {
				// grab the text before the string (no processing needed)
				str_aux += str_temp.substr(0, re_match.index);

				// for the text inside the string, first remove any other color coding span tags from previous steps
				str_aux += str_temp.substr(re_match.index, re_match[0].length).replace(re_string, function(string){
					// explicitely remove any js_mathoperator span tags that may have been placed around other html tags
					return(string.replace(/<span class='js_mathoperator'\s*>([<>]+)<\/span>/ig, "$1").replace(/<span\s+class='(css|js)_\w+'\s*>([^>]*)<\/span>/ig, "$2"));
				}).replace(re_string, "<span class='js_string'>$1</span>");

				// remove the processed text from the non-processed text
				str_temp = str_temp.slice(re_match.index + re_match[0].length);

				// determine the next string's data, if any
				re_match = str_temp.match(re_string);
			} while (re_match != null)

			// add any final characters that don't need to be processed
			str_aux += str_temp;
			// store the final string on the original variable
			str_temp = str_aux;
		}

		// add the new script tag content and the closing script tag
		str_final += str_temp + "</script>";

		// advance current index to the character after the closing script tag
		text = text.slice(tag_end + 9);
	}

	return(str_final);
}

// pushes the vertical scroll of all existing divs to the bottom
function scrollBoxesToBottom(elem_id) {
	if (elem_id == null) {
		// grab all the text boxes
		var elems = document.querySelectorAll("div.text");
	}else{
		// grab the text box with elem_id
		var elems = [tag_divs_[elem_id].lastElementChild];
	}

	// loop each one
	for (var i = 0; i < elems.length; i++) {
		// scroll to the bottom of the div
		elems[i].scrollTop = elems[i].scrollHeight;
	}
}

// set the default speeds for the application
function setDefaultSpeeds() {
	speeds_ = {
		"default": 20,
		"style_by_char": 10,
		"script_by_char": 10,
		"style_by_line": 100,
		"script_by_line": 100,
		"text_by_line": 100,
		"short_pause": 275,
		"medium_pause": 550,
		"Long_pause": 750,
	};
}

// sets the various speed modes
function setSpeed(speed_mode) {
	/*
	1 = normal speeds (the ones set by default at the start of the application)
	2 = no pauses, but still writing character by character
	3 = no pauses, no default delay and writing line by line
	*/

	if (speed_mode === 1) {
		// set default speeds
		setDefaultSpeeds();

		// reset the max speed variables
		global_speed_ = null;
		global_write_by_line_ = false;
	}else if (speed_mode === 2) {
		// set pauses to zero
		speeds_.short_pause = 0;
		speeds_.medium_pause = 0;
		speeds_.Long_pause = 0;

		// reset the max speed variables
		global_speed_ = null;
		global_write_by_line_ = false;
	}else if (speed_mode === 3) {
		// force all speeds to zero and write line by line
		global_speed_ = 0;
		global_write_by_line_ = true;
	}

	// change the selected speed button in the UI
	var speed_buttons = document.querySelectorAll(".speed");
	for (var i = 0; i < speed_buttons.length; i++) {
		if (i === speed_mode - 1) {
			// this is the selected speed
			speed_buttons[i].className = speed_buttons[i].className.replace("clickable", "selected").trim();
		}else{
			// this is not the selected speed
			speed_buttons[i].className = speed_buttons[i].className.replace("selected", "clickable").trim();
		}
	};
}

// pauses the execution of the application
function pauseExec() {
	// if the next iteration of writeToScreen() is pending, remove it
	window.clearTimeout(timeout_id_);
	// in case writeToScreen() is already running, let it know it should stop
	is_paused_ = true;

	// hide the pause button
	document.getElementById("pause_button").className += " hidden";
	// show the resume button
	var temp_elem = document.getElementById("resume_button");
	temp_elem.className = temp_elem.className.replace("hidden", "").trim();

	// unblock mouse events on textboxes
	blockMouseEvents(false);
}

// resumes the execution of the application
function resumeExec() {
	// local variable used to control when to resume writing to screen
	// used to delay it in case textboxes need to be expanded/collapsed after the pause
	var resume_delay = 0;

	// block mouse events on textboxes
	blockMouseEvents(true);

	// if expand/collapse is in play, resume the state the textboxes were before pause
	if (typeof textboxExpandCollapse == "function") {
		// if need be, grab the currently active CSS transition duration
		if (css_transition_dur_ == null) { getTransitionDuration(); }

		// grab all the text boxes
		var elems = document.querySelectorAll("div.content");

		// loop each textbox and change  state, if needed
		for (var i = 0; i < elems.length; i++) {
			// check if this textbox is collapsed
			var match_collapsed = elems[i].className.match(/content_collapsed/i);

			// if this textbox isn't in the pre-pause state, change it
			if ((match_collapsed == null && !files_content_[elems[i].id]["expanded"]) || (match_collapsed != null && files_content_[elems[i].id]["expanded"])) {
				// this textbox is in the wrong state, so change it
				textboxExpandCollapse(elems[i].id, false);

				// if at least 1 textbox has to be changed, delay the start of
				// writing to screen to allow the transtions to finish
				resume_delay = css_transition_dur_;
			}
		};
	}

	// no longer paused
	is_paused_ = false;

	// call writeToScreen() to continue where it left off
	// using any necessary delay
	window.setTimeout(function() {
		writeToScreen(cur_file_, "");
	}, resume_delay);

	// hide the resume button
	document.getElementById("resume_button").className += " hidden";
	// show the pause button
	var temp_elem = document.getElementById("pause_button");
	temp_elem.className = temp_elem.className.replace("hidden", "").trim();
}

// finds the duration of the CSS transitions in use on the website
// NOTE: must be called after any transitions are set in the style tag
function getTransitionDuration() {
	// regexp to find and grab the duration value and unit
	var re = new RegExp("\\*\\s*\\{[^\\{\\}]+transition\\s*:[^\\{\\}\\d]+([\\d\\.]+)(s|ms)[^\\{\\}]+\\}", "i");

	// find the transition duration value and unit
	if (tag_style_.innerHTML.match(re) != null) {
		// a match was found
		// calculate the duration in milliseconds
		css_transition_dur_ = tag_style_.innerHTML.match(re)[1] * (tag_style_.innerHTML.match(re)[2] == "s" ? 1000 : 1);
	}else{
		// there is no transition
		css_transition_dur_ = 0;
	}
}

// blocks/unblocks mouse events on all textboxes
function blockMouseEvents(turn_on) {
	if (turn_on) { // if we want to activate the mouse event block
		if (div_work_area_.className.match(/no_events/i) == null) {
			// and it isn't on already, add the class
			div_work_area_.className += " no_events";
		}
	}else{ // we want to turn off the mouse event block
		// remove the class
		div_work_area_.className = div_work_area_.className.replace(/no_events/i, "").trim();
	}
}
