// Run as soon as the document's DOM is ready.
document.addEventListener('DOMContentLoaded', function () {
  console.log("loaded UProxy DOM");
});

freedom.on('backward', function(msg) {
  console.log('backward:'+msg);
});
freedom.emit('forward', 'testmessage');
