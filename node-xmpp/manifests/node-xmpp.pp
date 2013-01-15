Exec {
    cwd => "/home/vagrant",
    logoutput => on_failure,
    environment => ["PWD=/home/vagrant", "HOME=/home/vagrant"],
    timeout => 0
}

class { 'nodejs':
  node_ver => 'v0.8.4'
}

package { 'browserify':
  ensure => present,
  provider => 'npm',
  require => Class['nodejs']
}

class node-xmpp {
   exec { "npm install node-xmpp":
        alias => "npm-xmpp",
        cwd => "/home/vagrant",
        require => Package['browserify']
  }
  
  exec { "npm install browserify-override":
    alias => "npm-browserify",
    cwd => "/home/vagrant/node_modules/node-xmpp",
    require => Exec['npm-xmpp']
  }
  
  exec { "cp -r /vagrant/chrome-support/* ./":
    alias => "rules",
    cwd => "/home/vagrant/node_modules",
    require => Exec['npm-browserify']
  }
  
  exec { "browserify -p browserify-override -o node-xmpp-browser.js lib/node-xmpp-browserify.js":
    alias => "compile",
    cwd => "/home/vagrant/node_modules/node-xmpp",
    require => Exec['rules']
  }
  
  exec { "cp node-xmpp-browser.js /vagrant/":
    alias => "publish",
    cwd => "/home/vagrant/node_modules/node-xmpp",
    require => Exec['compile']
  }
}

include node-xmpp