/* jshint curly: true, eqeqeq: true, immed: true, indent: 4, latedef: true, noarg: true, nonbsp: true, nonew: true, undef: true, eqnull: true, node: true */

"use strict";

var fs      = require("fs");
var path    = require("path");
var watch   = require("watch");
var pug    = require("pug");

var dir = path.join(__dirname, '../views/');

var pugGenerated = {};

function generatePug() {
  fs.readdir(dir, function(err, files) {
    if(err) { throw err; }
    function parseFile() {
      var file = files.pop();
      fs.stat(dir+file, function(err, stats) {
        if(!err) {
          if(stats.isFile()) {
            pugGenerated[file] = pug.compileFile(dir+file, {pretty: true});
          }
        } else {
          console.error("Failed generating pug function!");
          console.error(err);
          console.trace();
        }
        if(files.length > 0) {
          parseFile();
        }
      });
    }
    if(files.length > 0) {
      parseFile();
    }
  });
}

generatePug();

watch.watchTree(dir, function (f, curr, prev) {
  if(typeof f === "object" && prev === null && curr === null) {
    // Finished walking the tree
  } else if(prev === null) {
    // f is a new file
  } else if(curr.nlink === 0) {
    // f was removed
  } else {
    // f was changed
    generatePug();
  }
});


exports.run = pugGenerated;
