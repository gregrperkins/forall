module.exports = function(grunt) {
    grunt.initConfig({
        simplemocha: {
            all: {
                src: "test.js",
                options: {
                    reporter: 'spec',
                    timeout: 5000
                }
            }
        },

        watch: {
            allTests: {
                files: ['lib/*', 'test/*'],
                tasks: ['test']
            }
        }
    });

    grunt.loadNpmTasks('grunt-simple-mocha');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('test', 'simplemocha');
    grunt.registerTask('default', 'test');
    grunt.registerTask('tdd', ['test', 'watch']);
};
