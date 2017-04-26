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

// imports
import {TextBox} from "./TextBox";
import {getTransitionDuration, css_transition_dur_} from "../main";

/* #bundler remove */
// forward declare these functions to please the requirements of the Engine class
// these functions will be implemented when reading from the script_box.txt file
function textboxExpandCollapse(id: string, only_expand: boolean): void {}
/* #bundler remove */

// this class handles the overall flow control of building the page on the client side
// it will control which text box should be active at any given time
export class Engine {
	// stores a flag indicating whether the program has been paused or not
	public static is_paused_: boolean = false;

	// stores a reference to the DOM element where all the textboxes will be appended
	private static div_work_area_: HTMLElement | null = document.getElementById("work_area");

	// stores the ID of the setTimeout() call that will start the next render iteration
	private timeout_id: number | null = null;

	// stores the language tag in use
	private lang: string = "";

	// stores the names of the files to read (each file corresponds to a text box on the page)
	private file_list: string[] = [];

	// stores the TextBox instances that have been created
	private text_box_objs: {[key: string]: TextBox} = {};

	// stores the expand/collapse state of each textbox's DOM element
	// true = expanded | false = collapsed
	// NOTE: this is needed when the program resumes from a pause (where the user can expand/collpase the
	// 		 textboxes) to reset them to how they were before the pause
	private expanded_text_boxes: {[key: string]: boolean} = {};

	// stores the name of the currently active text box
	// NOTE: matches the keys of "text_box_objs"
	private active_box: string = "";

	// stores the Promise objects created by the TextBox instances when they perform
	// ajax calls to get their respective file content
	private promises: Promise<string>[] = [];

	// stores the currently active speed level (selected by the user in the speed controls)
	// by default it will use the 1st speed level
	private active_speed_level: number = 0;

	// stores the new speed level that should take effect at the start of the next render iteration
	public pending_speed_level: number | null = null;

	public constructor(lang: string, file_list: string[], start_index: number, built_on_server: boolean) {
		// update instance variables
		this.lang = lang;
		this.file_list = file_list;

		// set the TextBox class' active speeds to the defaults
		this.setDefaultSpeeds();

		// set the TextBox class' language tag
		TextBox.setLang_(this.lang);

		// set the currently active text box
		this.active_box = this.file_list[start_index];

		// loop through each file name
		for (let i = 0; i < this.file_list.length; i++) {
			// get this ietration's file name
			let file_name: string = this.file_list[i];

			// instantiate the TextBox class for this file
			this.text_box_objs[file_name] = new TextBox(file_name);

			// all textboxes DOM elements are created in the expanded state
			this.expanded_text_boxes[file_name] = true;

			// check if the page's content was built on the server
			if (!built_on_server) {
				// it wasn't
				// ask this TextBox object to get the contents of its respective file
				this.promises.push(this.text_box_objs[file_name].getFileContent());
			}
		}
	}

	// main loop of the program
	// handles calling the text boxes in order of need to build the website's content
	// will continue from where it left off or from the text box set in the constructor (if first call)
	public run(): void {
		// wait for all the TextBox objects to resolved their async tasks
		Promise.all(this.promises)
		// if all promises have been resolved
		.then(() => {
			// reset the setTimeout() ID that started this render iteration
			this.timeout_id = null;

			// check if the name of the next TextBox instance to work is valid
			if (!(this.active_box in this.text_box_objs)) {
				// it isn't
				// print error message
				console.log(`A call to the textbox \"${this.active_box}\" was made, but it doesn't exist.`);

				// bail out
				return;
			}

			// check if the user changed the speed level between this render iteration and the last one
			if (this.pending_speed_level != null) {
				// yes
				// change the active speed level
				this.changeSpeed(this.pending_speed_level);
			}

			// call the TextBox instance that should work next to start working
			// and wait for the return value which is either the name of the TextBox instance
			// that will work next OR an empty string if there is no more content to render
			// in that TextBox and no <goto> tag was encountered (the program should end) OR
			// null if the textbox is still working and is pausing between render iterations
			let return_value: {textbox: string, delay: number} = this.text_box_objs[this.active_box].run();

			// check if the return value signals the end of the program
			if (return_value["textbox"] === "") {
				// it does
				// execute end of program tasks
				this.finalTasks();

				// bail out
				return;
			}else{
				// it doesn't
				// store the name of the textbox to call on the next render iteration
				this.active_box = return_value["textbox"];
			}

			// check if the program is paused
			if (!Engine.is_paused_) {
				// it isn't
				// set the delayed call to start the next render iteration
				this.timeout_id = window.setTimeout(() => {
					this.run();
				}, return_value["delay"]);
			}
		})
		// if any of the promises were rejected
		.catch((message: string) => {
			// print the error message
			console.log(message);
		});
	}

