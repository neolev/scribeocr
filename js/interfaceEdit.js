
// File summary:
// Functions called by the buttons in the "Edit" tab (used for editing words).
// Most operations (change size/font/etc.) have 2 functions:
// one function to edit the canvas, and another to edit the underlying HOCR data.

import { calcWordMetrics } from "./textUtils.js"
import { renderPageQueue } from "../main.js"
import ocr from "./ocrObjects.js";


export function deleteSelectedWords(){
  const selectedObjects = window.canvas.getActiveObjects();
  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordIDI = selectedObjects[i].wordID;
    ocr.deletePageWord(globalThis.hocrCurrent[currentPage.n], wordIDI);
    window.canvas.remove(selectedObjects[i]);
    canvas.renderAll();
  }
}

export async function changeWordFontStyle(style){
  style = style.toLowerCase()

  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length == 0) return;

  // If first word style already matches target style, disable the style.
  const enable = selectedObjects[0].fontStyle.toLowerCase() == style || style == "small-caps" && /small caps$/i.test(selectedObjects[0].fontFamily) ? false : true;
  const newValueStr = enable ? style : "normal";

  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;

    const wordObj = ocr.getPageWord(globalThis.hocrCurrent[currentPage.n], wordIDI);

    if (!wordObj) {
      console.warn("Canvas element contains ID" + wordIDI + "that does not exist in OCR data.  Skipping word.");
      continue;
    }

    wordObj.style = newValueStr;

    wordI.fontStyleLookup = newValueStr;

    if(enable && style == "small-caps"){
        wordI.fontFamily = wordI.fontFamily.replace(/\s+small caps$/i, "") + " Small Caps";
        wordI.fontStyle = "normal";
    } else {
        wordI.fontFamily = wordI.fontFamily.replace(/\s+small caps$/i, "");
        wordI.fontStyle = newValueStr;
    }

    await updateWordCanvas(wordI);

  }
  window.canvas.renderAll();
}

export async function changeWordFontSize(fontSize){

  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length == 0) return;
  if(fontSize == "plus"){
    fontSize = parseFloat(selectedObjects[0].fontSize) + 1;
  } else if(fontSize == "minus"){
    fontSize = parseFloat(selectedObjects[0].fontSize) - 1;
  }

  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){

    const wordI = selectedObjects[i];

    // If multiple words are selected, the change in font size only applies to the non-superscript words.
    // Without this behavior, selecting a large area and standardizing the font size would result in
    // the superscripted text becoming the same size as the non-superscript text. 
    if (selectedN > 1 && wordI.wordSup) continue;

    const wordIDI = wordI.wordID;

    const wordObj = ocr.getPageWord(globalThis.hocrCurrent[currentPage.n], wordIDI);

    if (!wordObj) {
      console.warn("Canvas element contains ID" + wordIDI + "that does not exist in OCR data.  Skipping word.");
      continue;
    }

    wordObj.size = fontSize;

    document.getElementById("fontSize").value = fontSize;
    wordI.fontSize = fontSize;

    await updateWordCanvas(wordI);

  }
  window.canvas.renderAll();
}

export async function changeWordFontFamily(fontName){
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects) return;
  let fontNameCanvas = fontName == "Default" ? globalSettings.defaultFont : fontName;
  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;
    fontNameCanvas = /Small Caps$/.test(wordI.fontFamily) ? fontName + " Small Caps" : fontName;

    const wordObj = ocr.getPageWord(globalThis.hocrCurrent[currentPage.n], wordIDI);

    if (!wordObj) {
      console.warn("Canvas element contains ID" + wordIDI + "that does not exist in OCR data.  Skipping word.");
      continue;
    }

    if (fontName === "Default") {
      wordObj.font = null;
    } else {
      wordObj.font = fontName;
    }

    wordI.fontFamily = fontNameCanvas;
    wordI.defaultFontFamily = fontName == "Default" ? true : false;
    wordI.fontFamilyLookup = fontName,

    await updateWordCanvas(wordI);

  }
  window.canvas.renderAll();
}


