var fs = require("./throttle-fs");
var zip = require("./zip");
var folder = require("./folder");
var util = require("util");
var path = require("path");
var exec = require("child_process").exec;

var DomJSLib = require("dom-js");
var DomJS = DomJSLib.DomJS;
var crypto = require("crypto");

var filenames = {
    webRole: "WebRole1_71a027ab-5445-482c-9ecc-f6f6271ef758.cssx",
    sdPackage: "SDPackage_953412aa-285b-404c-9c4f-d9a4fe74abcb.csdx",
    rootManifest: "dc37b4fa-2729-417f-91af-50d9e7dc322a.csman",
    webRoleManifest: "f4d4bb36-c975-4596-b905-c249d1fd64dc.csman",
    sdPackageManifest: "3cf390f0-b33f-4a90-94a4-b2a289893c31.csman"
}

/**
 * Azure packager for node.js
 */
module.exports = function (application, target, callback) {
    // copy all the base files to a temp folder
    folder.copy(__dirname + "/azure-node-basepackage", target, function (err) {
        if (err) return callback(err);
        
        // this is the webrole folder
        var webRole = path.normalize(path.join(target, filenames.webRole)).replace(/\/$/, "");

        // prepare the webrole
        // in this process the folder will be replaced by a zip file
        prepareWebRole (application, webRole, function (err) {
            if (err) return callback(err);
            
            // prepare the service definition folder
            prepareSdPackage (application, path.join(target, filenames.sdPackage), function (err) {
                if (err) return callback(err);
                
                // now we can prepare the new manifest file
                editManifest(target, target, filenames.rootManifest, function () {              
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
        editManifest(webRole, path.join(webRole, "approot"), filenames.webRoleManifest, function (err) {
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
            editManifest(target, target, filenames.sdPackageManifest, function (err) {
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
    
    zip.zipUpAFolder(dir + ".zip", dir, function (err, file) {
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
                    
                    process.nextTick(function () {
                        getHash(f, function (hash) {
                            filecallback({
                                name: f.replace(root, "").replace(/\//g, "\\"),
                                hash: hash.toString(),
                                uri: f.replace(root, "")
                            });
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
                    var ele = new DomJSLib.Element("Item", d, []);
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
    filename = path.resolve(filename);    
    
    var commands = [
        'openssl dgst -sha256 "' + filename + '" .'
    ];
    
    var command = commands.join("; ");
    
    exec(command, function (err, stdout, stderr) {
        var shaMatch = stdout.trim().match(/\w+$/);
        
        callback(shaMatch && shaMatch[0]);
    });
}