	// sets the active speeds to the default speeds
	private setDefaultSpeeds(): void {
		// call the setter for the TextBox speeds_ variable
		TextBox.setSpeeds_({
			"default": 20,
			"style_by_char": 10,
			"script_by_char": 10,
			"style_by_line": 100,
			"script_by_line": 100,
			"text_by_line": 100,
			"short_pause": 275,
			"medium_pause": 550,
			"long_pause": 750
		});
	}

	// enforces that all the provided textboxes' content areas are scrolled to the bottom
	// receives an array with the relevant textbox names OR if none are provided, all
	// textboxes will be worked with
	public scrollBoxesToBottom(names: string[] = Object.keys(this.text_box_objs)): void {
		// loop through each relevant textbox and tell them to scroll to the
		// bottom of their content
		for (let i = 0; i < names.length; i++) {
			// handle this textbox
			this.text_box_objs[names[i]].scrollToBottom();
		}
	}

	// updates the expanded/collapsed state of a textbox
	public setTextboxState(name: string, expanded: boolean): void {
		// check if the provided textbox is valid
		if (!(name in this.text_box_objs) || !(name in this.expanded_text_boxes)) {
			// it isn't, so bail out
			return;
		}

		// check if the program is executing
		if (!Engine.is_paused_) {
			// it is
			// update the provided textbox's state, since it is the program's intended state
			// NOTE: if the state change was triggered by the user (when the program is paused) then
			// 		 only the TextBox will be informed of its state change. This way when the program
			// 		 resumes all textboxes can be reset to their program intended states
			this.expanded_text_boxes[name] = expanded;
		}

		// inform the provided textbox that its state has changed
		this.text_box_objs[name].expanded = expanded;
	}

	// handles blocking/unblocking mouse events on all textbox DOM elements
	private static blockMouseEvents_(turn_on: boolean): void {
		// check if a reference to the relevant DOM element is available
		if (Engine.div_work_area_ == null) {
			// it isn't, so bail out
			return;
		}

		// get a reference to the relevant DOM element's classList
		let elem_classlist: DOMTokenList = Engine.div_work_area_.classList;

		// check if the desired task is to turn on the block on mouse events
		if (turn_on) {
			// it is
			// add the class
			elem_classlist.add("no_events");
		}else{
			// it isn't
			// remove the class
			elem_classlist.remove("no_events");
		}
	}

	// executes any necessary tasks when the program terminates
	private finalTasks(): void {
		// get a reference to the "footer_controls" DOM element
		let footer_elem: HTMLElement | null = document.getElementById("footer_controls");

		// check if the footer DOM element was found
		if (footer_elem != null) {
			// it was
			// remove the speed control buttons from the UI
			footer_elem.className += " no_events opacity_zero";
		}

		// unblock mouse events on the textboxes, allowing the user to expand/collapse them
		Engine.blockMouseEvents_(false);
	}

	// pauses the execution of the program
	public pauseProgram(): void {
		// check if the a delayed call to start the next render iteration is set
		if (this.timeout_id != null) {
			// it is
			// stop it from triggering
			window.clearTimeout(this.timeout_id);
		}

		// set the flag indicating the program is paused
		Engine.is_paused_ = true;

		// get a reference to the pause button's DOM element
		let pause_button_elem: HTMLElement | null = document.getElementById("pause_button");

		// check if the pause button element reference was acquired
		if (pause_button_elem != null) {
			// hide the pause button
			pause_button_elem.classList.add("hidden");
		}

		// get a reference to the resume button's DOM element
		let resume_button_elem: HTMLElement | null = document.getElementById("resume_button");

		// check if the pause button element reference was acquired
		if (resume_button_elem != null) {
			// hide the pause button
			resume_button_elem.classList.remove("hidden");
		}

		// unblock mouse events on all the textboxes DOM elements
		Engine.blockMouseEvents_(false);
	}

