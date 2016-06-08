import net = require('../../lib/net/net.types');
import social = require('../../interfaces/social');
import ui_constants = require('../../interfaces/ui');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');

/**
 * Simple utility struct to keep track of state for the copy+paste connection
 */
class CopyPasteState {
  public localGettingFromRemote :social.GettingState = social.GettingState.NONE;
  public localSharingWithRemote :social.SharingState = social.SharingState.NONE;
  public error :ui_constants.CopyPasteError = ui_constants.CopyPasteError.NONE;
  public message :string = null;
  public activeEndpoint :net.Endpoint = null;
  public active :boolean = false;

  public updateFromConnectionState = (state :uproxy_core_api.ConnectionState) :void => {
    this.localGettingFromRemote = state.localGettingFromRemote;
    this.localSharingWithRemote = state.localSharingWithRemote;
    this.activeEndpoint = state.activeEndpoint;
  }
}

export = CopyPasteState;
