/************************************************************
*															*
* www.pedrojhenriques.com v2.2.0							*
*															*
* Copyright 2017, PedroHenriques 							*
* http://www.pedrojhenriques.com 							*
* https://github.com/PedroHenriques 						*
*															*
* Free to use under the MIT license.			 			*
* http://www.opensource.org/licenses/mit-license.php 		*
*															*
************************************************************/

/* #bundler remove */
// forward declare these functions to please the requirements of the TextBox class
// these functions will be implemented when reading from the script_box.txt file
function addHeaders(id: string | null): void {}
function textboxExpandCollapse(id: string, only_expand: boolean): void {}
/* #bundler remove */

// this class will handle all the processing of each text box
// from reading the corresponding file's content, to crawling through its content
export class TextBox {
	// stores a reference to the DOM element where all the textboxes will be appended
	private static div_work_area_: HTMLElement | null = document.getElementById("work_area");

	// stores the style tag where all styles should be written to
	private static dom_style_tag_: HTMLElement = document.body.getElementsByTagName("style")[0];

	// stores the number of textboxes that already have their DOM element created
	// this information is needed to order the textboxes in the CSS flex
	private static textbox_elem_count: number = 0;

	// stores the language tag to use
	private static lang_: string = "";

	// stores the currently active speeds
	private static speeds_ = {
		default: 0,
		style_by_char: 0,
		script_by_char: 0,
		style_by_line: 0,
		script_by_line: 0,
		text_by_line: 0,
		short_pause: 0,
		medium_pause: 0,
		long_pause: 0
	};

	// stores information used to control the speeds and write mode enforced by
	// the currently active speed level, set by the user with the speed controls
	public static global_write_by_line_: boolean = false;
	public static global_speed_: number | null = null;

	// stores the keywords used in a textbox's tags
	private static tag_keywords: {[key: string]: string} = {
		// signals that the text inside that tag should be written line by line
		"byline": "byline"
	}

	// stores the types of the tags that are self closing, i.e., that don't have a pair of tags
	// and opening and a closing tag
	// these tags should not be couted towards the "open_tags" calculations
	private static self_closing_tags: string[] = ["br", "hr", "img"];

	// stores the regex string to check for tags
	private static re_str_tags_: string = "<(\\/?)([a-zA-Z0-9]+)\\s*([\\w\\/\\s=\\'\\\"\\.\\:\\-]*)>";

