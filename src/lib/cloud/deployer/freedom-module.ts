import * as logging from '../../logging/logging';
import * as loggingTypes from '../../loggingprovider/loggingprovider.types';

declare const freedom: freedom.FreedomInModuleEnv;

const loggingController = freedom['loggingcontroller']();
loggingController.setDefaultFilter(loggingTypes.Destination.console,
                                   loggingTypes.Level.debug);

const log :logging.Log = new logging.Log('deployer');

const provisioner = freedom['digitalocean']();

provisioner.on('status', (msg:any) => {
  log.info('status: %1', msg.message);
});

log.info('deploying...');
// TODO: typings for provisioner return type
provisioner.start('test').then((serverInfo: any) => {
  log.info('server provisioned: %1', serverInfo);

  const installer = freedom['cloudinstall']();

  installer.on('progress', (progress: number) => {
    log.info('install progress: %1', progress);
  });

  log.info('installing...');
  installer.install(serverInfo.network.ipv4, serverInfo.network.ssh_port,
      'root', serverInfo.ssh.private).then((invitation: string) => {
    log.info('uproxy installed! invitation: %1', invitation);
    }, (e: Error) => {
    log.error('failed to install: %1', e.message);
  });
}, (e:Error) => {
  log.error('failed to deploy: %1', e.message);
});
