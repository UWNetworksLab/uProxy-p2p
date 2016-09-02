// Makes an XMLHttpRequest to the given URL, and returns a promise which
// fulfills with the response string if the server returns 200, otherwise
// rejects.
export function makeXhrPromise(url :string, method :string, data :string)
    : Promise<string> {
  return new Promise(function(F, R) {
    let xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      if (this.status === 200) {
        F(this.response);
      } else {
        R(new Error('XHR returned status: ' + this.status));
      }
    };
    xhr.onerror = function(e) {
      R(new Error('XHR error: ' + e));
    };
    xhr.send(data);
  });
}
