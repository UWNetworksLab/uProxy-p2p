var sockets = require("./sockets");
var subprocess = require("subprocess");

var python = subprocess.call({
  command: 'python'
});

// exports["test python"] = function(assert) {
// };

// require("sdk/test").run(exports);
