'use strict';

module.exports = function (grunt) {
  var fs = require('fs-extra');
  var pkg = require('../package.json');

  grunt.registerMultiTask('polymerPaperCompile', pkg.description, function() {
    // Get src files.
    var srcFiles = this.files[0].src;

    // Add trailing / to destDir if needed
    var destDir = this.files[0].dest;
    if (destDir.charAt(destDir.length - 1) != '/') {
      destDir += '/';
    }

    for (var i = 0; i < srcFiles.length; i++) {
      var inputHtmlFilename = srcFiles[i];
      processFile(inputHtmlFilename, destDir);
    }

    grunt.log.writeln(
        'polymerPaperCompile: processed ' + srcFiles.length + ' files');
  });

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

  function getDestDir(inputHtmlFilename, destParentDir) {
    // Figure out the subDir, e.g. if inputHtmlFilename is
    // third_party/lib/paper-button/paper-button-base.html
    // then the subDir should be paper-button.
    var subDir = inputHtmlFilename.match(/([^\/]*)\/[^\/]*$/)[1];
    return destParentDir + subDir;
  }

  // Get filenamePrefix, e.g. third_party/lib/paper-button/paper-button.html
  // should become paper-button
  function getFilenamePrefix(inputHtmlFilename) {
    var filenamePrefix =
        inputHtmlFilename.substr(inputHtmlFilename.lastIndexOf('/') + 1);
    return filenamePrefix.substr(0, filenamePrefix.length - '.html'.length);
  }

  function processFile(inputHtmlFilename, destParentDir) {
    // Read original file and get script contents
    var originalHtml = fs.readFileSync(inputHtmlFilename).toString();
    var htmlData = parseHtml(originalHtml);

    // Create destination dir, e.g.
    // build/dev/chrome/extension/lib/paper-tabs
    var destDir = getDestDir(inputHtmlFilename, destParentDir);
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
