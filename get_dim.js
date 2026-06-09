const fs = require('fs');
const sizeOf = require('image-size');
const dimensions = sizeOf('public/assets/logo-atelier-optica.png');
console.log(dimensions.width, dimensions.height);
