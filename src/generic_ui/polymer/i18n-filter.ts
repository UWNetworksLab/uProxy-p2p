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
  'ok': 'OK',
  'close': 'Close',
  'cancel': 'Cancel',
  'startGetting': 'Start getting access',
  'stopGetting': 'Stop getting access',
  'submitFeedback': 'Submit Feedback',
  'getHelp': 'Get Help',
  'logout': 'Log-out of uProxy',

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
  'friendOffline': '__name__ is offline',

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

  /* Submit feedback */
  'emailTitle': 'Email (optional)',
  'emailPlaceholder': 'Email address',
  'feedbackTitle': 'Enter your feedback below',
  'feedbackPlaceholder': 'Write your feedback',
  'networkAndLogs': 'Analyze network and include logs',
  'PIIMessage': 'Your feedback and email address will be sent to uProxy.org. Your logs, network information and email may include personally identifiable information.',
  'thankYou': 'Thank you!',
  'feedbackSubmitted': 'Your feedback has been submitted to the uProxy development team.',
  'emailInsteadTitle': 'Email feedback instead?',
  'emailInsteadMessage': 'Oops! We were unable to submit your feedback to uproxy.org. Please copy and paste your feedback in an email to info@uproxy.org.',

  /* Logs */
  'logsTitle': 'Logs & Network Analysis',
  'toSendLogs': 'To send your logs to the uProxy team for help:',
  'openFeedback': 'open uProxy and click \'Submit Feedback\'',
  'retrievingLogs': 'Retrieving logs and analyzing your network...',

  /* Network */
  'submitFeedback': 'There was a problem signing in to __network__.  Please try again.',

  /* Reconnect */
  'attemptingReconnect': 'Attempting to re-connect.',

  /* Root */
  'cantOpenOneTimeTitle': 'Cannot open manual connection',
  'cantOpenOneTimeMessage': 'It is not currently possible to open a manual connection at the same time as being signed in to a social network.  To launch a manual connection, please log out through the settings menu and re-paste the link.',
  'statsEnabledTitle': 'Anonymous stats enabled',
  'statsEnabledMessage': 'This icon means you have opted in to sharing anonymous statistics with the uProxy team. Click to adjust settings.',
  'statsEnabledTooltip': 'You are sharing anonymous stats.',
  'sharingEnabledTitle': 'Sharing Enabled',
  'sharingEnabledMessage': 'This icon means you\'re available for sharing access with friends you\'ve offered access to.',
  'statsEnabledTooltip': 'You are available for sharing.',
  'getAccess': 'Get Access',
  'shareAccess': 'Share Access',
  'welcome': 'Welcome to uProxy',
  'welcomeMessage': 'To get started, choose "Get access" or "Share access" and then click on a friend to connect.',
  'alphaMessage': 'This is an alpha release of uProxy. You can help us improve uProxy by sharing anonymous metrics with the development team. Data reported is anonymized by the client and transmitted securely.',
  'moreInfo': 'More information.',
  'changeStatsChoice': 'You can change your choice at any time, from the Settings menu.',
  'enableMetrics': 'Would you like to enable anonymous metrics collection?',
  'imIn': 'I\'m in',
  'noThanks': 'No thanks',
  'disconnectedTitle': 'Oops! You\'ve been disconnected from your friend.',
  'disconnectedMessage': 'Please proceed with caution. Your web traffic will no longer be routed through your friend. You may want to close any sensitive windows you have open, before proceeding.',
  'continueBrowsing': 'Continue Browsing Without uProxy',
  'sharingUnavailableTitle': 'Sharing Unavailable',
  'sharingUnavailableMessage': 'Oops! You\'re using Firefox 37, which has a bug that prevents sharing from working (see git.io/vf5x1). This bug is fixed in Firefox 38, so you can enable sharing by upgrading Firefox or switching to Chrome.',
  'unableToGet': 'Unable to get access',
  'unableToShare': 'Unable to share access',

  /* Roster */
  'loadingFriends': 'Loading uProxy friends',
  'noFriendsOnline': 'None of your friends on __network__ are signed into uProxy at this time.',
  'toInviteFriends': 'To invite friends to uProxy, send them a link to https://www.uproxy.org',
  'offers': 'Offers',
  'requests': 'Requests',
  'friendsWhoShare': 'Friends you can get access from',
  'friendsWhoCanGet': 'Friends who can get access from you',
  'uproxyFriends': 'Friends who have uProxy',

  /* Settings panel */
  'connectedWith': 'Connected with __network__',
  'nameThisDevice': 'Name this device',
  'deviceDescription': 'Device description',
  'advancedSettings': 'Advanced Settings',
  'restart': 'Restart',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',

  /* Submit feedback */
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
  'submitFeedback': 'Submit feedback',
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

