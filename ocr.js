const Tesseract = require('tesseract.js');

async function test() {
    console.log('Reading image 1...');
    const result1 = await Tesseract.recognize('C:/Users/pisan/.gemini/antigravity/brain/54ddca54-fd3c-41e2-a3f4-2299af601449/media__1776900601578.png', 'spa');
    console.log(result1.data.text);
    
    console.log('Reading image 2...');
    const result2 = await Tesseract.recognize('C:/Users/pisan/.gemini/antigravity/brain/54ddca54-fd3c-41e2-a3f4-2299af601449/media__1776900608662.png', 'spa');
    console.log(result2.data.text);
}
test();
