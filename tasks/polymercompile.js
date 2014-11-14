'use strict';

module.exports = function (grunt) {
  var fs = require('fs-extra');
  var glob = require('glob');
  var pkg = require('../package.json');

  grunt.registerMultiTask('polymerPaperCompile', pkg.description, function() {
    // Get src_dir and dest_dir directories from options, add trailing /
    // if needed.
    var options = this.options({});
    var destDir = options.dest_dir;
    if (destDir.charAt(destDir.length - 1) != '/') {
      destDir += '/';
    }
    var srcDir = options.src_dir;
    if (srcDir.charAt(srcDir.length - 1) != '/') {
      srcDir += '/';
    }

    // Process all paper (Material Design) elements from srcDir.
    var files = getFiles(srcDir + '/paper-*/paper-*.html');
    for (var i = 0; i < files.length; i++) {
      var inputHtmlFilename = files[i];
      processFile(inputHtmlFilename, srcDir, destDir);
    }

    grunt.log.writeln(
        'polymerPaperCompile: processed ' + files.length + ' files');
  });

  // Returns an array of file names matching filePattern.
  function getFiles(filePattern) {
    var out = [];
    if (filePattern instanceof Array) {
      filePattern.forEach(function(spec) {
        out = out.concat(getFiles(spec));
      });
    } else if (filePattern.path) {
      out = glob.sync(filePattern.path).map(function(path) {
        return {
          path: path,
          include: filePattern.include,
          name: filePattern.name || path
        }
      });
    } else {
      out = glob.sync(filePattern);
    }
    return out;
  }

  function parseHtml(originalHtml) {
    // This assumes only 1 <script> tag per html file, and also
    // no comments including </script>
    var startIndex = originalHtml.indexOf('<script>') + '<script>'.length;
    var endIndex = originalHtml.indexOf('</script>');
    return {
      scriptContents: originalHtml.substr(startIndex, endIndex - startIndex),
      startIndex: startIndex,
      endIndex: endIndex
    };
  }

  function getDestDir(inputHtmlFilename, srcDir, destParentDir) {
    // Figure out the subDir, e.g. if srcDir is third_party/lib/ and the
    // inputHtmlFilename is third_party/lib/paper-button/paper-button-base.html
    // then the subDir should be paper-button
    var subDir = inputHtmlFilename.substr(srcDir.length);
    subDir = subDir.substr(0, subDir.lastIndexOf('/'));
    return destParentDir + subDir;
  }

  // Get filenamePrefix, e.g. third_party/lib/paper-button/paper-button.html
  // should become paper-button
  function getFilenamePrefix(inputHtmlFilename) {
    var filenamePrefix =
        inputHtmlFilename.substr(inputHtmlFilename.lastIndexOf('/') + 1);
    return filenamePrefix.substr(0, filenamePrefix.length - '.html'.length);
  }

  function processFile(inputHtmlFilename, srcDir, destParentDir) {
    // Read original file and get script contents
    var originalHtml = fs.readFileSync(inputHtmlFilename).toString();
    var htmlData = parseHtml(originalHtml);

    // Create destination dir, e.g.
    // build/dev/chrome/extension/lib/paper-tabs
    var destDir = getDestDir(inputHtmlFilename, srcDir, destParentDir);
    fs.mkdirpSync(destDir);

    // Construct output filenames
    var filenamePrefix = getFilenamePrefix(inputHtmlFilename);
    var outputHtmlFilename = destDir + '/' + filenamePrefix + '.html';
    var outputJsFilename = destDir + '/' + filenamePrefix + '.js';

    if (!htmlData.scriptContents) {
      // HTML files with no inline scripts should be copied to destDir.
      fs.copySync(inputHtmlFilename, outputHtmlFilename);
      return;
    }

    // Create new html
    var newHtml = originalHtml.substr(0, htmlData.startIndex - 1) + ' src="' +
        filenamePrefix + '.js">' + originalHtml.substr(htmlData.endIndex);
    var buffer = new Buffer(newHtml);
    var fd = fs.openSync(outputHtmlFilename, 'w');
    fs.writeSync(fd, buffer, 0, buffer.length, null);

    // Create new JS file
    buffer = new Buffer(htmlData.scriptContents);
    var fd = fs.openSync(outputJsFilename, 'w');
    fs.writeSync(fd, buffer, 0, buffer.length, null);
  }

};
