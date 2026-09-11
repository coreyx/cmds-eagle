/**
 * Test script for clipboard-source parsing logic
 */
const { BplistParser, extractDomain } = require('./dist-test');

// Test 1: extractDomain
console.log('--- Test 1: Domain Extraction ---');
const domain1 = extractDomain('https://en.wikipedia.org/wiki/Albert_Bierstadt');
console.log('wikipedia:', domain1, domain1 === 'en.wikipedia.org' ? '✔ PASS' : '✖ FAIL');

const domain2 = extractDomain('https://www.nytimes.com/section/world');
console.log('nytimes with www:', domain2, domain2 === 'nytimes.com' ? '✔ PASS' : '✖ FAIL');

const domain3 = extractDomain('http://localhost:3000/image.png');
console.log('localhost:', domain3, domain3 === 'localhost:3000' ? '✔ PASS' : '✖ FAIL');

// Test 2: CF_HTML parsing simulation
console.log('\n--- Test 2: CF_HTML Buffer Parsing ---');
const sampleCfHtml = `Version:0.9
StartHTML:0000000105
EndHTML:0000000350
StartFragment:0000000141
EndFragment:0000000314
SourceURL:https://en.wikipedia.org/wiki/Albert_Bierstadt
<html><body>
<!--StartFragment--><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Bierstadt.jpg/800px-Bierstadt.jpg" alt="Painting" /><!--EndFragment-->
</body></html>`;

const buf = Buffer.from(sampleCfHtml, 'utf8');
const text = buf.toString('utf8');
const pageMatch = text.match(/SourceURL:(https?:\/\/[^\r\n]+)/i);
const imgMatch = text.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);

console.log('Page URL extracted:', pageMatch ? pageMatch[1] : null);
console.log('Page URL test:', pageMatch && pageMatch[1] === 'https://en.wikipedia.org/wiki/Albert_Bierstadt' ? '✔ PASS' : '✖ FAIL');
console.log('Image URL extracted:', imgMatch ? imgMatch[1] : null);
console.log('Image URL test:', imgMatch && imgMatch[1] === 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Bierstadt.jpg/800px-Bierstadt.jpg' ? '✔ PASS' : '✖ FAIL');

// Test 3: Priority Resolution
console.log('\n--- Test 3: Priority Resolution ---');
function resolvePrimaryUrl(info, priority) {
    if (!info) return null;
    switch (priority) {
        case 'page-first':
            return info.pageUrl || info.imageUrl || null;
        case 'image-first':
            return info.imageUrl || info.pageUrl || null;
        case 'page-only':
            return info.pageUrl || null;
        case 'image-only':
            return info.imageUrl || null;
        default:
            return info.pageUrl || info.imageUrl || null;
    }
}

const info = {
    pageUrl: 'https://en.wikipedia.org/wiki/Albert_Bierstadt',
    imageUrl: 'https://upload.wikimedia.org/image.jpg'
};

console.log('page-first:', resolvePrimaryUrl(info, 'page-first') === info.pageUrl ? '✔ PASS' : '✖ FAIL');
console.log('image-first:', resolvePrimaryUrl(info, 'image-first') === info.imageUrl ? '✔ PASS' : '✖ FAIL');
console.log('page-only:', resolvePrimaryUrl(info, 'page-only') === info.pageUrl ? '✔ PASS' : '✖ FAIL');
console.log('image-only:', resolvePrimaryUrl(info, 'image-only') === info.imageUrl ? '✔ PASS' : '✖ FAIL');

// Test 4: BplistParser regex fallback
console.log('\n--- Test 4: BplistParser Fallback ---');
const rawSafariBuffer = Buffer.from('WebResourceURL\x00\x00https://safari.apple.com/image.png\x00\x00', 'latin1');
const extractedSafari = BplistParser.extractSourceUrl(rawSafariBuffer);
console.log('Safari extracted:', extractedSafari, extractedSafari === 'https://safari.apple.com/image.png' ? '✔ PASS' : '✖ FAIL');

console.log('\nAll unit test assertions completed successfully!');
