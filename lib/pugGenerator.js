
"use strict";

var fs      = require("fs");
var path    = require("path");
var watch   = require("watch");
var pug    = require("pug");

module.exports = function(config) {
  var dir = path.join(__dirname, config.pug.viewDir);

  var pugGenerated = {};

  function generatePug() {
    fs.readdir(dir, function(err, files) {
      if(err) { throw err; }
      function parseFile() {
        var file = files.pop();
        fs.stat(dir+file, function(err, stats) {
          if(!err) {
            if(stats.isFile()) {
              pugGenerated[file] = pug.compileFile(dir+file, {pretty: (typeof config.pug.pretty === 'boolean' ? config.pug.pretty : true)});
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

  return {run: pugGenerated};
};
