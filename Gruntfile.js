module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    
    jshint: {
      files: ['src/**/*.js','test/**/*.js','!src/public/**/*.js', '!src/models/backlog/**/*.js'],
      options: {
        // options here to override JSHint defaults
        globals: {
          jQuery: true,
          console: true,
          module: true,
          document: true
        },
        expr: true,
        evil: true
      }
    },
    concat: {
      dist: {
        src: [
        'node_modules/async/lib/async.js',
        'src/public/src/js/jquery-1.8.3.min.js',
        'src/public/src/js/knockout_full.js',
        'src/public/src/js/utils.js',
        'src/public/src/js/models/*.js',
        'src/public/src/js/bindings/*.js',
        'src/public/src/js/viewmodel.js'
        ],
        dest: 'src/public/dist/js/bundle.js'
      }
    },
    uglify: {
      dist: {
        files: {
          'src/public/dist/js/bundle.min.js': ['src/public/dist/js/bundle.js']
        }
      }
    },
    sass: {

    },
    cssmin: {

    },
    watch: {
      files: [
        'src/public/src/js/*.js'
      ],
      tasks: ['concat']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-mocha');
  grunt.registerTask('test', ['jshint', 'mocha']);

  grunt.registerTask('default', ['jshint','concat','uglify']);

};