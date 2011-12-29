var packager = require("./server");
var uuid = require("node-uuid");

packager("./application-to-pack", "./temp/" + uuid.v4(), function (file) {
    console.log(file);
});