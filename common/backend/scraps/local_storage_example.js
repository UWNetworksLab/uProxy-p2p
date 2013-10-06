// Mock data for what may live in local storage. (note: values will be strings
// too, via JSON interpretation)
var LOCAL_STORAGE_EXAMPLE = {
  'me': { 'description': 'l\'s Laptop',
          'instanceId': 'mememmemememsdhodafslkffdaslkjfds',
        },
  'options': {
    'allowNonRoutableAddresses': false,
    'stunServers': ['stunServer1', 'stunServer2'],
    'turnServers': ['turnServer1', 'turnServer2']
  },
  // Note invariant: for each instanceIds[X] there should be an entry:
  // 'instance/X': { ... } which holds out local stored knowledge about that
  // instance id.
  'instanceIds': [
    'ssssssssshjafdshjadskfjlkasfs',
    'rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn',
    'qqqqjksdklflsdjkljkfdsa'
  ],
  'instance/ssssssssshjafdshjadskfjlkasfs': {
    'name': 'S',
    'description': 'S\'s home desktop',
    'annotation': 'Cool S who has high bandwidth',
    'instanceId': 'ssssssssshjafdshjadskfjlkasfs',
    'userId': 's@gmail.com',
    'network': 'google',
    'keyhash' : 'HASHssssjklsfjkldfslkfljkdfsklas',
    'trust':
      { 'proxy': 'yes', // 'no' | 'requested' | 'yes'
        'client': 'no' // 'no' | 'requested' | 'yes'
      }
    // 'status' {
       // 'activeProxy': boolean
       // 'activeClient': boolean
    // }
  },
  'instance/r@fmail.com': {
    'name': 'R',
    'description': 'R\'s laptop',
    'annotation': 'R is who is repressed',
    'instanceId': 'rrrrrrhjfhjfjnbmnsbfdbmnfsdambnfdsmn',
    'userId': 'r@facebook.com',
    'network': 'facebook',
    'keyhash' : 'HASHrrrjklsfjkldfslkfljkdfsklas',
    'trust': {
      'proxy': 'no',
      'client': 'yes'
    }
  },
  'instance/qqqqjksdklflsdjkljkfdsa': {
    'name': 'S',
    'description': 'S\'s laptop',
    'annotation': 'S who is on qq',
    'instanceId': 'qqqqjksdklflsdjkljkfdsa',
    'userId': 's@qq',
    'network': 'manual',
    'keyhash' : 'HASHqqqqqjklsfjkldfslkfljkdfsklas',
    'trust': {
      'proxy': 'no',
      'client': 'no'
    }
  }
};


var
