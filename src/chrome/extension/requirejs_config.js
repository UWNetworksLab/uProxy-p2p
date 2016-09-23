requirejs.config({
  baseUrl: '/',
  paths: {
    uproxy: '/'
  }
});

var link = document.createElement('link');
link.rel = 'import';
link.href = 'ui_components_vulcanized.html'
link.onload = function() {
  console.debug('Finished importing ui_components_vulcanized.html');
  requirejs(['main'], function(main) {
    main.main();
  });
};
link.onerror = function(e) {
  console.error('Error while loading ui_components_vulcanized.html:', e);
};
document.head.appendChild(link);
