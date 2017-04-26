/*!!***********************************************************
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

// imports
import {Engine} from "./classes/Engine";

// global variable storing the Engine instance to be used in the program
let engine_obj_: Engine;

// stores the duration of the css transitions in use (in milliseconds)
export let css_transition_dur_: number | null = null;

// stores a reference to the DOM element where all the textboxes will be appended
const div_work_area_: HTMLElement | null = document.getElementById("work_area");

// runs once the document is done loading
// sets basic parameters used to run the application
// then starts the application (if building the content dynamically with JS)
// OR simply sets the expand/collapse event listeners (if the content as built on the server)
function init(built_on_server: boolean) : void {
	/*
		START OF THE CONFIGURATION AREA
	*/

	// list of file names to use
	// the files must be .txt and their contents will be written to a DOM element with
	// ID equal to the file's name
	const file_list: string[] = ["narrator_box", "style_box", "script_box", "about_box"];

	// the index of "file_list" corresponding to the first file to run
	const start_index: number = 0;

	// stores the language to be used
	// NOTE: defaults to english
	let lang: string = "EN";

	// stores the supported language tags
	const valid_langs: string[] = ["PT", "EN"];

	/*
		END OF THE CONFIGURATION AREA
	*/

	// get a reference to the HTML DOM element
	const html_elem: HTMLElement = document.getElementsByTagName("html")[0];

	// check if the HTML element has a "lang" property
	if ("lang" in html_elem) {
		// it has
		// get the language tag
		let tentative_lang: string = html_elem.lang.toUpperCase();

		// check if the tentative language is one of the supported ones
		if (valid_langs.indexOf(tentative_lang) != -1) {
			// it is, so store it
			lang = tentative_lang;
		}
	}

	// check if the DOM has at least 1 style tag
	if (document.body.getElementsByTagName("style").length == 0) {
		// it hasn't
		// create a style tag and append it to the BODY element
		document.body.appendChild(document.createElement("style"));
	}

	// check if the DOM has a DIV with id "work_area", where all the textboxes will be appended
	if (document.getElementById("work_area") == null) {
		// it hasn't
		// create a div tag
		let div_elem: HTMLElement = document.createElement("div");

		// add the id
		div_elem.id = "work_area";

		// add the classes
		div_elem.className = "no_events";

		// append it to the BODY element
		document.body.appendChild(div_elem);
	}

	// create an instance of the Engine class
	engine_obj_ = new Engine(lang, file_list, start_index, built_on_server);

	// check if the page content was be built on the server
	if (!built_on_server) {
		// it wasn't
		// start the program
		engine_obj_.run();
	}
}

// finds the duration of the CSS transitions in use on the website
// NOTE: must be called after any transitions are set in the style tag
export function getTransitionDuration(): void {
	// by default set the duration to zero
	css_transition_dur_ = 0;

	// stores the style tag where all styles should be written to
	const dom_style_tag: HTMLElement = document.body.getElementsByTagName("style")[0];

	// check if a reference to the DOM's style tag was acquired
	if (dom_style_tag == null) {
		// it wasn't, so bail out
		return;
	}

	// regexp to find and grab the duration value and unit
	const re_string = /\*\s*\{[^\{\}]+transition\s*:[^\{\}\d]+([\d\.]+)(s|ms)[^\{\}]+\}/i;

	// stores the match object from the regex below
	let re_match: RegExpMatchArray | null = null;

	// check if there is a style setting a transition duration
	if ((re_match = dom_style_tag.innerHTML.match(re_string)) != null) {
		// there is
		// calculate the transition duration value in milliseconds
		css_transition_dur_ = parseFloat(re_match[1]) * (re_match[2] == "s" ? 1000 : 1);
	}
}
