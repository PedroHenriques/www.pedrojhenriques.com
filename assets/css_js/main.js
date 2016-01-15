// runs once the document is done loading
// sets basic parameters used to run the application
// then starts the application
function init() {
	// list of file names to use
	// the files must be .txt and should have the name of the DOM element's ID where their
	// content will be written to
	var fileList = ["narrator_box", "style_box", "script_box", "about_box"];

	// the name of the first file to run
	var firstFile = "narrator_box";

	// get the currently active language
	lang = document.getElementsByTagName("html")[0].lang.toUpperCase();
	// validate lang
	var validLangs = new Array("PT", "EN"); // valid lang tags
	if (validLangs.indexOf(lang) == -1) {
		// if not a valid lang tag, set to default
		lang = "EN";
	}

	// grab relevant document elements
	tagStyle = document.body.getElementsByTagName("style")[0];
	tagDivs = new Array; // used to store all the DIV elements where files are written to
	divWorkArea = document.getElementById("work_area");

	// global variable where all the text files' content are stored
	// together with the index, in each file, that we're on
	filesContent = new Object;

	// set global variables used to control the application
	textboxCount = 0;
	setDefaultSpeeds(); // sets the global variable with the default speeds
	forcedSpeed = null; // used to force the application into a specific speed, regardless of what character we're writing to screen
	buildingStyle = false;
	buildingScript = false;
	strStyle = new String;
	strScript = new String;
	writeByLine = false; // used to force the application to write line by line, instead of by character
	reByLine = new RegExp("byline", "i");
	reTagContent = new RegExp("<[\\w\\/\\s=\\'\\\"]*>", "gi");
	reLowerThan = new RegExp("&lt;", "gi");
	reGreaterThan = new RegExp("&gt;", "gi");
	reEncodedHtml = new RegExp("(&lt;|&gt;)", "i");
	tagOpen = new Array;
	strNewLine = "\\r\\n";
	reNewLine = new RegExp("[" + strNewLine + "]", "i");
	strShortPause = "^(,)";
	strMediumPause = "^(\\.|!)";
	strLongPause = "^(["+strNewLine+"]{2})";
	/* REGEX NOTES
		- testing for an empty line (long pause) by checking for 2 new lines in a row
	*/

	// global variables used for max speed mode
	globalWriteByLine = false;
	globalSpeed = null;

	// global variables used to pause/resume the application
	timeoutId = null;
	isPaused = false;
	curFile = new String;

	// global variable used to store the duration of the css transitions in use
	cssTransitionDur = null; // in milliseconds

	// populate the flow control object
	while (fileList.length > 0) {
		var fileName = fileList.shift();

		Object.defineProperty(filesContent, fileName, {
			value: {
				"used" : false,
				"expanded" : true,
				"text" : ""
			},
			writable: true
		});
	};
	
	// start the application via the 1st file on the list
	buildFileContent(firstFile);
}

// grabs the content of a file
// then calls the start of the processing of the file's text
function buildFileContent(fileName) {
	try{
		if (window.XMLHttpRequest) {
			// code for IE7+, Firefox, Chrome, Opera, Safari
			httpRequest = new XMLHttpRequest();
		}else{
			// code for IE6, IE5
			httpRequest = new ActiveXObject("Microsoft.XMLHTTP");
		}
		
		httpRequest.onreadystatechange = function() {
			if (httpRequest.readyState == 4 && httpRequest.status == 200) {
				// got the answer
				var fileText = httpRequest.responseText;

				if (fileText != "") {
					// check if the this file's target element exists
					// and if it doesn't, create it first
					if (document.getElementById(fileName) == null) {
						createElem(fileName);
					}

					// add <span> tags for color coding the text
					fileText = addStyleTags(fileText.replace(/(\n|\r\n)/g, "\r"));
					fileText = addScriptTags(fileText);

					// start the writing to screen process
					writeToScreen(fileName, fileText);
				}
			}
		}
	}catch(e){
		return(false);
	}
	
	httpRequest.open("GET", "/ajax/read_file.php?fn=" + fileName + "&lang=" + lang, true);
	httpRequest.send();
}

