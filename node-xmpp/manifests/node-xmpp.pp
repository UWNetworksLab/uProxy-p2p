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
  exec { "/bin/mkdir node_modules":
    alias => "mkdir",
    cwd => "/home/vagrant",
    require => Package['browserify']
  }

  exec { "/usr/bin/git clone git://github.com/astro/node-xmpp.git":
    alias => "git-xmpp",
    cwd => "/home/vagrant/node_modules",
    require => Exec['mkdir']
  }
  
  exec { "/bin/bash -c '/usr/local/bin/npm install . || :'":
    alias => "npm-setup",
    cwd => "/home/vagrant/node_modules/node-xmpp",
    require => Exec['git-xmpp']
  }
  
  exec { "/usr/local/bin/npm install browserify-override":
    alias => "npm-browserify",
    cwd => "/home/vagrant/node_modules/node-xmpp",
    require => Exec['npm-setup']
  }
  
  exec { "/bin/cp -r /vagrant/chrome-support/* ./":
    alias => "rules",
    cwd => "/home/vagrant/node_modules",
    require => Exec['npm-browserify']
  }
  
  exec { "/usr/local/bin/browserify -p browserify-override -o node-xmpp-browser.js -v lib/node-xmpp-browserify.js":
    alias => "compile",
    cwd => "/home/vagrant/node_modules/node-xmpp",
    require => Exec['rules']
  }
  
  exec { "/bin/cp ./node-xmpp-browser.js /vagrant/":
    alias => "publish",
    cwd => "/home/vagrant/node_modules/node-xmpp",
    require => Exec['compile']
  }
}

include node-xmpp
