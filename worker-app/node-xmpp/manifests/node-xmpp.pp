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
  file { "/home/vagrant/node_modules":
    alias => "base",
    ensure => "directory",
    require => Package['browserify']
  }

  exec { "/usr/bin/git clone git://github.com/astro/node-xmpp.git":
    alias => "git-xmpp",
    cwd => "/home/vagrant/node_modules",
    creates => "/home/vagrant/node_modules/node-xmpp",
    require => File['base']
  }
  
  exec { "/usr/bin/git pull origin master":
    alias => "git-update",
    cwd => "/home/vagrant/node_modules/node-xmpp",
    require => Exec['git-xmpp']
  }
  
  exec { "/bin/bash -c '/usr/local/bin/npm install . || :'":
    alias => "npm-setup",
    cwd => "/home/vagrant/node_modules/node-xmpp",
    creates => "/home/vagrant/node_modules/node-xmpp/node_modules",
    require => Exec['git-update']
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
  
  exec { "/usr/local/bin/browserify -p browserify-override -o node-xmpp-browser.js lib/node-xmpp-browserify.js":
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
