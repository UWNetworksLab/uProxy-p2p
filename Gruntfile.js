var path = require("path");
var minimatch = require("minimatch");
var chrome_app_files = [
  'common/ui/icons/**',
  'common/freedom/freedom.js',
  'common/backend/**', 
  '!common/backend/spec/**', 
  '!common/backend/identity/xmpp/node-xmpp/**'
];
var chrome_ext_files = [
  'common/ui/*.html',
  'common/ui/icons/**',
  'common/ui/scripts/**',
  'common/ui/styles/**',
  'common/ui/bower_components/angular/angular.js',
  'common/ui/bower_components/angular-lodash/angular-lodash.js',
  'common/ui/bower_components/angular-mocks/angular-mocks.js',
  'common/ui/bower_components/angular-scenario/*.js',
  'common/ui/bower_components/jquery/jquery.js',
  'common/ui/bower_components/jsonpatch/lib/jsonpatch.js',
  'common/ui/bower_components/lodash/dist/lodash.js'
];
var firefox_files = [];
var sources = ['common/backend/util.js']; //TODO fix
var testSources = sources.slice(0);       //TODO fix

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    copy: {
      chrome_app: {files: [{src: chrome_app_files, dest: 'chrome/app/'}]},
      chrome_ext: {files: [{src: chrome_ext_files, dest: 'chrome/extension/src/'}]},
      firefox: {files: [{src: firefox_files, dest: 'firefox/data/'}]},
      watch: {files: []},
    },
    watch: {
      files: ['common/**/*'], //TODO this doesn't work as expected.
      tasks: ['copy:watch'],
      options: {spawn: false}
    },
    shell: {
      git_submodule: {
        command: ['git submodule init', 'git submodule update'].join(';'),
        options: {stdout: true}
      },
      bower_install: {
        command: 'bower install',
        options: {stdout: true, execOptions: {cwd: 'common/ui'}}
      },
      setup_freedom: {
        command: 'npm install',
        options: {stdout: true, execOptions: {cwd: 'common/freedom'}}
      },
      freedom: {
        command: 'grunt',
        options: {stdout: true, execOptions: {cwd: 'common/freedom'}}
      },
    },
    clean: ['chrome/app/common/**', 'chrome/extension/src/common/**', 'firefox/data/common/**'],
    jasmine: {
      common: {
        src: testSources,
        options: {
          specs: 'common/backend/spec/*Spec.js'
        }
      }
    },
    jshint: {
      all: sources,
      options: {
        '-W069': true
      }
    }

  });
  
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');

  grunt.event.on('watch', function(action, filepath, target) {
    grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
    var files = [];
    if (minimatchArray(filepath, chrome_app_files)) {
      grunt.log.writeln(filepath + ' - watch copying to Chrome app');
      files.push({src: filepath, dest: 'chrome/app/'});
    } 
    if (minimatchArray(filepath, chrome_ext_files)) {
      grunt.log.writeln(filepath + ' - watch copying to Chrome ext');
      files.push({src: filepath, dest: 'chrome/extension/src/'});
    }
    if (minimatchArray(filepath, firefox_files)) {
      grunt.log.writeln(filepath + ' - watch copying to Firefox');
      files.push({src: filepath, dest: 'firefox/data/'});
    }
    grunt.config(['copy', 'watch', 'files'], files);
    grunt.log.writeln("copy:watch is now: " + JSON.stringify(grunt.config(['copy', 'watch'])));
  });

  grunt.registerTask('setup', [
    'shell:git_submodule', 
    'shell:bower_install',
    'shell:setup_freedom',
    'shell:freedom'
  ]);
  grunt.registerTask('test', [
    'jshint:all',
    'jasmine'
  ]);
  grunt.registerTask('build', [
    'copy:chrome_app',
    'copy:chrome_ext'
  ]);
  grunt.registerTask('everything' ['setup', 'test', 'build']);
  // Default task(s).
  grunt.registerTask('default', ['build']);
 
};

function minimatchArray(file, arr) {
  var result = false;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].substr(0, 1) == "!") {
      result &= minimatch(file, arr[i]);
    } else {
      result |= minimatch(file, arr[i]);
    }
  }
  return result;
};

