
// Entry-point into the UI.
class UIConnector implements user_interface.UiApi {

  /**
   * Send an Update message to the UI.
   * TODO: Turn this private and make outside accesses directly based on UiApi.
   */
  public update = (type:uproxy_core_api.Update, data?:any) => {
    var printableType :string = uproxy_core_api.Update[type];
    if (type == uproxy_core_api.Update.COMMAND_FULFILLED
        && data['command'] == uproxy_core_api.Command.GET_LOGS){
      log.debug('sending logs to UI', {
        type: printableType,
        data: 'logs not printed to prevent duplication if logs are sent again.'
      });
    } else {
      log.debug('sending message to UI', {
        type: printableType,
        data: data
      });
    }
    bgAppPageChannel.emit('' + type, data);
  }

  public sendInitialState = () => {
    // Only send update to UI when global settings have loaded.
    core.loadGlobalSettings.then(() => {
      this.update(
          uproxy_core_api.Update.INITIAL_STATE,
          {
            networkNames: Object.keys(social_network.networks),
            globalSettings: globals.settings,
            onlineNetwork: social_network.getOnlineNetwork()
          });
    });
  }

  public syncUser = (payload:social.UserData) => {
    this.update(uproxy_core_api.Update.USER_FRIEND, payload);
  }
}

export = UIConnector;
