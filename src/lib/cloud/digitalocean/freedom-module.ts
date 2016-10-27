import Provisioner from './provisioner';

declare const freedom: freedom.FreedomInModuleEnv;

freedom().providePromises(Provisioner);

export default Provisioner;
