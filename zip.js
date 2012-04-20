var exec = require("child_process").exec;

module.exports.zipUpAFolder = function (zipFile, directory, callback) {
    var command = 'zip -r -0 -q "' + zipFile + '" "' + directory + '"';
    
    exec(command, function (err, stdout, stderr) {
        if (err || stderr) return callback(err || stderr);
        
        callback(null, zipFile);
    });
};