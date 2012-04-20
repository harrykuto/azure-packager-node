var Path = require("path");
var exec = require("child_process").exec;

module.exports.zipUpAFolder = function (zipFile, directory, callback) {
    zipFile = Path.resolve(zipFile);
    directory = Path.resolve(directory);
    
    var commands = [
        'cd "' + directory + '"',
        'zip -r -0 -q "' + zipFile + '" .'
    ];
    
    var command = commands.join("; ");
    //console.log("cmd", command);
    
    exec(command, function (err, stdout, stderr) {
        if (err || stderr) return callback(err || stderr);
        
        callback(null, zipFile);
    });
};