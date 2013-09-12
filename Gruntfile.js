path = require("path");
var sources = ['common/backend/util.js'];
var testSources = sources.slice(0);

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    copy: {
      chrome_app: {
        files: [
          {src: 'common/ui/icons/**', dest: 'chrome/app/'},
          {src: 'common/backend/client/**', dest: 'chrome/app/'},
          {src: 'common/backend/identity/**', dest: 'chrome/app/'},
          {src: 'common/backend/server/**', dest: 'chrome/app/'},
          {src: 'common/backend/storage/**', dest: 'chrome/app/'},
          {src: 'common/backend/transport/**', dest: 'chrome/app/'},
          {src: 'common/backend/*.js', dest: 'chrome/app/'},
          {src: 'common/backend/*.json', dest: 'chrome/app/'},
          {src: 'common/freedom/freedom.js', dest: 'chrome/app/'}
        ]
      },
      chrome_ext: {
        files: [
	        {src:'common/ui/**', dest:'chrome/extension/src/'},
	        {src:'common/bower_components/**', dest:'chrome/extension/src/'}
        ]
		  },
      firefox: {}
    },
    shell: {
      git_submodule: {
        command: ['git submodule init', 'git submodule update'].join(';'),
        options: {stdout: true}
      },
      bower_install: {
        command: 'bower install',
        options: {execOptions: {cwd: 'common'}}
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
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('setup', [
    'shell:git_submodule', 
    'shell:bower_install', 
    'shell:freedom'
  ]);
  grunt.registerTask('test', [
    'jshint:all',
    'jasmine'
  ]);
  grunt.registerTask('run', [
    'copy:chrome_app',
    'copy:chrome_ext'
  ]);
  grunt.registerTask('everything' ['setup', 'test', 'run']);
  // Default task(s).
  grunt.registerTask('default', ['run']);
 
};
