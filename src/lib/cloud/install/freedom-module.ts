import CloudInstaller from './installer';

declare const freedom: freedom.FreedomInModuleEnv;

freedom().providePromises(CloudInstaller);

export default CloudInstaller;
