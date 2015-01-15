// Naming this `exports` is a trick to allow this file to be compiled normally
// and still used by commonjs-style require.
module exports {

  // Compiles a module's source files, excluding tests and declarations.
  // The files must already be available under build/.
  export function typescriptSrc(name:string) {
    return {
      src: [
        'build/' + name + '/**/*.ts',
        '!**/*.spec.ts',
        '!**/*.d.ts',
      ],
      options: {
        sourceRoot: 'build/',
        target: 'es5',
        comments: false,
        noImplicitAny: true,
        sourceMap: true,
        declaration: false,
        fast: 'always',
      }
    };
  }

  // Compiles a module's tests and declarations, in order to
  // help test that declarations match their implementation.
  // The files must already be available under build/.
  export function typescriptSpecDecl(name:string) {
    return {
      src: [
        'build/' + name + '/**/*.spec.ts',
        'build/' + name + '/**/*.d.ts',
      ],
      options: {
        sourceRoot: 'build/',
        target: 'es5',
        comments: false,
        noImplicitAny: true,
        sourceMap: true,
        declaration: false,
        fast: 'always',
      }
    };
  }

  // Copies a module's directory from build/ to dist/.
  // Test-related files are excluded.
  export function copyModuleToDist(name:string) {
    return {
      expand: true,
      cwd: 'build/',
      src: [
        name + '/**',
        '!**/*.spec.*'
      ],
      dest: 'dist/',
      onlyIf: 'modified',
    };
  }

  // Copies build/* to a sample's directory under dist/.
  // The samples directory itself and TypeScript files are excluded.
  // TODO: copy dist/* instead
  export function copyDistLibsToSampleDir(name:string) {
    return {
      files: [
        {
          expand: true,
          cwd: 'build/',
          src: [
            '**',
            '!samples/**',
            '!**/*.ts',
          ],
          dest: 'dist/' + name + '/lib/',
          onlyIf: 'modified',
        }
      ]
    };
  }

  // Function to make jasmine spec assuming expected dir layout.
  export function jasmineSpec(name:string) {
    var jasmine_helpers = [
        // Help Jasmine's PhantomJS understand promises.
        'node_modules/es6-promise/dist/promise-*.js',
        '!node_modules/es6-promise/dist/promise-*amd.js',
        '!node_modules/es6-promise/dist/promise-*.min.js',
        'node_modules/arraybuffer-slice/index.js'
      ];
    return {
      src: jasmine_helpers.concat([
        'build/' + name + '/**/*.js',
        '!build/' + name + '/**/*.spec.js'
      ]),
      options: {
        specs: 'build/' + name + '/**/*.spec.js',
        outfile: 'build/' + name + '/SpecRunner.html',
        keepRunner: true
      }
    };
  }

}  // module Rules
