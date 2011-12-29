var fs = require("fs");
var zip = require("node-native-zip");
var folder = require("./folder");
var uuid = require("node-uuid");
var util = require("util");
var path = require("path");
var DomJS = require("dom-js").DomJS;
var crypto = require("crypto");

// create a targetfolder
var target = "./temp/" + uuid.v4();
var application = "./application-to-pack/";

// copy all the base files to a temp folder
folder.copy("./azure-node-basepackage", target, function () {                
    // this is the webrole folder
    var webRole = path.normalize(path.join(target, "WebRole1_778722b2-eb95-476d-af6a-917f269a0814.cssx")).replace(/\/$/, "");
        
    // prepare the webrole
    // in this process the folder will be replaced by a zip file
    prepareWebRole (webRole, function () {
        // now we can prepare the new manifest file
        editManifest(target, target, "849d589c-82f8-4c56-878c-e6953c60996e.csman", function () {
            zipUpAFolder(target, function () {
                fs.rename(target, target + ".cspkg", function () {
                    console.log("finished", target + ".cspkg");
                });
            });
        });
    });
});

function prepareWebRole (webRole, onReady) {
    // copy the approot to the package
    folder.copy(application, path.join(webRole, "approot"), function () {
        // update the manifest file
        editManifest(webRole, path.join(webRole, "approot"), "39e5cb39-cd18-4e1a-9c25-72bd1ad41b49.csman", function () {
            // create a zip file
            zipUpAFolder(webRole, onReady);
        });
        
    });    
}

function zipUpAFolder (dir, onReady) {
    dir = path.normalize(dir).replace(/\/$/, "");
    
    var archive = new zip();
            
    // map all files in the approot thru this function
    folder.mapAllFiles(dir, function (path, stats, callback) {
        // prepare for the .addFiles function
        callback({ 
            name: path.replace(dir, "").substr(1), 
            path: path 
        });
    }, function (data) {
        // add the files to the zip
        archive.addFiles(data, function () {
            // write the zip file
            fs.writeFile(dir + ".zip", archive.toBuffer(), function () {
                // remove original folder
                folder.remove(dir, function () {
                    // rename zip file
                    fs.rename(dir + ".zip", dir, function () {
                        onReady();
                    });
                });
            });                    
        });
    });    
}

function editManifest(root, manifestDirectory, manifest, callback) {
    root = path.normalize(root).replace(/\/$/, "");
    
    fs.readFile(path.join(root, manifest), "ascii", function (err, body) {
        var domjs = new DomJS();
        
        domjs.parse(body, function(err, dom) {
            if (err) {
                console.log("ERROR", err);
            }
            
            var node = dom.children.filter(function (c) { return c.name === "Contents"; })[0];
            
            var allFiles = [];
            
            folder.mapAllFiles(root, function (f, stats, callback) {
                var isManifestFile = path.normalize(f) === path.normalize(path.join(root, manifest));
                var isRelFile = !!f.match(/\.rels$/);
                
                if (!isManifestFile && !isRelFile) {
                    allFiles.push(f);
                    
                    getHash(f, function (hash) {
                        callback({
                            name: f.replace(root, "").replace(/\//g, "\\"),
                            hash: hash.toString(),
                            uri: f.replace(root, "")
                            /*,
                            created: (Date.parse(stats.ctime) * 1000).toString(),
                            modified: (Date.parse(stats.mtime) * 1000).toString()
                            */
                        });
                    });
                }
                else {
                    // is this the manifest file, then ignore
                    callback(null);
                }
            }, function (data) {
                data.forEach(function (d) {
                    var ele = new Element("Item", d, []);
                    node.children.push(ele);
                });
                
                fs.writeFile(path.join(root, manifest), new Buffer(dom.toXml(), "ascii"), function () {
                    callback(allFiles);
                });
            });
        });        
    });
}

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