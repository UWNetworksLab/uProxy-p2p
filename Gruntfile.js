path = require("path");
var chrome_app_files = [
  {src: 'common/ui/icons/**', dest: 'chrome/app/'},
  {src: [
    'common/backend/**', 
    '!common/backend/spec/**', 
    '!common/backend/identity/xmpp/node-xmpp/**'
    ], dest: 'chrome/app/'},
  {src: 'common/freedom/freedom.js', dest: 'chrome/app/'}
];
var chrome_ext_files = [
  {src:'common/ui/**', dest:'chrome/extension/src/'},
  {src:'common/bower_components/**', dest:'chrome/extension/src/'}
];
var firefox_files = [];
var sources = ['common/backend/util.js']; //TODO fix
var testSources = sources.slice(0);       //TODO fix

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    copy: {
      chrome_app: {files: chrome_app_files},
      chrome_ext: {files: chrome_ext_files},
      firefox: {files: firefox_files},
      watch: {files: []},
    },
    watch: {
      all: {
        files: ['common/**'],
        task: ['copy:watch'],
        options: {spawn: false}
      }
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
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');

  grunt.event.on('watch', function(action, filepath, target) {
    //grunt.config(['copy', 'watch', 'files'], );
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
