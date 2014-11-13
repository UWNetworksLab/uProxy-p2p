'use strict';

module.exports = function (grunt) {
  // var selenium = require('selenium-standalone');
  // var http = require('http');
  // var driver = require('wd').promiseChainRemote();
  // var path = require('path');
  // var async = require('async');
  var fs = require('fs-extra');
  var glob = require('glob');
  var pkg = require('../package.json');
 
  grunt.registerMultiTask('polymercompile', pkg.description, function() {
    var options = this.options({});
    var files = getFiles(options.files);

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      grunt.log.writeln('Reading: ' + f);
    }

    // reading
    //grunt.log.write('reading: ' + fs.readFileSync('testoutput'));

    // writing
    // var buffer = new Buffer('some text!!!!');
    // var fd = fs.openSync('testoutput', 'w');
    // fs.writeSync(fd, buffer, 0, buffer.length, null);
  });
  
  function getFiles(specs) {
    var out = [];
    if (specs instanceof Array) {
      specs.forEach(function(spec) {
        out = out.concat(getFiles(spec));
      });
    } else if (specs.path) {
      out = glob.sync(specs.path).map(function(path) {
        return {
          path: path,
          include: specs.include,
          name: specs.name || path
        }
      });
    } else {
      out = glob.sync(specs);
    }
    return out;
  }

};