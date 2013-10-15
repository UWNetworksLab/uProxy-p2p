window.freedomcfg = function(register) {
  console.log("Registering core.socket");
  register("core.socket", Socket_chrome);
}

var script = document.createElement('script');
script.setAttribute('data-manifest', '../common/backend/test/simple-proxy-test.json');
// Uncomment for clearer but less portable module error messages.
script.textContent = '{"strongIsolation": true, "stayLocal": true, "debug": false}';
script.src = '../common/freedom/freedom.js';
document.head.appendChild(script);

script.onload = function() {
  console.log("Freedom loaded!");
  console.log("freedom.emit('start');  // to start proxy");
  console.log("freedom.emit('stop');   // to stop proxy");
};
