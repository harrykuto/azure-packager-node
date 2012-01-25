var fs = require("fs");
var zip = require("node-native-zip");
var folder = require("./folder");
var util = require("util");
var path = require("path");
var DomJS = require("dom-js").DomJS;
var crypto = require("crypto");

/**
 * Azure packager for node.js
 */
module.exports = function (application, target, callback) {
    // copy all the base files to a temp folder
    folder.copy(__dirname + "/azure-node-basepackage", target, function (err) {
        if (err) return callback(err);
        
        // this is the webrole folder
        var webRole = path.normalize(path.join(target, "WebRole1_778722b2-eb95-476d-af6a-917f269a0814.cssx")).replace(/\/$/, "");

        // prepare the webrole
        // in this process the folder will be replaced by a zip file
        prepareWebRole (application, webRole, function (err) {
            if (err) return callback(err);
            
            // prepare the service definition folder
            prepareSdPackage (application, path.join(target, "SDPackage_26ebe4de-6f2f-4732-8ea8-e33abd7b3fe8.csdx"), function (err) {
                if (err) return callback(err);
                
                // now we can prepare the new manifest file
                editManifest(target, target, "849d589c-82f8-4c56-878c-e6953c60996e.csman", function () {
                    zipUpAFolder(target, function () {
                        fs.rename(target, target + ".cspkg", function () {
                            callback(null, target + ".cspkg");
                        });
                    });
                });
            });
        });
    });
};

/**
 * Function to copy the web role folder, combines base package and application folder
 */
function prepareWebRole (application, webRole, callback) {
    // copy the approot to the package
    folder.copy(application, path.join(webRole, "approot"), function (err) {
        if (err) return callback(err);
        
        // update the manifest file
        editManifest(webRole, path.join(webRole, "approot"), "39e5cb39-cd18-4e1a-9c25-72bd1ad41b49.csman", function (err) {
            if (err) return callback(err);
            
            // create a zip file
            zipUpAFolder(webRole, callback);
        });
        
    });
}

/**
 * Copies the SDPackage directory, and takes a .csdef file from the root of the app folder if found
 */
function prepareSdPackage (application, target, callback) {
    // if we have a csdef file then copy that one
    fs.readdir(application, function (err, files) {
        if (err) return callback(err);
        
        files = files && files.filter(function (f) { return f.match(/\.csdef$/); });
        
        if (files.length) {
            folder.copyFile(path.join(application, files[0]), path.join(target, files[0]), afterCopy);
        }
        else {
            afterCopy();
        }
        
        function afterCopy() {
            editManifest(target, target, "4ee6e124-f6ca-4d51-baea-64f3f88fc4b1.csman", function (err) {
                if (err) return callback(err);
                
                zipUpAFolder(target, callback);
            });
        }
    });
}

/**
 * Take a folder and zip it's content (incl. sub directories)
 */
function zipUpAFolder (dir, callback) {
    dir = path.normalize(dir).replace(/\/$/, "");
    
    var archive = new zip();
            
    // map all files in the approot thru this function
    folder.mapAllFiles(dir, function (path, stats, callback) {
        // prepare for the .addFiles function
        callback({ 
            name: path.replace(dir, "").substr(1), 
            path: path 
        });
    }, function (err, data) {
        if (err) return callback(err);
        
        // add the files to the zip
        archive.addFiles(data, function (err) {
            if (err) return callback(err);
            
            // write the zip file
            fs.writeFile(dir + ".zip", archive.toBuffer(), function (err) {
                if (err) return callback(err);
                
                // remove original folder
                folder.remove(dir, function (err) {
                    if (err) return callback(err);
                    
                    // rename zip file
                    fs.rename(dir + ".zip", dir, function (err) {
                        if (err) return callback(err);
                        
                        callback(null);
                    });
                });
            });                    
        });
    });    
}

/**
 * Create a manifest file for a given directory, calculates hashes and creates XML file
 */
function editManifest(root, manifestDirectory, manifest, callback) {
    root = path.normalize(root).replace(/\/$/, "");
    
    fs.readFile(path.join(root, manifest), "ascii", function (err, body) {
        if (err) return callback(err);
        
        var domjs = new DomJS();
        
        domjs.parse(body, function(err, dom) {
            if (err) {
                return callback(err);
            }
            
            var node = dom.children.filter(function (c) { return c.name === "Contents"; })[0];
            
            var allFiles = [];
            
            folder.mapAllFiles(root, function (f, stats, filecallback) {
                var isManifestFile = path.normalize(f) === path.normalize(path.join(root, manifest));
                var isRelFile = !!f.match(/\.rels$/);
                
                if (!isManifestFile && !isRelFile) {
                    allFiles.push(f);
                    
                    getHash(f, function (hash) {
                        filecallback({
                            name: f.replace(root, "").replace(/\//g, "\\"),
                            hash: hash.toString(),
                            uri: f.replace(root, "")
                        });
                    });
                }
                else {
                    // is this the manifest file, then ignore
                    filecallback(null);
                }
            }, function (err, data) {
                if (err) return callback(err);
                
                data.forEach(function (d) {
                    var ele = new Element("Item", d, []);
                    node.children.push(ele);
                });
                
                fs.writeFile(path.join(root, manifest), new Buffer(dom.toXml(), "ascii"), function (err) {
                    if (err) return callback(err);
                    
                    callback(null, allFiles);
                });
            });
        });        
    });
}

/**
 * Get SHA256 hash for a file
 */
function getHash(filename, callback) { 
    var shasum = crypto.createHash('sha256');
     
    var s = fs.ReadStream(filename);
    s.on('data', function(d) {
        shasum.update(d);
    });
     
    s.on('end', function() {
        var d = shasum.digest('hex').toUpperCase();
        callback(d);
    });
}