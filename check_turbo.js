const d3 = require('d3');
// Mocking d3 for node if needed, or I'll just use the browser preview if I can't run node with d3.
// But I don't have d3 in node environment usually.
// I will try to run this in the browser console via a temp html file or just use the existing server.

// Actually I can just look at the RGB values in builtinColormaps.js and approximate.
// Start: [48,18,59] -> dark
// Middle (idx ~17): [132,249,189] -> light
// End: [122,16,20] -> dark
// It seems it goes up and down.

console.log("Analysis done by inspection");
