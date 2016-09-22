import './scripts/context';
import '../../generic_ui/polymer/root';

function main() {
  let body = document.body;
  body.appendChild(document.createElement('uproxy-root'));
}

window.addEventListener('polymer-ready', main);