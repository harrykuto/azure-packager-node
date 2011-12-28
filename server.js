var fs = require("fs");
var zip = require("node-native-zip");
var folder = require("./folder");
var uuid = require("node-uuid");
var util = require("util");
var path = require("path");
var DomJS = require("dom-js").DomJS;

// create a targetfolder
var target = "./temp/" + uuid.v4() + "/";
var application = "./application-to-pack/";

folder.copy("./azure-node-basepackage", target, function () {
    var webRole = target + "WebRole1_778722b2-eb95-476d-af6a-917f269a0814.cssx";
    
    folder.copy(application, webRole + "/approot", function () {
        editManifest(webRole);
        console.log("oh yeah", target);
    });
    
    /*folder.remove(target, function () {
        console.log("finished", arguments);
    });*/
});

function editManifest(webrole) {
    var manifest = "39e5cb39-cd18-4e1a-9c25-72bd1ad41b49.csman";
    fs.readFile(path.join(webrole, manifest), "ascii", function (err, body) {
        var domjs = new DomJS();
        
        domjs.parse(body, function(err, dom) {
            var node = dom.children.filter(function (c) { return c.name === "Contents"; })[0];
            
            folder.mapAllFiles(webrole, function (f, callback) {
                callback(f);
            }, function (data) {
                console.log(data);
            });
            
            /*console.log(util.inspect(dom, false, 23));
            console.log("serializes to : " + dom.toXml());*/
        });        
    });
}

return;

var archive = new zip();

archive.addFiles([ 
    { name: "moehah.txt", path: "./test/moehah.txt" },
    { name: "images/suz.jpg", path: "./test/images.jpg" }
], function () {
    var buff = archive.toBuffer();

    fs.writeFile("./test2.zip", buff, function () {
        console.log("Finished");
    });
}, function (err) {
    console.log(err);
});