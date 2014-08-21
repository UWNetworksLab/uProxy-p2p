// TODO: bind this to the underlying uproxy ui model.
var model = {};

var ui = document.querySelector('uproxy-ui');
console.log('global model is: ', model);
ui.model = model;