	// resumes the execution of the program
	public resumeProgram(): void {
		// stores the delay on the call to the start of the next render iteration
		// be default there will be no delay
		// NOTE: used to allow all the textboxes to reset their expand/collapse states
		// 		 to how they were before the pause
		let resume_delay: number = 0;

		// block mouse events on all the textboxes DOM elements
		Engine.blockMouseEvents_(true);

		// check if the expand/collapse functionality is already implemented
		if (typeof textboxExpandCollapse == "function") {
			// it is
			// check if the currently active CSS transition duration is known
			if (css_transition_dur_ === null) {
				// it isn't, so determine it's value
				getTransitionDuration();
			}

			// loop through all the textboxes
			for (let name in this.text_box_objs) {
				// check if the current state of this textbox matches the state it should be in
				if (this.text_box_objs[name].expanded != this.expanded_text_boxes[name]) {
					// it doesn't, so flip this textbox's state
					textboxExpandCollapse(name, false);

					// since at least 1 textbox will have to change state, delay the call to the next
					// render iteration by the CSS transition duration. This will make sure all the textboxes
					// have been reset before any text starts to be rendered
					resume_delay = <number>css_transition_dur_;
				}
			}
		}

		// set the flag indicating the program is not paused
		Engine.is_paused_ = false;

		// get a reference to the resume button's DOM element
		let resume_button_elem: HTMLElement | null = document.getElementById("resume_button");

		// check if the pause button element reference was acquired
		if (resume_button_elem != null) {
			// hide the pause button
			resume_button_elem.classList.add("hidden");
		}

		// get a reference to the pause button's DOM element
		let pause_button_elem: HTMLElement | null = document.getElementById("pause_button");

		// check if the pause button element reference was acquired
		if (pause_button_elem != null) {
			// hide the pause button
			pause_button_elem.classList.remove("hidden");
		}

		// set the call to start the next render iteration
		window.setTimeout(() => {
			this.run();
		}, resume_delay);
	}

	// handles changinf the speed values, based on the currently selected speed control
	/*
		0 = normal speeds (the ones set by default at the start of the application)
		1 = no pauses, but in write by character mode
		2 = no pauses, no default delay and in write by line mode
	*/
	private changeSpeed(speed_level: number): void {
		// check if the new desired speed level is the current speed level
		if (speed_level == this.active_speed_level) {
			// it is, so nothing needs to be done
			return;
		}

		// depending on the new desired speed level, do the necessary processing
		switch (speed_level) {
			case (0) :
				// set the speeds to the default speeds
				this.setDefaultSpeeds();

				// turn off the global write by line mode
				TextBox.global_write_by_line_ = false;

				// reset the global speed
				TextBox.global_speed_ = null;

				break;
			case (1) :
				// change the pause speeds
				TextBox.setSpeeds_({
					"short_pause": 0,
					"medium_pause": 0,
					"long_pause": 0
				});

				// turn off the global write by line mode
				TextBox.global_write_by_line_ = false;

				// reset the global speed
				TextBox.global_speed_ = null;

				break;
			case (2) :
				// turn on the global write by line mode
				TextBox.global_write_by_line_ = true;

				// set the global speed to zero
				TextBox.global_speed_ = 0;

				break;
		}

		// get a reference to all the speed control buttons
		let speed_buttons: NodeListOf<Element> = document.querySelectorAll("#footer_controls .speed");

		// get the classList for the old speed level control button
		let button_classlist: DOMTokenList = speed_buttons[this.active_speed_level].classList;

		// flag the old speed level button as not selected
		button_classlist.remove("selected");
		button_classlist.add("clickable");

		// get the classList for the new speed level control button
		button_classlist = speed_buttons[speed_level].classList;

		// flag the old speed level button as not selected
		button_classlist.remove("clickable");
		button_classlist.add("selected");

		// update the active speed level
		this.active_speed_level = speed_level;

		// reset the pending speed level
		this.pending_speed_level = null;
	}
}
