/*                       _____________________________
 *                      |    States + Transitions:    |
 *                      |                             |
 *                      | legend:                     |
 *                      |       user = the user       |
 *                      |         DO = digitalocean   |
 *                      |         us = this content   |
 *                      |              script         |
 *                       -----------------------------
 *
 *
 *
 *                            /{signup,login}
 *                                   |
 *                         (user: submit valid form)
 *                                   |
 *                             (DO: redirect)
 *                                   |
 *                               /droplets
 *                                   |
 *                         (DO: payment added?)
 *                          /                \
 *                        no                 yes
 *                        /                    \
 *                (DO: redirect)          (us: shouldPromptPromo?)
 *                      /                     /            \
 *                  /welcome                 no            yes
 *                    /                     /                \
 *      (DO: email confirmed?)      (us: show overlay)  (us: redirect)
 *          /         \                   /                    |
 *        no         yes       (user: click 'proceed')  /settings/billing
 *       /              \                                      |
 * (user: click )    (user: click)                (us: show overlay w/ promo input)
 * (confirm link)    (add pmnt link)                           |
 *         \            /                                      |
 *       /settings/billing                          (user: enter promo code)
 *               |                                             |
 *  (user: add payment method)                    (user: click 'proceed to uproxy')
 *               |
 *        (DO: redirect)
 *               |
 *          /droplets (see above) ^^^
 *
 */

