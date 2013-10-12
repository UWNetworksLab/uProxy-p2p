
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
  describe("state storage test", function() {
    it("test1", function() {
      var exampleState = null;

      console.log("test1");

/*       runs(function() {
        getJSON('example-state.json', function(v) {
          console.log(exampleState);
          exampleState = v;
        }, function(e) {
          console.error("error:",e);
          throw("Error: " + e);
        });
      });

      waitsFor(function() {
        return exampleState;
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
  });

});  // util
