// Run as soon as the document's DOM is ready.
document.addEventListener('DOMContentLoaded', function () {
  console.log("loaded UProxy DOM");
});

freedom.emit('test', 'test');