(function (document, navigator) {

  var isChrome = navigator.userAgent.indexOf('Chrome') !== -1;

  var globalSettingsP = new Promise(function (resolve) {
    if (isChrome) {
      chrome.runtime.sendMessage({globalSettingsRequest: true}, resolve);
    } else {
      self.port.on('globalSettings', function (globalSettings) {
        resolve(globalSettings);
      });
    }
  });

  globalSettingsP.then(function (globalSettings) {

    if (!globalSettings.shouldHijackDO) {
      return;
    }

    function getPageId(url) {
      if (url.indexOf('cloud.digitalocean.com/welcome') !== -1) {
        return 'welcome';
      } else if (url.indexOf('cloud.digitalocean.com/settings/billing') !== -1) {
        return 'billing';
      } else if (url.indexOf('cloud.digitalocean.com/droplets') !== -1) {
        return 'droplets';
      }
    }

    var pageId = getPageId(document.location.href);

    if (pageId === 'droplets') {
      if (shouldPromptPromo()) {
        // Must be on billing page to submit promo codes, so redirect.
        document.location.href = 'https://cloud.digitalocean.com/settings/billing';
      }
      // Proceed to showing the overlay.
    } else if (pageId === 'billing') {
      if (!isPmntAdded()) {
        return;
      }
      // Proceed to showing the overlay.
    } else {
      return;
    }

    // Interpose our overlay.
    var i18nKeyByUIKey = {
      // TODO: Check if user has already completed oauth, if so use different
      // test for this h1?
      h1: 'PROCEED_TO_UPROXY_TITLE',
      msg: 'PROCEED_TO_UPROXY_MSG',
      proceedLink: 'PROCEED_TO_UPROXY',
      promoInput: 'ENTER_PROMO',
      promoAccepted: 'PROMO_ACCEPTED',
      promoFailed: 'PROMO_FAILED',
      processing: 'PROCESSING',
      applyButton: 'APPLY',
    };
    var getLocalAssetUrlP, translationsP;
    if (isChrome) {
      getLocalAssetUrlP = Promise.resolve(chrome.extension.getURL);
      translationsP = new Promise(function (resolve) {
        chrome.runtime.sendMessage({translationsRequest: values(i18nKeyByUIKey)}, resolve);
      });
    } else {
      getLocalAssetUrlP = new Promise(function (resolve) {
        self.port.on('baseUrlFF', function (baseUrl) {
          resolve(function (relUrl) { return baseUrl + relUrl; });
        });
      });
      translationsP = new Promise(function (resolve) {
        self.port.on('translations', resolve);
        self.port.emit('translationsRequest', values(i18nKeyByUIKey));
      });
    }

    var allP = [getLocalAssetUrlP, translationsP];
    Promise.all(allP).then(function (results) {
      var getLocalAssetUrl = results[0];
      var translations = results[1];  // {i18nkey: message}

      var overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.bottom = '0';
      overlay.style.right = '0';
      overlay.style.opacity = '.95';
      overlay.style.background = '#12A391';
      overlay.style.zIndex = '10000';
      overlay.style.textAlign = 'center';
      overlay.style.padding = '180px 0 0';

      var closeBtn = document.createElement('img');
      closeBtn.src = getLocalAssetUrl('icons/cloud/ic_close_white_24dp.svg');
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.position = 'fixed';
      closeBtn.style.top = '15px';
      closeBtn.style.right = '20px';
      closeBtn.style.width = '40px';
      closeBtn.onclick = function () { overlay.style.display = 'none'; };
      overlay.appendChild(closeBtn);

      var img = document.createElement('img');
      img.src = getLocalAssetUrl('icons/cloud/overlay_uproxy_do.svg');
      img.style.width = '218px';
      overlay.appendChild(img);

      var textContainer = document.createElement('div');
      textContainer.style.margin = '26px auto';
      textContainer.style.maxWidth = '700px';
      textContainer.style.minWidth = '360px';
      textContainer.style.padding = '0 30px';
      overlay.appendChild(textContainer);

      var h1 = document.createElement('h1');
      h1.textContent = translations[i18nKeyByUIKey.h1];
      h1.style.color = '#fff';
      h1.style.fontFamily = 'Roboto';
      h1.style.fontSize = '24px';
      h1.style.fontWeight = 'bold';
      h1.style.lineHeight = '36px';
      h1.style.wordBreak = 'normal';
      textContainer.appendChild(h1);

      var msgDiv = document.createElement('div');
      msgDiv.textContent = translations[i18nKeyByUIKey.msg];
      msgDiv.style.color = '#fff';
      msgDiv.style.fontFamily = 'Roboto';
      msgDiv.style.fontSize = '14px';
      textContainer.appendChild(msgDiv);

      if (shouldPromptPromo()) {
        var DOtoken = document.querySelector('input[name="authenticity_token"]');
        if (DOtoken) {
          addPromoUI();
        } else {
          console.log('Missing DOtoken. DigitalOcean UI changed?');
        }
      }

      var proceedContainer = document.createElement('div');
      proceedContainer.style.marginTop = '46px';
      var proceedLink = document.createElement('a');
      proceedLink.style.backgroundColor = '#fff';
      proceedLink.style.borderRadius = '2px';
      proceedLink.style.color = '#155160';
      proceedLink.style.fontFamily = 'Roboto';
      proceedLink.style.fontSize = '16px';
      proceedLink.style.fontWeight = 'bold';
      proceedLink.style.padding = '16px 36px';
      proceedLink.textContent = translations[i18nKeyByUIKey.proceedLink];
      // This url should close the tab and open the uProxy extension, which
      // instructs the user to click 'sign in' after creating the DO account.
      // Eventually we should save the user this extra click, and have this
      // trigger oauth directly.
      proceedLink.href = 'https://www.uproxy.org/autoclose';
      proceedContainer.appendChild(proceedLink);
      overlay.appendChild(proceedContainer);

      document.body.appendChild(overlay);

      function addPromoUI() {
        var promoContainer = document.createElement('div');

        var promoInput = document.createElement('input');
        promoInput.autofocus = true;
        promoInput.required = true;
        promoInput.style.backgroundColor = 'transparent';
        promoInput.style.border = '1px solid #fff';
        promoInput.style.color = '#fff';
        promoInput.style.fontFamily = 'Roboto';
        promoInput.style.fontSize = '16px';
        promoInput.style.padding = '12px';
        promoInput.style.width = '300px';
        promoInput.style.width = '300px';
        promoInput.placeholder = translations[i18nKeyByUIKey.promoInput];
        promoContainer.appendChild(promoInput);

        var style = document.createElement('style');
        style.appendChild(document.createTextNode('')); // webkit hack
        document.head.appendChild(style);
        try {
          style.sheet.insertRule('::-webkit-input-placeholder { color: #fff; }', 0);
        } catch (e) { }
        try {
          style.sheet.insertRule('::-moz-placeholder { color: #fff; }', 0);
        } catch (e) { }

        var applyButton = document.createElement('button');
        applyButton.textContent = translations[i18nKeyByUIKey.applyButton];
        applyButton.style.backgroundColor = '#155160';
        applyButton.style.border = '0';
        applyButton.style.borderRadius = '2px';
        applyButton.style.color = '#fff';
        applyButton.style.fontFamily = 'Roboto';
        applyButton.style.fontSize = '14px';
        applyButton.style.fontWeight = 'bold';
        applyButton.style.height = '46px';
        applyButton.style.margin = '0 0 0 12px';
        applyButton.style.padding = '12px 32px';
        promoContainer.appendChild(applyButton);

        var resultText = document.createElement('div');
        resultText.textContent = ' ';  // no-break space
        resultText.style.color = '#fff';
        resultText.style.fontFamily = 'Roboto';
        resultText.style.fontSize = '16px';
        promoContainer.appendChild(resultText);

        applyButton.onclick = handleApply;
        overlay.appendChild(promoContainer);

        function handleApply(evt) {
          resultText.textContent = translations[i18nKeyByUIKey.processing];

          var body = 'code=' + encodeURIComponent(promoInput.value) +
            '&authenticity_token=' + encodeURIComponent(DOtoken.value);

          var req = new Request('/promos', {
            method: 'post',
            headers: {
              'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'x-csrf-token': DOtoken.value,
              'x-requested-with': 'XMLHttpRequest'
            },
            body: body,
            credentials: 'include'
          });
          fetch(req).then(function (resp) {
            return resp.json();
          }).then(function (data) {
            if (typeof data !== 'object' || data.status === 'invalid') {
              return handlePromoFailure();
            }
            resultText.textContent = translations[i18nKeyByUIKey.promoAccepted];
            promoInput.disabled = true;
            applyButton.disabled = true;
            promoInput.style.opacity = '0.5';
            applyButton.style.opacity = '0.5';
            setPromoApplied();
          }).catch(function (e) {
            handlePromoFailure();
          });
          function handlePromoFailure() {
            resultText.textContent = translations[i18nKeyByUIKey.promoFailed];
          }
        }
      }
    });

    function shouldPromptPromo() {
      return globalSettings.activePromoId && !isPromoApplied();
    }

    function isPromoApplied() {
      return !!localStorage['__uProxyPromoApplied'];
    }

    function setPromoApplied() {
      localStorage['__uProxyPromoApplied'] = 1;
    }

    /**
     * Return whether the user has added a credit card.
     * Ideally we could use some API to check this, but none is available.
     * So unfortunately we must resort to sniffing the current page's content.
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
      } else if (pageId === 'billing') {
        var pd = document.getElementById('Payment-details');
        if ('data-shelfid' in pd.attributes) {
          return !hasClass(pd, 'is-open');
        }
        return false;
      } else if (pageId === 'droplets') {
        return true;
      }
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

    function values(ob) {
      var rv = [];
      for (var k in ob) rv.push(ob[k]);
      return rv;
    }

    (function modifyUI() {
      (function hideEls() {
        if (pageId === 'welcome') {
          // hide the 'Create Droplet' box
          // (there's no more-specific selector for it than this, unfortunately)
          hideEl('div.small-4:last-child');
          // hide the 'Create Droplet' button in the topnav
          hideEl('a.create_droplet');
        }

        function hideEl(selector) {
          var el = document.querySelector(selector);
          el && (el.style.opacity = '0.1');
        }
      })();
    })();
  });
})(document, navigator);