	// stores the regex objects
	private static regex_: {[key: string]: RegExp} = {
		// used to check for a short pause
		"short_pause" : /^(,)/i,

		// used to check for a medium pause
		"medium_pause": /^(\.|!)/i,

		// used to check for a long pause
		"long_pause": /^([\r\n]{2})/i,

		// used to check for a tag
		"tag_content": new RegExp(TextBox.re_str_tags_, "i"),

		// used to check for a new line
		"new_line": /[\r\n]/i,

		// used to check for a CSS keyword
		"css_keyword": /(@[\w\t ]+)\(/gi,

		// used to check for a CSS selector
		"css_selector": /([\w\*\.\#\t: ]+)(\s?[\{,])/gi,

		// used to check for a CSS property name
		"css_property": /([\{;\(]\s*)([\w-]+)(\s*:)/gi,

		// used to check for a CSS property value
		"css_value": /:([^:;]*)([;)])/gi,

		// used to check for a CSS property value's units
		"css_value_units": /(\d)(px|%|rem|em|vh|vw|s|ms)/gi,

		// used to check for a JS function declaration
		"js_func_declaration": /(function[\t ]+)(\w+[\t ]*)\(([^\)]*)\)([\t ]*\{)/gi,

		// used to check for a JS keyword
		"js_keyword": /([\w])?(new|while|for|break|continue|try|catch|return|if|else|typeof)([^\w])/gi,

		// used to check for a JS math operator
		"js_math_operator": /([^<])(\++|\-+|\*|\/)/gi,

		// used to check for a JS logical operator
		"js_logic_operator": /(&&|\|\||!=|={1,3}|<|>)/gi,

		// used to check for a JS misc keyword
		"js_object": /(Object|var|let|document)/gi,

		// used to check for a JS value
		"js_value": /(\d|true|false|null|undefined)/gi,

		// used to check for a JS method call
		"js_method": /\.(\w+)/gi,

		// used to check for a JS string
		"js_string": /(\"[^\"]*\")/i,

		// used to check for a JS regular expression
		"js_regexp": /([^<>])(\/[^/]+\/[gmi]*)/i
	};

	// stores this text box's name
	private textbox_name: string = "";

	// stores the DOM element that holds this text box
	private textbox_elem: HTMLElement | null = null;

	// stores the content of the file associated with this text box
	private file_content: string = "";

	// flags whether this text box's current content block should be added to the style tag
	private building_style: boolean = false;
	// stores the text that will be added to the style tag when the content block ends
	private style_text: string = "";

	// flags whether this text box's current content block should be added to a script tag
	private building_script: boolean = false;
	// stores the text that will be added to a script tag when the content block ends
	private script_text: string = "";

	// stores a flag that triggers the accumulated <style> tag text to be written to the
	// DOM's style tag
	private dump_style: boolean = false;

	// stores a flag that triggers the accumulated <script> tag text to be written to a
	// DOM script tag
	private dump_script: boolean = false;

	// flags whether a text box's content should be written to the screen line by line
	// instead of char by char
	private write_by_line: boolean = false;

	// stores the speed to use for the current render iteration
	private speed: number = 0;

	// stores the speed to be used for all writting to screen in "forced mode"
	// used when a specific speed is called with a <speed> tag
	private forced_speed: number | null = null;

	// stores the nest of tags the current content is being written inside of
	private open_tags: number[] = [];

	// stores the string being processed in the current render iteration
	private cur_str: string = "";

	// stores the text to render to the screen in the current render iteration
	private str_to_render: string = "";

	// stores the number of characters to advance in this textbox's content
	// by default a render iteration will process 1 character
	private advance_chars: number = 1;

	// stores the name of the textbox to call on the next render iteration
	private next_textbox: string = "";

	// stores a flag indicating whether this text box's DOM element is expanded or collapsed
	// NOTE: true = expanded | false = collapsed
	public _expanded: boolean = true;

	public constructor(file_name: string) {
		// store this text box's name
		this.textbox_name = file_name;

		// check if this textbox already has a DOM element
		// NOTE: it will if the content was built on the server
		this.textbox_elem = document.getElementById(file_name);
	}

	// setter for lang_
	public static setLang_(lang: string): void {
		TextBox.lang_ = lang;
	}

	// setter for speeds_
	public static setSpeeds_(speeds: {[key: string]: number}): void {
		// loop through each provided key:value speed pair
		for (let key in speeds) {
			// check if this index is valid
			if (key in TextBox.speeds_) {
				// it is, so update its value
				(<any>TextBox.speeds_)[key] = speeds[key];
			}
		}
	}

	// setter for speed
	public setSpeed(speeds_index: string): void {
		// check if the requested speed is valid
		if (speeds_index in TextBox.speeds_) {
			// it is
			// set it as the current speed
			this.speed = (<any>TextBox.speeds_)[speeds_index];
		}
	}

	// setter for forced_speed
	public setForcedSpeed(speeds_index: string): void {
		// check if the requested speed is valid
		if (speeds_index in TextBox.speeds_) {
			// it is
			// set it as the current speed
			this.forced_speed = (<any>TextBox.speeds_)[speeds_index];
		}
	}

	// setter for expanded
	public set expanded(expanded: boolean) {
		this._expanded = expanded;
	}

	// getter for exapnded
	public get expanded() {
		return(this._expanded);
	}

	// handles crawling this text box's file and writing its contents to the screen
	// will continue from where it left off, or from the start of the file (if first call)
	// returns the name of the text box to call next or an empty string if this text box
	// reached the EOF and no <goto> tag was encountered
	// NOTE: will call for the creation of this textbox's DOM element if needed
	public run(): {textbox: string, delay: number} {
		// reset the currently active speed to the "default speed"
		this.setSpeed("default");

		// reset the name of the textbox to call next
		this.next_textbox = "";

		// check if this TextBox's DOM element has been created
		if (this.textbox_elem == null) {
			// it hasn't
			// create this textbox's DOM element
			this.textbox_elem = TextBox.createTextBoxElem_(this.textbox_name);

			// check if the DOM element was created successfuly
			if (this.textbox_elem == null) {
				// it wasn't
				// return a "terminate program" state
				return({
					"textbox": "",
					"delay": this.speed
				});
			}
		}

		// process this render iteration
		if (!this.renderContent()) {
			// something went wrong while rendering this iteration's text
			// return a "terminate program" state
			return({
				"textbox": "",
				"delay": this.speed
			});
		}

		// determine the delay until the next render iteration
		this.determineSpeed();

		// check if a new textbox will be called on the next render iteration
		if (this.next_textbox != "") {
			// it will
			// return the name of the next textbox to call
			return({
				"textbox": this.next_textbox,
				"delay": this.speed
			});
		}

		// check if the program has finished, by checking if this textbox's content
		// has all been processed and no <goto> tag was encountered (the if statement above)
		if (this.file_content == "") {
			// it has
			// return a "terminate program" state
			return({
				"textbox": "",
				"delay": this.speed
			});
		}

		// at this point the next render iteration will remain in this textbox
		// return this textbox as the one to call next
		return({
			"textbox": this.textbox_name,
			"delay": this.speed
		});
	}

	// handles processing each render iteration for this textbox
	// returns true if the render was successful | false if something went wrong
	private renderContent(): boolean {
		// reset the text to render to the screen in this render iteration
		this.str_to_render = "";

		// stores the total number of characters, in this textbox's DOM element innerHTML, dedicated to
		// the closing tags of any "in processing" tags
		// NOTE: this.str_to_render will be placed inside these open tags, which means the program needs
		// 		 to know how many characters the writting needs to be offset in order for it to land inside
		// 		 those tags
		let open_tags_length: number = this.open_tags.reduce((acc, val) => { return(acc + val); }, 0);

		// reset the number of characters processed in this render iteration
		this.advance_chars = 0;

		// check if the program is in "write by line" mode
		if (this.write_by_line || TextBox.global_write_by_line_) {
			// it is
			// check if there are any line breaks left in this textbox's content
			let lb_index: number = -1;
			if ((lb_index = this.file_content.search(TextBox.regex_["new_line"])) == -1) {
				// there aren't, so treat the EOF as the next line break
				lb_index = this.file_content.length - 1;
			}

			// determine the string to process in this render iteration
			// which is all the text from index zero to the next line break/EOF
			this.cur_str = this.file_content.substr(0, lb_index + 1);
		}else{
			// it isn't
			// determine the string to process in this render iteration
			// which is the next character in this textbox's content
			this.cur_str = this.file_content.substr(0, 1);
		}

		// process all the tags in text that is being processed in this render iteration
		if (!this.processTags()) {
			// something went wrong while processing the tags
			// the rendering can't be completed
			return(false);
		}

		// add the characters in processing to the string that will be rendered to the screen
		this.str_to_render += this.cur_str;

		// check if there is any text to render to the screen in this render iteration
		if (this.str_to_render != "") {
			// there is
			// check if a reference to this textbox's element has been acquired and
			// that it has at least 1 child element
			if (this.textbox_elem == null || this.textbox_elem.lastElementChild == null) {
				// it hasn't
				// the rendering can't be completed
				return(false);
			}

			// check if this textbox is expanded
			if (!this.expanded) {
				// it isn't, so expand it
				textboxExpandCollapse(this.textbox_name, true);
			}

			// stores a reference to this textbox's child element where the text is placed
			let render_elem: Element = this.textbox_elem.lastElementChild;

			// build this textbox's new text
			// NOTE: not explicitely closing any opened tags, since the browser will do it automaticaly
			let new_text: string = render_elem.innerHTML.substr(0, render_elem.innerHTML.length - open_tags_length) + this.str_to_render;

			// render this textbox's new text
			render_elem.innerHTML = new_text;

			// scroll to the bottom of this textbox
			render_elem.scrollTop = render_elem.scrollHeight;
		}

		// if needed, add the stored text for the style/script tags to the DOM's relevant tags
		if (!this.dumpTextBlock()) {
			// something went wrong while adding the style/script blocks' text to the DOM
			// the rendering can't be completed
			return(false);
		}

		// update this textbox's remaining file content
		this.file_content = this.file_content.substr(this.advance_chars);

		// at this point everything went OK
		return(true);
	}

	// handles processing the chain of tags in the relevant string for this
	// render iteration
	// returns true if everything went OK | false otherwise
	private processTags(): boolean {
		// stores a regex match object for the "tag_content" regex matches done below
		let re_tag: RegExpMatchArray | null = null;

		// get a local copy of this render iteration's relevant text
		let render_text: string = this.cur_str;

		// check if this textbox is in "write by char" mode
		if (!this.write_by_line && !TextBox.global_write_by_line_) {
			// it is
			// check if the character to be rendered in this iteration is a "<"
			// and if this "<" is the part of tag
			// (by finding the index of the next tag in this textbox's content and checking if it is zero)
			if (this.cur_str != "<" || (re_tag = this.file_content.match(TextBox.regex_["tag_content"])) == null || re_tag["index"] != 0) {
				// it isn't
				// in this case this render iteration will process exactly 1 character
				this.advance_chars = 1;

				// process any currently open style or script blocks
	            if (!this.processTextBlock(this.cur_str)) {
	                // something went wrong while processing the text blocks
	                // the rendering can't be completed
	                return (false);
	            }

				// there are no tags to process in this render iteration
				return(true);
			}

			// at this point, this "<" is part of a tag
			// update the local copy of this render iteration's relevant text to include this entire tag
			render_text = this.file_content.substr(0, re_tag[0].length);
		}

		// clear this render iteration's relevant string
		// NOTE: there might be tags in the string that are not to be rendered and
		// 		 will need to be removed
		this.cur_str = "";

		// stores whether one of the tags processed triggers a change to this textbox's write mode
		// the change will be done at the end of this method, in order to only have an impact on the
		// next render iteration
		let write_by_line: boolean | null = null;

		// stores whether the instance variables building_script and building_style should be set to false
		// at the end of each of the below loop's iterations
		// NOTE: needed since the instance variables can only be set to false after the loop iteration's
		// 		 text has been added to the script/style buffer
		let building_script_off: boolean = false;
		let building_style_off: boolean = false;

		// loop while there are tags to process in the relevant text for this render iteration
		while ((re_tag = render_text.match(TextBox.regex_["tag_content"])) != null) {
			// check if the index of this match in render_text is available
			if (re_tag["index"] == undefined) {
				// it isn't
				return(false);
			}

			// reset the flags to set the instance variables to false
			building_script_off = false;
			building_style_off = false;

			// flags whether this tag should be rendered to the textbox's DOM element
			// by default this tag will not be rendered
			let render_tag: boolean = false;

			// check if this tag is a script tag
			if (re_tag[2] == "script") {
				// it is
				// check if this tag is an opening tag
				// NOTE: checks if the 2nd character of tag_content is a "/"
				if (re_tag[1] == "") {
					// it is
					// flag that this textbox is now processing text that is inside of a script block
					// and that text will eventualy be written to a DOM script tag
					this.building_script = true;

					// check if this tag has the "byline" modifier
					if (re_tag[3].trim().toLowerCase() == TextBox.tag_keywords["byline"]) {
						// it has, so flag this textbox as being in "write by line" mode
						write_by_line = true;
					}
				}else{
					// it isn't, so its a closing tag
					// flag that this textbox is no longer processing text that is inside of a script block
					building_script_off = true;

					// force this textbox to be in "write by character" mode
					// in case this script tag had the "write by line" modifier
					write_by_line = false;

					// flag the need to write the finished script block's content to a DOM script tag
					this.dump_script = true;
				}
			// check if this tag is a style tag
			}else if (re_tag[2] == "style") {
				// it is
				// check if this tag is an opening tag
				// NOTE: checks if the 2nd character of tag_content is a "/"
				if (re_tag[1] == "") {
					// it is
					// flag that this textbox is now processing text that is inside of a style block
					// and that text will eventualy be written to the DOM's style tag
					this.building_style = true;

					// check if this tag has the "byline" modifier
					if (re_tag[3].trim().toLowerCase() == TextBox.tag_keywords["byline"]) {
						// it has, so flag this textbox as being in "write by line" mode
						write_by_line = true;
					}
				}else{
					// it isn't, so its a closing tag
					// flag that this textbox is no longer processing text that is inside of a style block
					building_style_off = true;

					// force this textbox to be in "write by character" mode
					// in case this style tag had the "write by line" modifier
					write_by_line = false;

					// flag the need to write the finished style block's content to the DOM's style tag
					this.dump_style = true;
				}
			// check if this tag is a goto tag (signals a jump to a new file)
			}else if (re_tag[2] == "goto") {
				// it is
				// check if the target file's name was provided
				if (re_tag[3] == "") {
					// it wasn't, so bail out
					return(false);
				}

				// store the name of the textbox to call
				this.next_textbox = re_tag[3].trim().toLowerCase();
			// check if this tag is a speed tag (forces the program into a specific global speed)
			}else if (re_tag[2] == "speed") {
				// it is
				// check if this tag is an opening tag
				// NOTE: checks if the 2nd character of tag_content is a "/"
				if (re_tag[1] == "") {
					// it is
					// check if the desired speed was acquired
					if (re_tag[3] != "") {
						// it was
						// set the provided speed as the current "forced speed"
						this.setForcedSpeed(re_tag[3]);
					}
				}else{
					// it isn't, so its a closing tag
					// disable the current "forced speed"
					this.forced_speed = null;
				}
			// check if this tag is a byline tag (forces the program into "write by line" mode)
			}else if (re_tag[2] == "byline") {
				// it is
				// check if this tag is an opening tag
				// NOTE: checks if the 2nd character of tag_content is a "/"
				if (re_tag[1] == "") {
					// it is
					// enable "write by line" mode
					write_by_line = true;
				}else{
					// it isn't, so its a closing tag
					// disable "write by line" mode
					write_by_line = false;
				}
			// check if the tag is a self closing tag
			}else if (re_tag[0].slice(-2) == "/>" || TextBox.self_closing_tags.indexOf(re_tag[2]) != -1) {
				// it is
				// this tag should be rendered
				render_tag = true;
			}else{
				// found another type of tag -> either a color coding span tag or another HTML tag (ex: <h1>)
				// this tag should be rendered
				render_tag = true;

				// check if this tag is an opening tag
				// NOTE: checks if the 2nd character of tag_content is a "/"
				if (re_tag[1] == "") {
					// it is
					// check if the tag's type was retrieved
					if (re_tag[2] == "") {
						// it wasn't, so bail out
						return(false);
					}

					// store this tag's corresponding closing tag length
					// NOTE: the +3 is for the "</>" characters of the tag
					this.open_tags.push(re_tag[2].length + 3);
				}else{
					// it isn't, so its a closing tag
					// remove this tag's corresponding closing tag from the open tags array
					// NOTE: the last tag to be opened will be the 1st to be closed
					// 		 this.open_tags is in FIFO (first in, first out) system
					this.open_tags.pop();
				}
			}

			// stores the string to add to this render iteration's relevant text
			let str_adjustment: string = "";

			// check if this tag should be rendered
			if (render_tag) {
				// it should
				// update this render iteration's relevant text including the tag
				str_adjustment = render_text.substr(0, <number>re_tag["index"] + re_tag[0].length);

				// signal that this textbox's file content should advance to the 1st character after this tag
				this.advance_chars += str_adjustment.length;
			}else{
				// it shouldn't
				// update this render iteration's relevant text excluding the tag
				str_adjustment = render_text.substr(0, <number>re_tag["index"]);

				// signal that this textbox's file content should advance to the 1st character after this tag
				this.advance_chars += str_adjustment.length + re_tag[0].length;
			}

			// update this render iteration's relevant text
			this.cur_str += str_adjustment;

			// process any currently open style or script blocks
			if (!this.processTextBlock(str_adjustment)) {
				// something went wrong while processing the text blocks
				// the rendering can't be completed
				return(false);
			}

			// check if the instance variable "building_script" needs to be set to false
			if (building_script_off) {
				// it does
				this.building_script = false;
			// check if the instance variable "building_style" needs to be set to false
			}else if (building_style_off) {
				// it does
				this.building_style = false;
			}

			// check if the next render iteration will be on a different textbox
			if (this.next_textbox == "") {
				// it won't
				// advance the local copy of the text being processed to the 1st character after this tag, allowing
				// this loop to fetch the next tag, if any
				render_text = render_text.substr(<number>re_tag["index"] + re_tag[0].length);
			}else{
				// it will
				// don't process any text after the <goto> tag. It will be processed when this
				// textbox is called again
				render_text = "";
			}
		}

		// add any remaining text to this render iteration's relevant text
		this.cur_str += render_text;

		// signal that this textbox's file content should advance
		this.advance_chars += render_text.length;

		// process any currently open style or script blocks
		if (!this.processTextBlock(render_text)) {
			// something went wrong while processing the text blocks
			// the rendering can't be completed
			return(false);
		}

		// check if the instance variable "building_script" needs to be set to false
		if (building_script_off) {
			// it does
			this.building_script = false;
		// check if the instance variable "building_style" needs to be set to false
		}else if (building_style_off) {
			// it does
			this.building_style = false;
		}

		// check if in the next render iteration this textbox needs to change the write mode
		if (write_by_line != null) {
			// it does
			// update the write mode for the next render iteration
			this.write_by_line = write_by_line;
		}

		// at this point everything went OK
		return(true);
	}

	// handles updating and resolving any currently open style or script blocks
	// returns true if everything went OK | false otherwise
	private processTextBlock(text: string): boolean {
		// check if the program is currently inside a style block
		if (this.building_style) {
			// it is
			// update the style block's text in storage
			// NOTE: remove any tags
			this.style_text += text.replace(new RegExp(TextBox.re_str_tags_, "ig"), "");

			// check if a CSS selector just finished being processed
			// NOTE: style blocks are not added all at once when the entire block has been processed (like script blocks),
			// 		 but rather each CSS selector is added to the DOM's style tag as it finishes being processed
			if (this.style_text.search(/\}\s?$/i) != -1) {
				// flag the style block's text in storage to be added to the DOM's style tag
				this.dump_style = true;
			}
		// check if the program is currently inside a script block
		}else if (this.building_script) {
			// it is
			// update the script block's text in storage
			// NOTE: remove any tags
			this.script_text += text.replace(new RegExp(TextBox.re_str_tags_, "ig"), "");
		}

		// at this point everything went OK
		return(true);
	}

	// handles adding the stored text for the style/script blocks to the respective DOM tags
	// returns true if everything went OK | false otherwise
	private dumpTextBlock(): boolean {
		// check if the stored text for the style block is to be dumped to the DOM
		if (this.dump_style) {
			// it is
			// add the stored text to the DOM's style tag
			TextBox.dom_style_tag_.innerHTML += this.style_text;

			// clear the stored text for the style block
			this.style_text = "";

			// reset the flag to dump the style block text
			this.dump_style = false;
		}

		// check if the stored text for the script block is to be dumped to the DOM
		if (this.dump_script) {
			// it is
			//create a new DOM script tag
			let new_script_tag: HTMLScriptElement = document.createElement("script");

			// add the stored text to the new DOM script tag
			new_script_tag.innerHTML = this.script_text;

			// append the new DOM script tag to the BODY element
			document.body.appendChild(new_script_tag);

			// clear the stored text for the script block
			this.script_text = "";

			// reset the flag to dump the script block text
			this.dump_script = false;
		}

		// at this point everything went OK
		return(true);
	}

	// read the file associated with this text box and store its content in file_content
	public getFileContent(): Promise<string> {
		return(new Promise((resolve, reject) => {
			// store the HTTP request object
			let http_request: any;

			try {
				if ((<any>window).XMLHttpRequest) {
					// code for IE7+, Firefox, Chrome, Opera, Safari
					http_request = new XMLHttpRequest();
				}else{
					// code for <= IE6
					http_request = new ActiveXObject("MSXML2.XMLHTTP.3.0");
				}
			}catch(e) {
				// the contents of the file associated with this text box couldn't be read
				// reject this promise
				reject(`The contents of the text box ${this.textbox_name} couldn't be retrieved.`);
			}

			// set the callback for when the ajax request returns
			http_request.onload = () => {
				// check if the request returned successfuly
				if (http_request.status === 200) {
					// it did
					// get the AJAX call's response
					let file_text: string = http_request.responseText;

					// check if the response was an empty string
					if (file_text == "") {
						// it was
						// the contents of the file associated with this text box couldn't be read
						// reject this promise
						reject(`The contents of the text box ${this.textbox_name} couldn't be retrieved.`);
					}

					// standardize the new line identifier in the response text
					file_text = file_text.replace(/(\n|\r\n)/g, "\r");

					// add <span> tags for color coding the style and script text
					file_text = TextBox.addScriptTags_(TextBox.addStyleTags_(file_text));

					// store the processed file text
					this.file_content = file_text;

					// at this point everything went OK
					resolve("");
				}else{
					// it didn't
					// the contents of the file associated with this text box couldn't be read
					// reject this promise
					reject(`The contents of the text box ${this.textbox_name} couldn't be retrieved.`);
				}
			}

			// execute the AJAX call
			http_request.open("GET", `/ajax/read_file.php?fn=${this.textbox_name}&lang=${TextBox.lang_}`, true);
			http_request.send();
		}));
	}

	// handles the process of determining the delay until the next render iteration starts
	private determineSpeed(): void {
		// check if a global speed is set
		if (TextBox.global_speed_ != null) {
			// it is
			// set the speed equal to the global speed
			this.speed = TextBox.global_speed_;

			// all done
			return;
		}

		// check if a forced speed is set
		if (this.forced_speed != null) {
			// it is
			// set the speed equal to the forced speed
			this.speed = this.forced_speed;

			// all done
			return;
		}

		// check if this textbox is currently inside a style or a script block
		// NOTE: inside these blocks the program is either writing by char or by line
		// 		 there is no pauses on "," or "." since this content is not standard text
		if (this.building_style || this.building_script) {
			// it is
			// stores the relevant TextBox.speeds_ index
			let speeds_index: string = "";

			// start by adding the tag relevant for the style/script block this textbox is in
			speeds_index += (this.building_style ? "style_by_" : "script_by_");

			// adjust the speeds_ index based on the current write mode
			speeds_index += (this.write_by_line ? "line" : "char");

			// set the speed equal to the relevant tag and write mode speed
			this.speed = (<any>TextBox.speeds_)[speeds_index];

			// all done
			return;
		}

		// check if the program is in "write by line" mode
		if (this.write_by_line) {
			// it is
			// set the speed equal to the default "write by line" speed
			this.speed = TextBox.speeds_["text_by_line"];

			// all done
			return;
		}

		// check if the next render iteration will use another textbox
		if (this.next_textbox != "") {
			// it will
			// in this case it doesn't make sense to determine the speed based on this textbox's content
			// so use the default speed
			return;
		}

		// at this point this textbox is processing standard text and there are no imposing speeds
		// so the speed will depend on the text currently being processed
		// get the last character of the text processed in this render iteration plus the next character to be rendered
		let test_str: string = this.cur_str.substr(-1) + this.file_content.substr(0, 1);

		// check if a short pause is required
		if (test_str.search(TextBox.regex_["short_pause"]) != -1) {
			// it is
			// set the speed equal to the short pause speed
			this.speed = TextBox.speeds_["short_pause"];
		// check if a medium pause is required
		}else if (test_str.search(TextBox.regex_["medium_pause"]) != -1) {
			// it is
			// set the speed equal to the medium pause speed
			this.speed = TextBox.speeds_["medium_pause"];
		// check if a long pause is required
		}else if (test_str.search(TextBox.regex_["long_pause"]) != -1) {
			// it is
			// set the speed equal to the long pause speed
			this.speed = TextBox.speeds_["long_pause"];
		}

		// at this point either a non-default speed was set or the default speed will be used
		return;
	}

	// handles scrolling this textbox's content element to the bottom, making the last
	// written text visible
	public scrollToBottom(): void {
		// check if a reference to this textbox's element was acquired
		if (this.textbox_elem == null) {
			// it wasn't, so bail out
			return;
		}

		// get a reference to this textbox's content element
		let render_elem = this.textbox_elem.lastElementChild;

		// check if a reference to this textbox's content element was acquired
		if (render_elem == null) {
			// it wasn't, so bail out
			return;
		}

		// scroll this textbox's content element to the bottom
		render_elem.scrollTop = render_elem.scrollHeight;
	}

	// handles adding the <span> tags used for CSS text color coding
	private static addStyleTags_(text: string): string {
		// stores the current <style> tag indexes
		let tag_start: number = 0;
		let tag_end: number = 0;

		// stores the final text to be returned
		let final_text: string = "";

		// stores the temporary text as its being processed
		let temp_text: string = "";

		// loops while there are <style> tags to be processed
		while ((tag_start = text.search(/\<style[^\<]*\>/i)) != -1) {
			// move the tag's start index to the index imediatly after this tag
			tag_start += text.substr(tag_start, text.indexOf(">", tag_start) - tag_start).length + 1;

			// add the text between the last processed tag's end index and the ">" of this tag
			final_text += text.substr(0, tag_start);

			// find the start index of the next closing <style> tag
			tag_end = text.indexOf("</style>", tag_start);

			// check if a closing tag was found
			if (tag_end == -1) {
				// it wasn't
				// then this block will go to the end of the text
				tag_end = text.length;
			}

			// get the text inside this <style> tag
			temp_text = text.substr(tag_start, tag_end - tag_start);

			// add the CSS keyword spans
			temp_text = temp_text.replace(TextBox.regex_["css_keyword"], "<span class='css_keyword'>$1</span>(");

			// add the CSS selector spans
			temp_text = temp_text.replace(TextBox.regex_["css_selector"], "<span class='css_selector'>$1</span>$2");

			// remove any selector span tags that might have been placed inside the property:value area
			temp_text = temp_text.replace(/\{([^{}]+)<span class='css_selector'>([^{}]+)<\/span>([^{}]+)\}/ig, (string) => {
				return(string.replace(/<span class='css_selector'\s*>([^\/]+)<\/span>/ig, "$1"));
			});

			// add the CSS property name spans
			temp_text = temp_text.replace(TextBox.regex_["css_property"], "$1<span class='css_property'>$2</span>$3");

			// add the CSS property value spans
			temp_text = temp_text.replace(TextBox.regex_["css_value"], ":<span class='css_value'>$1</span>$2");

			// add the CSS property value units spans
			temp_text = temp_text.replace(TextBox.regex_["css_value_units"], "$1<span class='css_units'>$2</span>");

			// add the processed text and the closing style tag to the final text
			final_text += temp_text + "</style>";

			// remove from the text the processed chunk
			text = text.slice(tag_end + "</style>".length);
		}

		// add any remaining text after the last <style> tag to the final text
		final_text += text;

		// return the processed text
		return(final_text);
	}

	// handles adding the <span> tags used for Script text color coding
	private static addScriptTags_(text: string): string {
		// stores the current <script> tag indexes
		let tag_start: number = 0;
		let tag_end: number = 0;

		// stores the final text to be returned
		let final_text: string = "";

		// stores the temporary text as its being processed
		let temp_text: string = "";

		// loops while there are <script> tags to be processed
		while ((tag_start = text.search(/\<script[^\<]*\>/i)) != -1) {
			// move the tag's start index to the index imediatly after this tag
			tag_start += text.substr(tag_start, text.indexOf(">", tag_start) - tag_start).length + 1;

			// add the text between the last processed tag's end index and the ">" of this tag
			final_text += text.substr(0, tag_start);

			// find the start index of the next closing <style> tag
			tag_end = text.indexOf("</script>", tag_start);

			// check if a closing tag was found
			if (tag_end == -1) {
				// it wasn't
				// then this block will go to the end of the text
				tag_end = text.length;
			}

			// get the text inside this <script> tag
			temp_text = text.substr(tag_start, tag_end - tag_start);

			// add the logic operator spans
			temp_text = temp_text.replace(TextBox.regex_["js_logic_operator"], "<span class='js_logicoperator'>$1</span>");

			// add the math operator spans
			temp_text = temp_text.replace(TextBox.regex_["js_math_operator"], "$1<span class='js_mathoperator'>$2</span>");

			// add the function declaration spans
			temp_text = temp_text.replace(TextBox.regex_["js_func_declaration"], "<span class='js_func_word'>$1</span><span class='js_func_name'>$2</span>(<span class='js_func_param'>$3</span>)$4");

			// add the keyword spans
			temp_text = temp_text.replace(TextBox.regex_["js_keyword"], "$1<span class='js_keyword'>$2</span>$3");

			// add the misc keyword spans
			temp_text = temp_text.replace(TextBox.regex_["js_object"], "<span class='js_object'>$1</span>");

			// add the value spans
			temp_text = temp_text.replace(TextBox.regex_["js_value"], "<span class='js_value'>$1</span>");

			// add the method spans
			temp_text = temp_text.replace(TextBox.regex_["js_method"], ".<span class='js_method'>$1</span>");

			// remove any math operator span tags from the "/" with the meaning of start and end of a regexp
			temp_text = temp_text.replace(/<span class='js_mathoperator'\s*>\/<\/span>([^\/]+)<span class='js_mathoperator'\s*>\/<\/span>([gmi]*)/ig, "/$1/$2");

			// stores the tag identifiers that need to be processed with special treatment
			let regex_keys: string[] = ["js_regexp", "js_string"];

			// stores the replacement regex string for the values of regex_keys
			let regex_strings: string[] = [
				"$1<span class='js_regexp'>$2</span>",
				"<span class='js_string'>$1</span>"
			];

			// loop through the relevant tag identifiers in the stated order
			for (let i = 0; i < regex_keys.length; i++) {
				// get this iteration's tag identifier
				let regex_key = regex_keys[i];

				// stores the processed chunk of text as its being cleaned up below
				let str_aux: string = "";

				// get the regex match object for the existance of this tag in the text
				let re_match: RegExpMatchArray | null = null;

				// loop while there are tags to process in the text
				while ((re_match = temp_text.match(TextBox.regex_[regex_key])) != null) {
					// check if the index of this match is valid
					if (re_match.index == undefined) {
						// it isn't
						// bail out of this operation
						break;
					}

					// get the text before the start of this tag (no processing needed)
					str_aux += temp_text.substr(0, re_match.index);

					// for the text inside this tag, remove any other color coding span tags from previous steps
					// and finaly add this tag's color coding spans
					str_aux += temp_text.substr(re_match.index, re_match[0].length).replace(TextBox.regex_[regex_key], (string: string) => {
						// explicitely remove any js_mathoperator span tags that may have been placed around other html tags
						return(string.replace(/<span class='js_mathoperator'\s*>([<>]+)<\/span>/ig, "$1").replace(/<span\s+class='(css|js)_\w+'\s*>([^>]*)<\/span>/ig, "$2"));
					}).replace(TextBox.regex_[regex_key], regex_strings[i]);

					// remove the processed text from the non-processed text
					temp_text = temp_text.slice(re_match.index + re_match[0].length);
				}

				// add any final characters that didn't need to be processed
				str_aux += temp_text;

				// store the processed text
				temp_text = str_aux;
			}

			// add the processed text and the closing script tag to the final text
			final_text += temp_text + "</script>";

			// remove from the text the processed chunk
			text = text.slice(tag_end + "</script>".length);
		}

		// add any remaining text after the last <script> tag to the final text
		final_text += text;

		// return the processed text
		return(final_text);
	}

	// handles creating the DOM element for a text box
	private static createTextBoxElem_(elem_id: string): HTMLElement | null {
		// check if the reference to the work_area div element is valid
		if (TextBox.div_work_area_ == null) {
			// it isn't, so bail out
			return(null);
		}

		// create a new DIV element
		let new_div: HTMLDivElement = document.createElement("div");

		// insert the div's ID, class and style data
		new_div.id = elem_id;
		new_div.className = "content flex_item";
		new_div.style.order = TextBox.textbox_elem_count.toString();

		// create the text inner div
		let new_div_text = document.createElement("div");

		// insert the text inner div's class
		new_div_text.className = "text text_expanded";

		// add the text inner div to the text box div
		new_div.appendChild(new_div_text);

		// add the text box div to the DOM's body
		TextBox.div_work_area_.appendChild(new_div);

		// if the addHeaders() function is already defined, call it
		if (typeof addHeaders == "function") {
			addHeaders(elem_id);
		}

		// advance the counter of how many textbox elements are created in the DOM
		TextBox.textbox_elem_count++;

		// return a reference to this textbox's DOM element
		return(document.getElementById(elem_id));
	}
}
