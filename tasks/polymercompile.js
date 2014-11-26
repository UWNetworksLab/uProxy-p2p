'use strict';

module.exports = function (grunt) {
  var fs = require('fs-extra');
  var pkg = require('../package.json');

  grunt.registerMultiTask('polymerPaperCompile', pkg.description, function() {
    for (var i = 0; i < this.files.length; i++) {
      // Get src files.
      var srcFiles = this.files[i].src;

      // Add trailing / to destDir if needed
      var destDir = this.files[i].dest;
      if (destDir.charAt(destDir.length - 1) != '/') {
        destDir += '/';
      }

      for (var j = 0; j < srcFiles.length; j++) {
        var inputHtmlFilename = srcFiles[j];
        processFile(inputHtmlFilename, destDir);
      }

      grunt.log.writeln(
          'polymerPaperCompile: processed ' + srcFiles.length + ' files');
    }
  });

  function removeComments(originalHtml) {
    var startIndex = originalHtml.indexOf('<!--');
    if (startIndex < 0) {
      return originalHtml;
    }
    var endIndex = originalHtml.indexOf('-->');
    if (endIndex < 0) {
      grunt.log.error('File has invalid comment.');
    }
    endIndex += '-->'.length;
    return removeComments(originalHtml.substr(0, startIndex) +
        originalHtml.substr(endIndex, originalHtml.length-endIndex));
  }

  /**
    * Takes an HTML page and returns it as an array of objects, each with
    * the contents of a <script> tag and the HTML preceding that tag.
    *
    * e.g. parseHtml('abc<script>123</script>def<script>456</script>ghi')
    * returns
    * [{scriptContents: '123', precedingHtml: 'abc'},
    *  {scriptContents: '456', precedingHtml: 'def'},
    *  {scriptContents: '', precedingHtml: 'ghi'}]
    */
  function parseHtml(originalHtml) {
    var startIndex = originalHtml.indexOf('<script>');
    if (startIndex < 0) {
      return [{scriptContents: '',
              precedingHtml: originalHtml}];
    }
    startIndex += '<script>'.length;
    var endIndex = originalHtml.indexOf('</script>');
    if (endIndex < 0) {
      grunt.log.error('File has invalid script.');
    }
    var nextScript = {
      scriptContents: originalHtml.substr(startIndex, endIndex - startIndex),
      precedingHtml: originalHtml.substr(0, startIndex - '<script>'.length)
    };

    var moreScripts = parseHtml(originalHtml.substr(endIndex + '</script>'.length));
    return [nextScript].concat(moreScripts);
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
    // Create destination dir, e.g.
    // build/dev/chrome/extension/lib/paper-tabs
    var destDir = getDestDir(inputHtmlFilename, destParentDir);
    fs.mkdirpSync(destDir);

    // Construct output filenames
    var filenamePrefix = getFilenamePrefix(inputHtmlFilename);
    var outputHtmlFilename = destDir + '/' + filenamePrefix + '.html';
    var outputJsFilename = destDir + '/' + filenamePrefix + '.js';

    // Read original file and get script contents
    var originalHtml = fs.readFileSync(inputHtmlFilename).toString();

    var htmlWithoutComments = removeComments(originalHtml);
    var htmlData = parseHtml(htmlWithoutComments);

    if (!htmlData || htmlData[0].scriptContents === '') {
      // HTML files with no inline scripts should be copied to destDir.
      fs.copySync(inputHtmlFilename, outputHtmlFilename);
      return;
    }

    // Create new JavaScript and HTML files.

    // Insert the new script's source tag where the first <script>
    // tag was found, i.e. right after htmlData[0].precedingHtml
    var newHtml = htmlData[0].precedingHtml +
        '<script src="' + filenamePrefix + '.js"></script>';
    var newJs = htmlData[0].scriptContents;

    for (var i = 1; i < htmlData.length; ++i){
      newHtml += htmlData[i].precedingHtml;
      newJs += htmlData[i].scriptContents;
    }

    var buffer = new Buffer(newHtml);
    var fd = fs.openSync(outputHtmlFilename, 'w');
    fs.writeSync(fd, buffer, 0, buffer.length, null);

    // Create new JS file
    buffer = new Buffer(newJs);
    var fd = fs.openSync(outputJsFilename, 'w');
    fs.writeSync(fd, buffer, 0, buffer.length, null);
  }

};
