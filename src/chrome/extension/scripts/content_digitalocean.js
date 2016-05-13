(function () {
  var pageUrl = document.location.href,
      pageId = getPageId(pageUrl),
      pmntAdded = isPmntAdded();

  console.log('pageId:', pageId);
  console.log('pmntAdded:', pmntAdded);

  if (pageId === 'welcome' && pmntAdded) {
    if (shouldPromptPromoCode()) {
      document.location.href = 'https://cloud.digitalocean.com/settings/billing';
    }
  }
  if (pageId === 'billing' && pmntAdded) {
    showOverlay();
  }

  function showOverlay() {
    var overlay = document.createElement('div');
    overlay.id = '__uProxyOverlay';
    overlay.style.position   = 'fixed';
    overlay.style.top        = '0';
    overlay.style.left       = '0';
    overlay.style.bottom     = '0';
    overlay.style.right      = '0';
    overlay.style.opacity    = '.97';
    overlay.style.background = '#12A391';
    overlay.style.zIndex   = '10000';
    overlay.style.textAlign  = 'center';

    var h1 = document.createElement('h1');
    h1.style.fontWeight = 'bold';
    h1.innerText = _('Authorize uProxy to connect with DigitalOcean');
    overlay.appendChild(h1);

    if (shouldPromptPromoCode()) {
      var promoContainer = document.createElement('div');
      var promoInput = document.createElement('input');
      promoInput.style.width = '300px';
      promoInput.placeholder = _('Have a promo code? Enter it here.');
      promoInput.id = '__uProxyPromoInput';
      // TODO: add 'apply' button which copies this input's value into
      // the `id=promo_code` input, submits the 'id=new_promo' ajax form,
      // and calls `setHavePromoCode(1)` if the submission succeeds.
      promoContainer.appendChild(promoInput);
      overlay.appendChild(promoContainer);
    }

    var proceedContainer = document.createElement('div');
    var proceedLink = document.createElement('a');
    proceedLink.style.color = '#fff';
    proceedLink.style.fontSize = '48px';
    proceedLink.style.fontWeight = 'bold';
    proceedLink.style.textDecoration = 'underline';
    proceedLink.innerText = 'Proceed';
    // This url should close the tab and open the uProxy extension, which
    // instructs the user to click 'sign in' after creating the DO account.
    // TODO: requires https://github.com/uproxy/uproxy/tree/bemasc-autoclose
    // Eventually we should save the user this extra click, and have this
    // trigger oauth directly.
    proceedLink.href = 'https://www.uproxy.org/autoclose'
    proceedContainer.appendChild(proceedLink);
    overlay.appendChild(proceedContainer);

    document.body.appendChild(overlay);
  }

  function shouldPromptPromoCode() {
    return wantPromoCode() && !havePromoCode();
  }

  function wantPromoCode() {
    // TODO: Going to uproxy.org/OFF should stash a flag somewhere that we
    // need to check here to determine this value
    return true;
  }

  function havePromoCode() {
    return !!localStorage['__uProxyHavePromoCode'];
  }

  function setHavePromoCode(val) {
    if (val) {
      localStorage['__uProxyHavePromoCode'] = 1;
    } else {
      delete localStorage['__uProxyHavePromoCode'];
    }
  }

  /**
   * Return whether the user has added a credit card.
   * Ideally we could use some API to check this, but none is available.
   * So unfortunately we must resort to sniffing the current page's content.
   * TODO: Can we make this less brittle?
   */
  function isPmntAdded() {
    if (pageId === 'welcome') {
      // The blue 'Create Droplet' button is disabled until a payment menthod
      // has been added, so use this to detect whether payment method added.
      // (There's also a green 'Create Droplet' button in the topnav, which
      // is never disabled. The following selector targets only the button
      // we care about, not the one in the topnav.)
      var cdbtn = document.querySelector('a[href="/droplets/new"].action');
      return !hasClass(cdbtn, 'is-disabled');
    }
    if (pageId === 'billing') {
      var pd = document.getElementById('Payment-details');
      if ('data-shelfid' in pd.attributes) {
        return !hasClass(pd, 'is-open');
      }
      return false;
    }
  }

  function getPageId(url) {
    if (url.indexOf('cloud.digitalocean.com/welcome') > -1) {
      return 'welcome';
    }
    if (url.indexOf('cloud.digitalocean.com/settings/billing') > -1) {
      return 'billing';
    }
  }

  function _(s) {
    return s;
  }

  function hasClass(el, className) {
    var cl = el.classList;
    for (var i=0, c=cl[i]; c; c=cl[++i]) {
      if (c === className) {
        return true;
      }
    }
    return false;
  }

  (function modifyUI() {
    (function hideEls() {
      // hide elements for the following selectors on all pages
      ['a.create_droplet'   // 'Create Droplet' button in topnav
      ].map(hideEl);

      if (pageId === 'welcome') {
        // hide the 'Create Droplet' box
        // (there's no more-specific selector for it than this, unfortunately)
        hideEl('div.small-4:last-child');
      }

      function hideEl(selector) {
        var el = document.querySelector(selector);
        el && (el.style.opacity = '0.1');
      }
    })();
  })();
})();