// Update word textbox on canvas following changes. 
// Whenever a user edits a word in any way (including content and font/style), 
// the position and character spacing need to be re-calculated so they still overlay with the background image. 
export async function updateWordCanvas(wordI) {

  // 1. Re-calculate left position given potentially new left bearing
  const wordMetrics = await calcWordMetrics(wordI.text, wordI.fontFamilyLookup, wordI.fontSize, wordI.fontStyleLookup);

  // When the user selects multiple words at the same time, the coordinates becomes relative to the "group"
  const groupOffsetLeft = wordI?.group?.ownMatrixCache?.value[4] || 0;

  wordI.left = wordI.visualLeft - wordMetrics["leftSideBearing"] - groupOffsetLeft;

  // 2. Re-calculate character spacing (if the word has multiple letters)
  if(wordI.text.length > 1){
    const visualWidthNew = wordMetrics["visualWidth"];
    const kerning = (wordI.visualWidth - visualWidthNew) / (wordI.text.length - 1);
    wordI.charSpacing = kerning * 1000 / wordI.fontSize;
  }

}


export function toggleSuperSelectedWords(){
  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length == 0) return;
  const selectedN = selectedObjects.length;
  for(let i=0; i<selectedN; i++){
    const wordI = selectedObjects[i];
    const wordIDI = wordI.wordID;

    const wordObj = ocr.getPageWord(globalThis.hocrCurrent[currentPage.n], wordIDI);

    if (!wordObj) {
      console.warn("Canvas element contains ID" + wordIDI + "that does not exist in OCR data.  Skipping word.");
      continue;
    }

    wordI.wordSup = !wordI.wordSup;

  }

  renderPageQueue(currentPage.n);
}

var objectsLine;
export function adjustBaseline(){

  const selectedObjects = window.canvas.getActiveObjects();
  if (!selectedObjects || selectedObjects.length == 0) return;

  // For some reason the text jumps around the page when >1 word is selected
  window.canvas.setActiveObject(selectedObjects[0]);

  document.getElementById("rangeBaseline").value = 100 + selectedObjects[0].baselineAdj;
  window.bsCollapse.show();

  const lineI = selectedObjects[0].line;
  objectsLine = canvas.getObjects().filter(x => x["line"] == lineI);

  for(let i=0;i<objectsLine.length;i++){
    objectsLine[i].objectCaching = true;
    objectsLine[i].ownCaching = true;
    objectsLine[i].renderCache()
  }

}

/**
 * Visually moves the selected line's baseline on the canvas.
 * Called when user is actively dragging the adjust baseline slider. 
 * 
 * @param {string | number} value - New baseline value.
 */
export function adjustBaselineRange(value){
  for(let i=0;i<objectsLine.length;i++){
    const objectI = objectsLine[i];
    objectI.set('top', objectI.topOrig + (parseInt(value) - 100));
  }

  window.canvas.requestRenderAll();

}

/**
 * Adjusts the selected line's baseline in the canvas object and underlying OCR data.
 * Called after user releases adjust baseline slider.
 * 
 * @param {string | number} value - New baseline value.
 */
export function adjustBaselineRangeChange(value){

  value = parseInt(value) - 100;
  let valueChange = value - objectsLine[0].baselineAdj;

  for(let i=0;i<objectsLine.length;i++){
    const wordI = objectsLine[i];
    const wordIDI = wordI.wordID;

    wordI.set('baselineAdj', value);

    const wordObj = ocr.getPageWord(globalThis.hocrCurrent[currentPage.n], wordIDI);

    if (!wordObj) {
      console.warn("Canvas element contains ID" + wordIDI + "that does not exist in OCR data.  Skipping word.");
      continue;
    }

    // Adjust baseline offset for line
    if (i === 0) {
      wordObj.line.baseline[1] = wordObj.line.baseline[1] + valueChange;
    }

  }
}
