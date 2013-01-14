Exec {
    user => "vagrant",
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
