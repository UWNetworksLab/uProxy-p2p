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
  'submitFeedback_sentenceCase': 'Submit feedback',
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
  'errorSigningIn': 'There was a problem signing in to __network__.  Please try again.',

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
  'sharingEnabledTooltip': 'You are available for sharing.',
  'getAccess': 'Get Access',
  'shareAccess': 'Share Access',
  'welcome': 'Welcome to uProxy',
  'welcomeMessage': 'To get started, choose "Get access" or "Share access" and then click on a friend to connect.',
  'alphaMessage': 'This is an alpha release of uProxy. You can help us improve uProxy by sharing anonymous metrics with the development team. Data reported is anonymized by the client and transmitted securely.',
  'moreInformation': 'More information.',
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
  'description': 'Description',
  'save': 'Save',
  'restart': 'Restart',
  'advancedSettings': 'Advanced Settings',
  'advancedSettings_sentenceCase': 'Advanced settings',
  'editAdvancedSettings': 'Edit your settings below',
  'editAdvancedSettingsPlaceholder': 'Edit your settings',
  'settingsSaved': 'Settings saved',
  'settingsBadFormatError': 'Could not set: bad format',
  'settingsJsonError': 'Could not set: JSON value mismatch',
  'set': 'SET',

  /* Splash page and login */
  'aboutUproxy': 'uProxy helps you share your access to the internet or get internet access from friends',
  'next': 'Next',
  'learnMoreUproxy': 'Learn more about uProxy',
  'whichSocialNetwork': 'Where can you find your contacts the quickest?',
  'whySocialNetwork': 'uProxy uses social networks to help you set up connections with your friends',
  'setUpOneTime': 'Set up a one-time connection',
  'weWontPost': 'We won\'t share your data or post publicly without your consent',
  'learnMoreSocial': 'Learn more about social networks',

  /* Troubleshoot dialog */
  'askToAnalyze': 'It could be that your network\'s NAT type is incompatible with uProxy. Would you like uProxy to analyze your network?',
  'analyzingNetwork': 'Analyzing network',
  'analysisResults': 'It looks like you are on a __natType__, which is __natImpact__ interfering with your ability to connect to friends.',
  'moreInfo': 'More info',
  'askToSubmitAnalysis': 'Would you like to submit your NAT type to the uProxy team, to help us better understand the networks our users are on?',
  'veryLikely': 'very likely',
  'possibly': 'possibly',
  'unlikely': 'unlikely',
  'privacyPolicy': 'Privacy policy',

  /* Messages from background page and core */
  'startedProxying': '__name__ started proxying through you',
  'stoppedProxying': '__name__ stopped proxying through you',
  'unableToShareWith': 'Unable to share access with __name__',
  'unableToGetFrom': 'Unable to get access from __name__',
  'gettingAccessFrom': 'Getting access from __name__',
  'sharingAccessWith_one': 'Sharing access with __name__',
  'sharingAccessWith_two': 'Sharing access with __name1__ and __name2__ ',
  'sharingAccessWith_many': 'Sharing access with __name__ and __numOthers__ others ',
  'loggedOut': 'You have been logged out of __network__',
  'grantedAccessNotification': '__name__ granted you access',
  'offeredAccessNotification': '__name__ offered you access',
  'acceptedOfferNotification': '__name__ has accepted your offer for access',
  'requestingAccessNotification': '__name__ is requesting access',
  'descriptionDefault': 'Computer __number__'
});

