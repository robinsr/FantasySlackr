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
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha');
  grunt.registerTask('test', ['jshint', 'mocha']);

  grunt.registerTask('default', ['jshint']);

};