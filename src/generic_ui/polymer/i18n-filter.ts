/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/i18next/i18next.d.ts' />

import i18n = require('i18next');

interface I18nWindow extends Window { i18nResources: any; }

declare var window: I18nWindow;

window.i18nResources = {};

i18n.init({
  resStore: window.i18nResources
});

// In order for this to compile, add two definitions to I18nextStatic in i18next.d.ts:
// addResources(language: string, namespace: string, resources :IResourceStoreKey): void;
// addResourceBundle(language: string, namespace: string, resources :IResourceStoreKey): void;

i18n.addResources('en-US', 'translation', {
  'Good': 'Bueno',
  'Bad': 'Malo',
  'Hello': 'Hello __name__',
  'Access': '__name__ requests access from you.',

  /* Frequently used text */
  'done': 'Done',
  'yes': 'Yes',
  'no': 'No',
  'startGetting': 'Start getting access',
  'stopGetting': 'Stop getting access',

  /* Text for getting access */
  'grantedYouAccess': '__name__ has granted you access',
  'tryingToConnect': 'Trying to connect to __name__',
  'askingForAccess': 'Asking for access',
  'waitingForAccess': 'You will be able to get access when __name__ accepts.',
  'offeredYouAccess': 'They\'ve offered you access.',
  'acceptOffer': 'Accept Offer',
  'ignore': 'Ignore',
  'stopIgnoringOffers': 'Stop ignoring offers',
  'askForAccess': 'Ask for access',

  /* Text for sharing access */
  'grantedFriendAccess': 'You\'ve given them access.',
  'revokeAccess': 'Revoke Access',
  'cancelOffer': 'Cancel Offer',
  'friendRequestsAccess': '__name__ requests access from you.',
  'grant': 'Grant',
  'friendRequestedAccess': 'They requested access through you.',
  'stopIgnoringRequests': 'Stop ignoring requests',
  'accessNotGranted': 'You have not granted them access.',
  'offerAccess': 'Offer Access',

  /* Copypaste */
  'shareOneTime': 'Share a one-time connection',
  'requestOneTime': 'Request a one-time connection',
  'startOneTime': 'Start a one-time connection',
  'errorParsingLink': 'There was an error parsing the uproxy connection link, please try navigating to the link again or asking your friend for a new link.',
  'noLongerGetting': 'You are no longer getting access. To request a connection, click the button below.',
  'startNewConnection': 'Start getting a new connection',
  'errorStartingConnection': 'There was an error starting the connection and it had to be terminated. Please try starting another connection.',
  'sendConnectionLink': 'To share your connection, please ask your friend to send you their link.',
  'copyConnectionLink': 'To request access from a friend, copy and paste this URL to them over a secure channel',
  'loading': 'Loading...',
  'friendNeedsToClick': 'To finish setting up the connection, your friend needs to click on the link and send you a link from their uProxy client.  When you click on it, you\'ll be ready to start getting access.',
  'oneTimeSuccess': 'Success! A one-time connection has been established.',
  'startOneTimeInstruction': 'To start getting access from your friend, click the button below.',
  'stopOneTimeInstruction': 'To stop getting access from your friend, click the button below.',
  'oneTimeGetting': 'You are currently getting access.',
  'stopOneTimeGettingBeforeNew': 'If you would like to start a new one-time connection, press "Stop Getting Access" first.',
  'friendRequestedOneTime': 'Your friend has requested to use your internet connection.',
  'howToOfferOneTime': 'If you\'d like to give them access, copy and paste this URL back to them.',
  'getOneTimeInstead': 'Get access instead',
  'tryingToShareOneTime': 'You are currently in the process of trying to share access. If you would like to get access instead, click the link above.',
  'getOneTimeInsteadInstruction': 'If you would like to start a one-time connection with someone else, press the "Back" button and then "Start a one-time connection" to start a new session.',
  'oneTimeSharing': 'You are currently sharing access.',
  'stopOneTimeSharing': 'Stop sharing access',
  'stopOneTimeSharingBeforeNew': 'If you would like to start a new one-time connection, press "Stop Sharing Access" first.',
  'goBack': 'Go back?',
  'areYouSure': 'Are you sure you want to end this one-time connection?',

  /* Settings panel */
  'nameThisDevice': 'Name this device'

});

i18n.addResources('fr', 'translation', {
  'Good': 'Bien',
  'Bad': 'Mal',
  'Hello': 'Bonjour __name__',
  'Access': 'french __name__ french french.'
});

i18n.addResourceBundle('en-US', 'translation', {
  'Squid': '__count__ Squid',
  'Squid_plural': '__count__ Squids'
});

// If we want to create a global Polymer filter instead:
 declare var PolymerExpressions: any;
 var i18n_t = i18n.t;
 PolymerExpressions.prototype.$$ = i18n_t;

