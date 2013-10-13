
var getJSON = function(url, successHandler, errorHandler) {
  var xhr = new XMLHttpRequest();
  xhr.open('get', url, true);
  xhr.responseType = 'json';
  xhr.onload = function() {
    var status = xhr.status;
    if (status == 200 && successHandler) {
      successHandler(xhr.response);
    } else if (errorHandler) {
      errorHandler(status);
    }
  };
  xhr.send();
};

describe("state-storage", function() {
  it("Load example storage", function() {

    jasmine.log("jasmine log test");

    // jasmine.getEnv().addReporter(new jasmine.ConsoleReporter(console.log));

    var exampleState = null;
    jasmine.log("jasmine log test");
    console.log("console log test\n\n");

/*
     runs(function() {
      getJSON('common/backend/test/example-state.json', function(v) {
        console.log(exampleState);
        exampleState = v;
      }, function(e) {
        console.error("error:",e);
        throw("Error: " + e);
      });
    });

    waitsFor(function() {
      return exampleState !== null;
    }, "exampleState to be read.", 1000);


*/

    /* var state = null;

    ("")

    var req = new XMLHttpRequest;
    req.overrideMimeType("application/json");
    req.open('GET', "");
    var target = this;
    req.onload  = function(x) { state = JSON.parse(x) };
    req.send();
*/

  });
});  // util
