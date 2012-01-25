var packager = require("./index");
var uuid = require("node-uuid");

packager("./application-to-pack", "./temp/" + uuid.v4(), function (err, file) {
    console.trace();
    console.log(err, file);
});