// runs a string and writes it to the screen at a certain speed
// also responsible for writing any styles and scripts to the correct tag on the document
function writeToScreen(fileName, text) {
	// store the current file's name, in case a pause execution is called
	curFile = fileName;

	// if no text was passed, then continue where we left it
	if (text == "") {
		text = filesContent[fileName]["text"];
	}else{ // if text was passed, then store it
		filesContent[fileName]["text"] = text;
		filesContent[fileName]["used"] = true;
	}

	// local variables used to control the movement along the string
	var speed = speeds.default;
	var numCharsRemove = 1; // #characters to advance on the string at the end of this function
	var gotoName = "";
	var strToWrite = new String;
	// grab the length of the currently opened tags, if any
	var tagOpenLength = (tagOpen.length > 0 ? tagOpen.reduce(function (n1, n2) { return(n1+n2) }) : 0);

	// local variables used to control when to write text to the style and script tags of the document
	var activateStyle = false;
	var activateScript = false;

	// grab the character to work with in this cycle of the function
	var curStr = text.substr(0, 1);

	// check if the current character is the start of a tag
	// process any tags until we reach a non tag character or the end of the text
	while (curStr.match(/\</i) != null) {
		// grab the tag content
		var tagContent = text.substr(numCharsRemove-1, text.indexOf(">", numCharsRemove-1) - numCharsRemove + 2);
		var goToCharAfterTag = true;

		// if the tag is a style or script tag (don't write the tag to the screen)
		if (tagContent.match(/\<\/?(script|style)[\s\w]*\>/i) != null) {
			// process the tag
			if (tagContent.match(/\<script.*\>/i) != null) { // starting a script block
				// flag that we're inside a script block
				// in order to write it to the tag
				buildingScript = true;

				// check if there are any modifiers in this tag
				if (tagContent.match(reByLine) != null) {
					// we want to write line by line
					writeByLine = true;
				}
			}else if (tagContent.match(/\<style.*\>/i) != null) { // starting a style block
				// flag that we're inside a style block
				// in order to write it to the tag
				buildingStyle = true;

				// check if there are any modifiers in this tag
				if (tagContent.match(reByLine) != null) {
					// we want to write line by line
					writeByLine = true;
				}
			}else if (tagContent.match(/\<\/script\>/i) != null) { // ending a script block
				// we're no longer inside a script block
				buildingScript = false;

				// force the application to go back to writing character by character
				writeByLine = false;

				// flag the need to write the finished block to the respective tag on the document
				activateScript = true;
			}else if (tagContent.match(/\<\/style\>/i) != null) { // ending a style block
				// we're no longer inside a style block
				buildingStyle = false;

				// force the application to go back to writing character by character
				writeByLine = false;

				// flag the need to write the finished block to the respective tag on the document
				activateStyle = true;
			}
		}else if (tagContent.match(/\<goto \w+\>/i) != null) { // it's a goto tag (signals a jump to a new file)
			// grab the target file's name
			var reTemp = new RegExp("\\<goto (\\w+)\\>", "i");
			gotoName = tagContent.match(reTemp)[1];

			// in this case we don't want to continue reading this file
			// so don't advance after the tag
			goToCharAfterTag = false;
			curStr = "";
		}else if (tagContent.match(/\<\/?speed[\s\w]*\>/i) != null) { // it's a tag to force the application into a specific speed
			if (tagContent.match(/\<speed.*\>/i) != null) { // starting a speed tag
				// grab the desired speed
				var reTemp = new RegExp("\\<speed\\s+(\\w+)\\>", "i");
				forcedSpeed = speeds[tagContent.match(reTemp)[1]];
			}else{ // ending a speed tag
				forcedSpeed = null;
			}
		}else if (tagContent.match(/\<\/?byline\>/i) != null) { // it's a tag to force the application into write line by line mode
			if (tagContent.match(/\<byline\>/i) != null) { // starting a byline tag
				writeByLine = true;
			}else{ // ending a byline tag
				writeByLine = false;
			}
		}else if (!writeByLine && !globalWriteByLine) { // it's another tag (ignore if not writing character by character)
			// add it to the screen
			strToWrite += tagContent;

			// if it's a closing tag
			var reTemp = new RegExp("<\\/[\\w\\/\\s=\\'\\\"]*>", "i");
			if (tagContent.match(reTemp) != null) {
				// remove the last open tag in the array
				tagOpen.pop();
			}else{ // it's an opening tag
				// grab the tag type and add it's length to the open tag array
				reTemp = new RegExp("<(\\w+)[\\w\\/\\s=\\'\\\".:-]*>", "i");
				tagOpen.push(tagContent.match(reTemp)[1].length + 3); // add 3 for the </> characters
			}
		}else{ // found a "<" and it's not one of the relevant tags when writing line by line
			// leave as is
			break;
		}

		// skip the tag characters when advancing to next character, in the next cycle
		numCharsRemove += tagContent.length;

		// change the current character to the 1st character after the tag, if we want to
		if (goToCharAfterTag) {
			curStr = text.substr(numCharsRemove - 1, 1);
		}

		// if we're writing by line, exit loop
		if (writeByLine || globalWriteByLine) {
			break;
		}
	}

	// if we're writing by line, grab the characters to write
	if (writeByLine || globalWriteByLine) {
		// grab the remaining text
		var testStr = text.substr(numCharsRemove - 1);
		// grab the index of the next line break
		var lbIndex = testStr.search(reNewLine);

		// find the next relevant closing tag, for the block we're in at the moment
		if (buildingScript) {
			var ctIndex = testStr.search(/\<\/script\>/i);
		}else if (buildingStyle) {
			var ctIndex = testStr.search(/\<\/style\>/i);
		}else{
			var ctIndex = testStr.search(/\<\/byline\>/i);
		}

		// if there are no more line breaks or closing tags in this file, go to EOF
		if (lbIndex == -1 && ctIndex == -1) {
			lbIndex = text.length - 1;
			ctIndex = text.length;
		}else{
			if (lbIndex == -1) {
				lbIndex = text.length;
			}
			if (ctIndex == -1) {
				ctIndex = text.length;
			}
		}

		// depending on which comes first, deal with it
		if (lbIndex >= 0 && lbIndex < ctIndex) {
			// line break comes first
			if (gotoName.length > 0) {
				// going to jump to a new file, don't grab the line break after the goto tag
				// grab all the text until the line break (excluding)
				curStr = testStr.substr(0, lbIndex);

				// advance the index on this file
				// NOTE: not doing -1, because we want to skip the line break after the goto tag
				numCharsRemove += curStr.length;
			}else{
				// grab all the text until the line break (including)
				curStr = testStr.substr(0, lbIndex + 1);

				// advance the index on this file
				numCharsRemove += curStr.length - 1;
			}
		}else{
			// the closing tag for the block comes first
			// grab all the text until the closing tag (exclusive)
			curStr = testStr.substr(0, ctIndex);

			// advance the index on this file
			numCharsRemove += curStr.length - 1;
		}
	}else if (curStr == "&") { // if the current character is a &, check if it belongs to an html encoded character
		// and if it does, grab the entire encoding
		// only relevant if writing character by character
		// grab what is between & and the first ; (if any)
		var strTmp = text.substr(numCharsRemove-1, text.indexOf(";", numCharsRemove-1) - numCharsRemove + 2);

		// test for the relevant html encoded characters
		if (strTmp.match(reEncodedHtml) != null) {
			// use the entire encoded character as the curStr
			curStr = strTmp;
			// advance the index on this file
			numCharsRemove += strTmp.length - 1;
		}
	}
	
	// if we're inside a style block see if we finished a code block, testing for a }
	// if we did, write that code block to the document
	// only if the string to write ends on the }
	if (buildingStyle && curStr.match(/\}\s?$/i) != null) {
		activateStyle = true;
	}
	
	// add the current valid characters to be written to the screen
	strToWrite += curStr;
	
	// if we're inside tag block, add the current character to the relevant buffer
	if (buildingStyle) {
		// remove any tags
		strStyle += strToWrite.replace(reTagContent, "");
	}else if (buildingScript) {
		// remove any tags
		strScript += strToWrite.replace(reTagContent, "");
	}
	
	if (strToWrite.length > 0) {
		// before writing to the textbox, make sure it's expanded, and if not expand it first
		if (typeof textboxExpandCollapse == "function") {
			textboxExpandCollapse(fileName, true);
		}

		// write the current character to the screen
		tagDivs[fileName].lastElementChild.innerHTML = tagDivs[fileName].lastElementChild.innerHTML.substr(0, tagDivs[fileName].lastElementChild.innerHTML.length - tagOpenLength) + strToWrite;

		// vertical scrollbar: scroll to the bottom of the div
		tagDivs[fileName].lastElementChild.scrollTop = tagDivs[fileName].lastElementChild.scrollHeight;
	}

	// if we just finished a block write it to the respective tag on the document
	if (activateStyle) {
		// write the finished block to the correct tag
		// replace all < and > from their html encoding to the actual characters
		tagStyle.innerHTML += strStyle.replace(reLowerThan, "<").replace(reGreaterThan, ">");
		// reset the block string
		strStyle = "";

		// reset this flag
		activateStyle = false;
	}else if (activateScript) {
		// create a script tag
		var tagScript = document.createElement("script");
		
		// write the finished block to the tag
		// replace all < and > from their html encoding to the actual characters
		tagScript.innerHTML = strScript.replace(reLowerThan, "<").replace(reGreaterThan, ">");

		// add the tag to the document
		document.body.appendChild(tagScript);
		
		// reset the block string
		strScript = "";

		// reset this flag
		activateScript = false;
	}

	// if there are characters left to process, call this function in a certain amount of time
	// with the remaining string as input
	if (gotoName.length > 0 || text.length - numCharsRemove > 0) {
		// if we paused the application, during this function's execution, stop running
		if (!isPaused) {
			// if no forced speed is set, check the normal speed types
			if (forcedSpeed === null && globalSpeed === null) {
				// determine if a non default speed is to be used
				// if we're inside a style or script block, always use the default speed
				if (!buildingStyle && !buildingScript) {
					// create a string with the current character and the next character to be written
					// used to test for the speed to be used
					var testStr = curStr + text.substr(numCharsRemove, 1);

					if (writeByLine) {
						speed = speeds.textByLine;
					}else if (testStr.match(new RegExp(strShortPause, "i")) != null) {
						speed = speeds.shortPause;
					}else if (testStr.match(new RegExp(strMediumPause, "i")) != null) {
						speed = speeds.mediumPause;
					}else if (testStr.match(new RegExp(strLongPause, "i")) != null) {
						speed = speeds.longPause;
					}
				}else if (buildingStyle) { // if inside a style tag
					if (writeByLine) {
						speed = speeds.styleByLine;
					}else{
						speed = speeds.styleByChar;
					}
				}else if (buildingScript) { // if inside a script tag
					if (writeByLine) {
						speed = speeds.scriptByLine;
					}else{
						speed = speeds.scriptByChar;
					}
				}
			}else{ // else, use the forced speed
				// if not in fastforward mode, use forcedSpeed
				if (globalSpeed === null) {
					speed = forcedSpeed;
				}else{ // else, we're in fastforward mode
					speed = globalSpeed;
				}
			}

			// remove the text already used
			filesContent[fileName]["text"] = filesContent[fileName]["text"].slice(numCharsRemove);

			// set the delayed call for the next character to be written
			timeoutId = window.setTimeout(function() {
				// if we're staying in the same file
				if (gotoName.length == 0) {
					writeToScreen(fileName, "");
				}else if (filesContent[gotoName]["used"] == false) {
					// if we're changing files, but the new file hasn't been use yet
					// grab the files' content first
					buildFileContent(gotoName);
				}else{
					// if we're changing files and the new file has been used already
					// continue where we left off
					writeToScreen(gotoName, "");
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
function createElem(elemId) {
	// create a new DIV element -> text box
	var newDiv = document.createElement("div");
	// insert the div's ID and class
	newDiv.id = elemId;
	newDiv.className = "content flex_item";
	newDiv.style.order = textboxCount++;

	// create the text inner div
	var newDivText = document.createElement("div");
	// insert the class
	newDivText.className = "text text_expanded";

	// add the text DIV to the text box DIV
	newDiv.appendChild(newDivText);

	// add the DIV to the DOM's body
	divWorkArea.appendChild(newDiv);

	tagDivs[elemId] = document.getElementById(elemId);

	// if the addHeaders() function is already defined, call it
	if (typeof addHeaders == "function") {
		addHeaders(elemId);
	}
}

// received the file's content and adds <span> tags for color coding of CSS text
function addStyleTags(text) {
	// local variables used to execute this task
	var tagStart = 0;
	var tagEnd = 0;
	var strFinal = new String;
	var strTemp = new String;
	var reKeyWord = new RegExp("(@[\\w\\t ]+)\\(", "gi");
	var reSelector = new RegExp("([\\w\\*\\.\\#\\t: ]+)(\\s?[\\{,])", "gi");
	var reProperty = new RegExp("([\\{;\\(]\\s*)([\\w-]+)(\\s*:)", "gi");
	var reValue = new RegExp(":([^:;]*)([;)])", "gi");
	var reValueUnits = new RegExp("(\\d)(px|%|rem|em|vh|vw|s|ms)", "gi");

	// loop until we've added all necessary tags
	while (true) {
		// grab the index of the next style tag
		tagStart = text.search(/\<style.*\>/i);

		// if we've reached the end of the text OR there are no more style tags left
		// exit the loop
		if (tagStart == -1) {
			// add any parts of the text not processed at the end
			if (text.length > 0) {
				strFinal += text.substr(0);
			}

			// all the text is processed, so exit the loop and continue code
			break;
		}

		// place the index after the style tag
		tagStart += text.substr(tagStart, text.indexOf(">", tagStart) - tagStart).length + 1;

		// add the text between the last character added and the > of the style tag
		strFinal += text.substr(0, tagStart);

		// find the index of the next closing style tag
		tagEnd = text.indexOf("</style>", tagStart);
		// if no closing style tag exists, then the block goes until the end of the text
		if (tagEnd == -1) {
			tagEnd = text.length;
		}

		// grab the text inside the style tag
		strTemp = text.substr(tagStart, tagEnd - tagStart);
		
		// add the Key Word spans
		strTemp = strTemp.replace(reKeyWord, "<span class='css_keyword'>$1</span>(");

		// add the selector spans
		strTemp = strTemp.replace(reSelector, "<span class='css_selector'>$1</span>$2");

		// remove any selector span tags that might have been placed inside the property:value area
		strTemp = strTemp.replace(/\{([^{}]+)<span class='css_selector'>([^{}]+)<\/span>([^{}]+)\}/ig, function(string) {
			return(string.replace(/<span class='css_selector'\s*>([^\/]+)<\/span>/ig, "$1"));
		});

		// add the property spans
		strTemp = strTemp.replace(reProperty, "$1<span class='css_property'>$2</span>$3");
		// add the value spans
		strTemp = strTemp.replace(reValue, ":<span class='css_value'>$1</span>$2");
		// add the px spans
		strTemp = strTemp.replace(reValueUnits, "$1<span class='css_units'>$2</span>");

		// add the new style tag content and the closing style tag
		strFinal += strTemp + "</style>";

		// advance current index to the character after the closing style tag
		text = text.slice(tagEnd + 8);
	}

	return(strFinal);
}

// received the file's content and adds <span> tags for color coding of JS text
function addScriptTags(text) {
	// local variables used to execute this task
	var tagStart = 0;
	var tagEnd = 0;
	var strFinal = new String;
	var strTemp = new String;
	var reFunctionDeclaration = new RegExp("(function[\\t ]+)(\\w+[\\t ]*)\\((.*)\\)([\\t ]*{)", "gi");
	var reKeyWord = new RegExp("([\\w])?(new|while|for|break|continue|try|catch|return|if|else|typeof)([^\\w])", "gi");
	var reMathOperator = new RegExp("([^<])(\\++|\\-+|\\*|\\/)", "gi");
	var reLogicOperator = new RegExp("(&&|\\|\\||!=|={1,3}|&lt;|&gt;)", "gi");
	var reObject = new RegExp("(Object|var|document)", "gi");
	var reValue = new RegExp("(\\d|true|false|null)", "gi");
	var reMethod = new RegExp("\\.(\\w+)", "gi");
	var reString = new RegExp("(\\\"[^\\\"]*\\\")", "i");
	var reRegExp = new RegExp("([^<>])(\\/[^/]+\\/[gmi]*)", "i");

	// loop until we've added all necessary tags
	while (true) {
		// grab the index of the next script tag
		tagStart = text.search(/\<script.*\>/i);

		// if we've reached the end of the text OR there are no more script tags left
		// exit the loop
		if (tagStart == -1) {
			// add any parts of the text not processed at the end
			if (text.length > 0) {
				strFinal += text.substr(0);
			}

			// all the text is processed, so exit the loop and continue code
			break;
		}

		// place the index after the script tag
		tagStart += text.substr(tagStart, text.indexOf(">", tagStart) - tagStart).length + 1;

		// add the text between the last character added and the > of the script tag
		strFinal += text.substr(0, tagStart);

		// find the index of the next closing script tag
		tagEnd = text.indexOf("</script>", tagStart);
		// if no closing script tag exists, then the block goes until the end of the text
		if (tagEnd == -1) {
			tagEnd = text.length;
		}

		// grab the text inside the script tag
		strTemp = text.substr(tagStart, tagEnd - tagStart);

		// add the logic operator spans
		strTemp = strTemp.replace(reLogicOperator, "<span class='js_logicoperator'>$1</span>");
		// add the math operator spans
		strTemp = strTemp.replace(reMathOperator, "$1<span class='js_mathoperator'>$2</span>");
		// add the function declaration spans
		strTemp = strTemp.replace(reFunctionDeclaration, "<span class='js_func_word'>$1</span><span class='js_func_name'>$2</span>(<span class='js_func_param'>$3</span>)$4");
		// add the keyWord spans
		strTemp = strTemp.replace(reKeyWord, "$1<span class='js_keyword'>$2</span>$3");
		// add the object spans
		strTemp = strTemp.replace(reObject, "<span class='js_object'>$1</span>");
		// add the value spans
		strTemp = strTemp.replace(reValue, "<span class='js_value'>$1</span>");
		// add the method spans
		strTemp = strTemp.replace(reMethod, ".<span class='js_method'>$1</span>");

		// remove the math operator span tag from the / with the meaning of start and end of a regexp
		strTemp = strTemp.replace(/<span class='js_mathoperator'\s*>\/<\/span>([^\/]+)<span class='js_mathoperator'\s*>\/<\/span>([gmi]*)/ig, "/$1/$2");

		// if there are any regexp in the script text
		// first remove any of the span tags placed above from text inside regexp
		// then add the regexp spans
		var reMatch = strTemp.match(reRegExp);
		if (reMatch != null) {
			var strAux = new String;
			do {
				strAux += strTemp.substr(0, reMatch.index);
				strAux += strTemp.substr(reMatch.index, reMatch[0].length).replace(reRegExp, function(string){
					return(string.replace(/<span class='js_mathoperator'\s*>([<>]+)<\/span>/ig, "$1").replace(/<span\s+class='(css|js)_\w+'\s*>([^>]*)<\/span>/ig, "$2"));
				}).replace(reRegExp, "$1<span class='js_regexp'>$2</span>");

				strTemp = strTemp.slice(reMatch.index + reMatch[0].length);

				reMatch = strTemp.match(reRegExp);
			} while (reMatch != null)

			strAux += strTemp;
			strTemp = strAux;
		}

		// if there are any strings in the script text
		// first remove any of the span tags placed above from text inside strings
		// then add the string spans
		var reMatch = strTemp.match(reString); // find the 1st match of a string
		if (reMatch != null) {
			var strAux = new String; // auxiliary local variable used to store the cleaned string

			// loop until there are no more strings to process
			do {
				// grab the text before the string (no processing needed)
				strAux += strTemp.substr(0, reMatch.index);

				// for the text inside the string, first remove any other color coding span tags from previous steps
				strAux += strTemp.substr(reMatch.index, reMatch[0].length).replace(reString, function(string){
					// explicitely remove any js_mathoperator span tags that may have been placed around other html tags
					return(string.replace(/<span class='js_mathoperator'\s*>([<>]+)<\/span>/ig, "$1").replace(/<span\s+class='(css|js)_\w+'\s*>([^>]*)<\/span>/ig, "$2"));
				}).replace(reString, "<span class='js_string'>$1</span>");

				// remove the processed text from the non-processed text
				strTemp = strTemp.slice(reMatch.index + reMatch[0].length);

				// determine the next string's data, if any
				reMatch = strTemp.match(reString);
			} while (reMatch != null)

			// add any final characters that don't need to be processed
			strAux += strTemp;
			// store the final string on the original variable
			strTemp = strAux;
		}

		// add the new script tag content and the closing script tag
		strFinal += strTemp + "</script>";

		// advance current index to the character after the closing script tag
		text = text.slice(tagEnd + 9);
	}

	return(strFinal);
}

// pushes the vertical scroll of all existing divs to the bottom
function scrollBoxesToBottom(elemId) {
	if (elemId == null) {
		// grab all the text boxes
		var elems = document.querySelectorAll("div.text");
	}else{
		// grab the text box with elemId
		var elems = [tagDivs[elemId].lastElementChild];
	}

	// loop each one
	for (var i = 0; i < elems.length; i++) {
		// scroll to the bottom of the div
		elems[i].scrollTop = elems[i].scrollHeight;
	}
}

// set the default speeds for the application
function setDefaultSpeeds() {
	speeds = {
		"default": 20,
		"styleByChar": 0,
		"scriptByChar": 0,
		"styleByLine": 100,
		"scriptByLine": 100,
		"textByLine": 100,
		"shortPause": 275,
		"mediumPause": 550,
		"LongPause": 750,
	};
}

// sets the various speed modes
function setSpeed(speedMode) {
	/*
	1 = normal speeds (the ones set by default at the start of the application)
	2 = no pauses, but still writing character by character
	3 = no pauses, no default delay and writing line by line
	*/

	if (speedMode === 1) {
		// set default speeds
		setDefaultSpeeds();

		// reset the max speed variables
		globalSpeed = null;
		globalWriteByLine = false;
	}else if (speedMode === 2) {
		// set pauses to zero
		speeds.shortPause = 0;
		speeds.mediumPause = 0;
		speeds.LongPause = 0;

		// reset the max speed variables
		globalSpeed = null;
		globalWriteByLine = false;
	}else if (speedMode === 3) {
		// force all speeds to zero and write line by line
		globalSpeed = 0;
		globalWriteByLine = true;
	}

	// change the selected speed button in the UI
	var speedButtons = document.querySelectorAll(".speed");
	for (var i = 0; i < speedButtons.length; i++) {
		if (i === speedMode - 1) {
			// this is the selected speed
			speedButtons[i].className = speedButtons[i].className.replace("clickable", "selected").trim();
		}else{
			// this is not the selected speed
			speedButtons[i].className = speedButtons[i].className.replace("selected", "clickable").trim();
		}
	};
}

// pauses the execution of the application
function pauseExec() {
	// if the next iteration of writeToScreen() is pending, remove it
	window.clearTimeout(timeoutId);
	// in case writeToScreen() is already running, let it know it should stop
	isPaused = true;

	// hide the pause button
	document.getElementById("pause_button").className += " hidden";
	// show the resume button
	var tempElem = document.getElementById("resume_button");
	tempElem.className = tempElem.className.replace("hidden", "").trim();

	// unblock mouse events on textboxes
	blockMouseEvents(false);
}

// resumes the execution of the application
function resumeExec() {
	// local variable used to control when to resume writing to screen
	// used to delay it in case textboxes need to be expanded/collapsed after the pause
	var resumeDelay = 0;

	// block mouse events on textboxes
	blockMouseEvents(true);

	// if expand/collapse is in play, resume the state the textboxes were before pause
	if (typeof textboxExpandCollapse == "function") {
		// if need be, grab the currently active CSS transition duration
		if (cssTransitionDur == null) { getTransitionDuration(); }

		// grab all the text boxes
		var elems = document.querySelectorAll("div.content");

		// loop each textbox and change  state, if needed
		for (var i = 0; i < elems.length; i++) {
			// check if this textbox is collapsed
			var matchCollapsed = elems[i].className.match(/content_collapsed/i);

			// if this textbox isn't in the pre-pause state, change it
			if ((matchCollapsed == null && !filesContent[elems[i].id]["expanded"]) || (matchCollapsed != null && filesContent[elems[i].id]["expanded"])) {
				// this textbox is in the wrong state, so change it
				textboxExpandCollapse(elems[i].id, false);

				// if at least 1 textbox has to be changed, delay the start of
				// writing to screen to allow the transtions to finish
				resumeDelay = cssTransitionDur;
			}
		};
	}

	// no longer paused
	isPaused = false;

	// call writeToScreen() to continue where it left off
	// using any necessary delay
	window.setTimeout(function() {
		writeToScreen(curFile, "");
	}, resumeDelay);

	// hide the resume button
	document.getElementById("resume_button").className += " hidden";
	// show the pause button
	var tempElem = document.getElementById("pause_button");
	tempElem.className = tempElem.className.replace("hidden", "").trim();
}

// finds the duration of the CSS transitions in use on the website
// NOTE: must be called after any transitions are set in the style tag
function getTransitionDuration() {
	// regexp to find and grab the duration value and unit
	var re = new RegExp("\\*\\s*\\{[^\\{\\}]+transition\\s*:[^\\{\\}\\d]+([\\d\\.]+)(s|ms)[^\\{\\}]+\\}", "i");

	// find the transition duration value and unit
	if (tagStyle.innerHTML.match(re) != null) {
		// a match was found
		// calculate the duration in milliseconds
		cssTransitionDur = tagStyle.innerHTML.match(re)[1] * (tagStyle.innerHTML.match(re)[2] == "s" ? 1000 : 1);
	}else{
		// there is no transition
		cssTransitionDur = 0;
	}
}

// blocks/unblocks mouse events on all textboxes
function blockMouseEvents(turnOn) {
	if (turnOn) { // if we want to activate the mouse event block
		if (divWorkArea.className.match(/no_events/i) == null) {
			// and it isn't on already, add the class
			divWorkArea.className += " no_events";
		}
	}else{ // we want to turn off the mouse event block
		// remove the class
		divWorkArea.className = divWorkArea.className.replace(/no_events/i, "").trim();
	}
}