var fs = require("fs");
var path = require("path");

// recursive function
function copyFolder(src, target, callback) {
    path.exists(target, function (exists) {
        if (!exists) {
            fs.mkdir(target, 04777, function () {
                doCopy();
            });
        }
        else {
            doCopy();
        }
    });
    
    var doCopy = function () {
        fs.readdir(src, function (err, files) {
            files = files && files.filter(function (f) { return !f.match(/^(\.git)/); });
            
            if (!files || !files.length) {
                callback();
                return;
            }
            
            var fileIx = 0;
            function onFileCopied() {
                fileIx += 1;
                
                if (fileIx === files.length) {
                    callback(src);
                }
            }
    
            files.forEach(function (file) {
                fs.stat(path.join(src, file), function (err, stats) {
                    if (err) {
                        throw err;
                    }
                    
                    if (stats.isFile()) {
                        copyFile(path.join(src, file), path.join(target, file), onFileCopied);
                    }
                    else if (stats.isDirectory()) {
                        copyFolder(path.join(src, file), path.join(target, file), onFileCopied);
                    }
                });
            });
            
        });
    };
}

function mapAllFiles(dir, action, callback) {
    var output = [];
    
    fs.readdir(dir, function (err, files) {
        if (err) {
            console.log("err", err, dir);
        }
        
        files = files && files.filter(function (f) { return !f.match(/^(\.git)/); });
            
        if (!files || !files.length) {
            callback(output);
            return;
        }
                    
            
        var fileIx = 0;
        function onFolderComplete(data) {
            fileIx += 1;
            
            if (data) {
                data.forEach(function (d) { output.push(d); });
            }
            
            if (fileIx === files.length) {
                callback(output);
            }
        }
        
        function onFileComplete() {
            fileIx += 1;
                        
            if (fileIx === files.length) {
                callback(output);
            }            
        }

        files.forEach(function (file) {
            fs.stat(path.join(dir, file), function (err, stats) {
                if (err) {
                    throw err;
                }
                
                if (stats.isFile()) {
                    action(path.join(dir, file), stats, function (res) {
                        if (res) {
                            output.push(res);
                        }
                        onFileComplete();
                    });
                }
                else if (stats.isDirectory()) {
                    mapAllFiles(path.join(dir, file), action, onFolderComplete, output);
                }
            });
        });
        
    });    
}


// copy a simple file
function copyFile(src, target, callback) {
    var srcFile = fs.createReadStream(src);
    var targetFile = fs.createWriteStream(target);
    
    targetFile.on("close", function () {
        callback(src);        
    });
    
    srcFile.pipe(targetFile);
}

function rmrf(dir, callback) {
    fs.stat(dir, function(err, stats) {
        if (err) {
            return callback(err);
        }

        if (!stats.isDirectory()) {
            return fs.unlink(dir, callback);
        }

        var count = 0;
        fs.readdir(dir, function(err, files) {
            if (err) {
                return callback(err);
            }

            if (files.length < 1) {
                return fs.rmdir(dir, callback);
            }

            files.forEach(function(file) {
                var sub = path.join(dir, file);

                rmrf(sub, function(err) {
                    if (err) {
                        return callback(err);
                    }

                    if (++count == files.length) {
                        fs.rmdir(dir, callback);
                    }
                });
            });
        });
    });
}

module.exports = { copy: copyFolder, remove: rmrf, mapAllFiles: mapAllFiles };
