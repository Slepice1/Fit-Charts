module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    wiredep: {
      task: {
        // Point to the files that should be updated when
        // you run `grunt wiredep`
        src: [
          'index.html',   // .html support...
        ],
        options: {
          // https://github.com/taptapship/wiredep#configuration
        }
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-wiredep');

  // Default task(s).
  grunt.registerTask('default', ['wiredep']);

};
