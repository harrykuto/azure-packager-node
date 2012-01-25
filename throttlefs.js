/**
 * File system throttling
 * 
 * So when you open alot of files the filesystem will just say 'screw you' and stop working.
 * With this (100% fs compatible) module, you will have auto throttling, so we'll have 20 file handles max.
 */

var fs = require("fs");

var threshold = 20;

// number of active handles, plus a queue
var active = 0, processed = 0, scheduled = 0, queue = [];

/**
 * This is the function intercepter.
 * It gets 'fs' functions, wraps them into throttle code and either executes or queues them
 */
function wrapper (funcName, args) {
    var callback = args.length && args[args.length - 1];
    var self = this;
    
    if (callback && typeof callback === "function") {
        scheduled++;
        
        // finished handler
        args[args.length - 1] = function () {
            processed++;
            active--;
            callback.apply(this, arguments);
        };
        
        // kickoff code
        var kickoff = function () {
            active++;
            fs[funcName].apply(self, args);
        };
        
        // depending on the number of active items, we either execute it or schedule
        queue.push(kickoff);
    }
    // cant find a callback function? then just execute
    else {
        return fs[funcName].apply(this, args);
    }
}

// copy all the fs methods
Object.keys(fs).filter(function (m) { return typeof fs[m] === "function"; }).forEach(function (func) {
    module.exports[func] = function () {
        return wrapper(func, arguments);
    };
});

// monitor to empty the queue every once in a while
var queueEmptyCounter = 0;
var monitor = setInterval(function () {
    var toProcess = threshold - active;
    var ix = 0, item = null;
    
    if (processed !== scheduled) {
        console.log("active", active, "queue length", queue.length, "empty counter", queueEmptyCounter, "processed", processed, "scheduled", scheduled);
    }
    
    
    if (toProcess === 0) {
        if (++queueEmptyCounter > 5) {
            clearInterval(monitor);
        }
    }
    else {
        queueEmptyCounter = 0;
    }

    while (++ix <= toProcess && (item = queue.shift())) {
        item();
    }
}, 20);

// some test code
//module.exports.readFile("./folder.js", "utf8", function (err, data) {
//    console.log(err, !!data);
//});
//module.exports.readFile("./example.js", "utf8", function (err, data) {
//    console.log(err, !!data);
//});