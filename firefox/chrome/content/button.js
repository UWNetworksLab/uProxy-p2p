if (typeof org === 'undefined') var org = {};
if (!org.uproxy) org.uproxy = {};

(function installButton(scope) {

  /**
   * From https://developer.mozilla.org/en-US/Add-ons/Code_snippets/Toolbar
   * Installs the toolbar button with the given ID into the given
   * toolbar, if it is not already present in the document.
   *
   * @param {string} toolbarId The ID of the toolbar to install to.
   * @param {string} id The ID of the button to install.
   * @param {string} afterId The ID of the element to insert after. @optional
   */
  function installButton(toolbarId, id, afterId) {
    if (!document.getElementById(id)) {
      var toolbar = document.getElementById(toolbarId);

      // If no afterId is given, then append the item to the toolbar
      var before = null;
      if (afterId) {
        let elem = document.getElementById(afterId);
        if (elem && elem.parentNode == toolbar)
          before = elem.nextElementSibling;
      }

      toolbar.insertItem(id, before);
      toolbar.setAttribute("currentset", toolbar.currentSet);
      document.persist(toolbar.id, "currentset");

      if (toolbarId == "addon-bar")
        toolbar.collapsed = false;
    }
  }
  
  function uproxyButtonCommand(event) {
    var toolbarButton = document.getElementById("uproxy-button");
    var panel = document.getElementById("uproxy-panel");
    panel.openPopup(toolbarButton, "after_start", 0, 0, false, false);
  }

  function setupButton() {
    // TODO: Only install the button when UProxy is first installed.
    // Users may want to (re)move the button without needing to do it
    // every time FF starts up.
    setTimeout(function() {
      installButton("nav-bar", "uproxy-button");
      
    }, 10000);
  }
  window.addEventListener("load", setupButton);

  scope.uproxyButtonCommand = uproxyButtonCommand;
})(org.uproxy);