i18n.addResources('fr', 'translation', {
  /* Frequently used text */
  'done': 'FRDone',
  'yes': 'FRYes',
  'no': 'FRNo',
  'ok': 'FROK',
  'close': 'FRClose',
  'cancel': 'FRCancel',
  'startGetting': 'FRStart getting access',
  'stopGetting': 'FRStop getting access',
  'submitFeedback': 'FRSubmit Feedback',
  'getHelp': 'FRGet Help',
  'logout': 'FRLog-out of uProxy',

  /* Text for getting access */
  'grantedYouAccess': 'FR__name__ has granted you access',
  'tryingToConnect': 'FRTrying to connect to __name__',
  'askingForAccess': 'FRAsking for access',
  'waitingForAccess': 'FRYou will be able to get access when __name__ accepts.',
  'offeredYouAccess': 'FRThey\'ve offered you access.',
  'acceptOffer': 'FRAccept Offer',
  'ignore': 'FRIgnore',
  'stopIgnoringOffers': 'FRStop ignoring offers',
  'askForAccess': 'FRAsk for access',
  'friendOffline': 'FR__name__ is offline',

  /* Text for sharing access */
  'grantedFriendAccess': 'FRYou\'ve given them access.',
  'revokeAccess': 'FRRevoke Access',
  'cancelOffer': 'FRCancel Offer',
  'friendRequestsAccess': 'FR__name__ requests access from you.',
  'grant': 'FRGrant',
  'friendRequestedAccess': 'FRThey requested access through you.',
  'stopIgnoringRequests': 'FRStop ignoring requests',
  'accessNotGranted': 'FRYou have not granted them access.',
  'offerAccess': 'FROffer Access',

  /* Copypaste */
  'shareOneTime': 'FRShare a one-time connection',
  'requestOneTime': 'FRRequest a one-time connection',
  'startOneTime': 'FRStart a one-time connection',
  'errorParsingLink': 'FRThere was an error parsing the uproxy connection link, please try navigating to the link again or asking your friend for a new link.',
  'noLongerGetting': 'FRYou are no longer getting access. To request a connection, click the button below.',
  'startNewConnection': 'FRStart getting a new connection',
  'errorStartingConnection': 'FRThere was an error starting the connection and it had to be terminated. Please try starting another connection.',
  'sendConnectionLink': 'FRTo share your connection, please ask your friend to send you their link.',
  'copyConnectionLink': 'FRTo request access from a friend, copy and paste this URL to them over a secure channel',
  'loading': 'FRLoading...',
  'friendNeedsToClick': 'FRTo finish setting up the connection, your friend needs to click on the link and send you a link from their uProxy client.  When you click on it, you\'ll be ready to start getting access.',
  'oneTimeSuccess': 'FRSuccess! A one-time connection has been established.',
  'startOneTimeInstruction': 'FRTo start getting access from your friend, click the button below.',
  'stopOneTimeInstruction': 'FRTo stop getting access from your friend, click the button below.',
  'oneTimeGetting': 'FRYou are currently getting access.',
  'stopOneTimeGettingBeforeNew': 'FRIf you would like to start a new one-time connection, press "Stop Getting Access" first.',
  'friendRequestedOneTime': 'FRYour friend has requested to use your internet connection.',
  'howToOfferOneTime': 'FRIf you\'d like to give them access, copy and paste this URL back to them.',
  'getOneTimeInstead': 'FRGet access instead',
  'tryingToShareOneTime': 'FRYou are currently in the process of trying to share access. If you would like to get access instead, click the link above.',
  'getOneTimeInsteadInstruction': 'FRIf you would like to start a one-time connection with someone else, press the "Back" button and then "Start a one-time connection" to start a new session.',
  'oneTimeSharing': 'FRYou are currently sharing access.',
  'stopOneTimeSharing': 'FRStop sharing access',
  'stopOneTimeSharingBeforeNew': 'FRIf you would like to start a new one-time connection, press "Stop Sharing Access" first.',
  'goBack': 'FRGo back?',
  'areYouSure': 'FRAre you sure you want to end this one-time connection?',

  /* Submit feedback */
  'submitFeedback_sentenceCase': 'FRSubmit feedback',
  'emailTitle': 'FREmail (optional)',
  'emailPlaceholder': 'FREmail address',
  'feedbackTitle': 'FREnter your feedback below',
  'feedbackPlaceholder': 'FRWrite your feedback',
  'networkAndLogs': 'FRAnalyze network and include logs',
  'PIIMessage': 'FRYour feedback and email address will be sent to uProxy.org. Your logs, network information and email may include personally identifiable information.',
  'thankYou': 'FRThank you!',
  'feedbackSubmitted': 'FRYour feedback has been submitted to the uProxy development team.',
  'emailInsteadTitle': 'FREmail feedback instead?',
  'emailInsteadMessage': 'FROops! We were unable to submit your feedback to uproxy.org. Please copy and paste your feedback in an email to info@uproxy.org.',

  /* Logs */
  'logsTitle': 'FRLogs & Network Analysis',
  'toSendLogs': 'FRTo send your logs to the uProxy team for help:',
  'openFeedback': 'FRopen uProxy and click \'Submit Feedback\'',
  'retrievingLogs': 'FRRetrieving logs and analyzing your network...',

  /* Network */
  'errorSigningIn': 'FRThere was a problem signing in to __network__.  Please try again.',

  /* Reconnect */
  'attemptingReconnect': 'FRAttempting to re-connect.',

  /* Root */
  'cantOpenOneTimeTitle': 'FRCannot open manual connection',
  'cantOpenOneTimeMessage': 'FRIt is not currently possible to open a manual connection at the same time as being signed in to a social network.  To launch a manual connection, please log out through the settings menu and re-paste the link.',
  'statsEnabledTitle': 'FRAnonymous stats enabled',
  'statsEnabledMessage': 'FRThis icon means you have opted in to sharing anonymous statistics with the uProxy team. Click to adjust settings.',
  'statsEnabledTooltip': 'FRYou are sharing anonymous stats.',
  'sharingEnabledTitle': 'FRSharing Enabled',
  'sharingEnabledMessage': 'FRThis icon means you\'re available for sharing access with friends you\'ve offered access to.',
  'sharingEnabledTooltip': 'FRYou are available for sharing.',
  'getAccess': 'FRGet Access',
  'shareAccess': 'FRShare Access',
  'welcome': 'FRWelcome to uProxy',
  'welcomeMessage': 'FRTo get started, choose "Get access" or "Share access" and then click on a friend to connect.',
  'alphaMessage': 'FRThis is an alpha release of uProxy. You can help us improve uProxy by sharing anonymous metrics with the development team. Data reported is anonymized by the client and transmitted securely.',
  'moreInformation': 'FRMore information.',
  'changeStatsChoice': 'FRYou can change your choice at any time, from the Settings menu.',
  'enableMetrics': 'FRWould you like to enable anonymous metrics collection?',
  'imIn': 'FRI\'m in',
  'noThanks': 'FRNo thanks',
  'disconnectedTitle': 'FROops! You\'ve been disconnected from your friend.',
  'disconnectedMessage': 'FRPlease proceed with caution. Your web traffic will no longer be routed through your friend. You may want to close any sensitive windows you have open, before proceeding.',
  'continueBrowsing': 'FRContinue Browsing Without uProxy',
  'sharingUnavailableTitle': 'FRSharing Unavailable',
  'sharingUnavailableMessage': 'FROops! You\'re using Firefox 37, which has a bug that prevents sharing from working (see git.io/vf5x1). This bug is fixed in Firefox 38, so you can enable sharing by upgrading Firefox or switching to Chrome.',
  'unableToGet': 'FRUnable to get access',
  'unableToShare': 'FRUnable to share access',

  /* Roster */
  'loadingFriends': 'FRLoading uProxy friends',
  'noFriendsOnline': 'FRNone of your friends on __network__ are signed into uProxy at this time.',
  'toInviteFriends': 'FRTo invite friends to uProxy, send them a link to https://www.uproxy.org',
  'offers': 'FROffers',
  'requests': 'FRRequests',
  'friendsWhoShare': 'FRFriends you can get access from',
  'friendsWhoCanGet': 'FRFriends who can get access from you',
  'uproxyFriends': 'FRFriends who have uProxy',

  /* Settings panel */
  'connectedWith': 'FRConnected with __network__',
  'nameThisDevice': 'FRName this device',
  'deviceDescription': 'FRDevice description',
  'description': 'FRDescription',
  'save': 'FRSave',
  'restart': 'FRRestart',
  'advancedSettings': 'FRAdvanced Settings',
  'advancedSettings_sentenceCase': 'FRAdvanced settings',
  'editAdvancedSettings': 'FREdit your settings below',
  'editAdvancedSettingsPlaceholder': 'FREdit your settings',
  'settingsSaved': 'FRSettings saved',
  'settingsBadFormatError': 'FRCould not set: bad format',
  'settingsJsonError': 'FRCould not set: JSON value mismatch',
  'set': 'FRSET',

  /* Splash page and login */
  'aboutUproxy': 'FRuProxy helps you share your access to the internet or get internet access from friends',
  'next': 'FRNext',
  'learnMoreUproxy': 'FRLearn more about uProxy',
  'whichSocialNetwork': 'FRWhere can you find your contacts the quickest?',
  'whySocialNetwork': 'FRuProxy uses social networks to help you set up connections with your friends',
  'setUpOneTime': 'FRSet up a one-time connection',
  'weWontPost': 'FRWe won\'t share your data or post publicly without your consent',
  'learnMoreSocial': 'FRLearn more about social networks',

  /* Troubleshoot dialog */
  'askToAnalyze': 'FRIt could be that your network\'s NAT type is incompatible with uProxy. Would you like uProxy to analyze your network?',
  'analyzingNetwork': 'FRAnalyzing network',
  'analysisResults': 'FRIt looks like you are on a __natType__, which is __natImpact__ interfering with your ability to connect to friends.',
  'moreInfo': 'FRMore info',
  'askToSubmitAnalysis': 'FRWould you like to submit your NAT type to the uProxy team, to help us better understand the networks our users are on?',
  'veryLikely': 'FRvery likely',
  'possibly': 'FRpossibly',
  'unlikely': 'FRunlikely',
  'privacyPolicy': 'FRPrivacy policy',

  /* Messages from background page and core */
  'startedProxying': 'FR__name__ started proxying through you',
  'stoppedProxying': 'FR__name__ stopped proxying through you',
  'unableToShareWith': 'FRUnable to share access with __name__',
  'unableToGetFrom': 'FRUnable to get access from __name__',
  'gettingAccessFrom': 'FRGetting access from __name__',
  'sharingAccessWith_one': 'FRSharing access with __name__',
  'sharingAccessWith_two': 'FRSharing access with __name1__ and __name2__ ',
  'sharingAccessWith_many': 'FRSharing access with __name__ and __numOthers__ others ',
  'loggedOut': 'FRYou have been logged out of __network__',
  'grantedAccessNotification': 'FR__name__ granted you access',
  'offeredAccessNotification': 'FR__name__ offered you access',
  'acceptedOfferNotification': 'FR__name__ has accepted your offer for access',
  'requestingAccessNotification': 'FR__name__ is requesting access',
  'descriptionDefault': 'FRComputer __number__'
});

export var i18n_t = i18n.t;
