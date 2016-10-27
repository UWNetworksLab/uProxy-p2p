import * as model from './model';
import Model = model.Model;
import * as ui_constants from '../../interfaces/ui';

describe('model.Model', () => {
  var model :Model;

  beforeEach(() => {
    model = new Model();
  });

  it('Updating global settings correctly updates description', () => {
    // description is chosen here as just some arbitrary simple value
    var newDescription = 'Test description';

    model.updateGlobalSettings({
      description: newDescription
    });

    expect(model.globalSettings.description).toEqual(newDescription);
  });

  it('Updating one field of global settings does not change any other fields', () => {
    var constantString = 'some arbitrary string';

    model.updateGlobalSettings({
      description: constantString
    });

    model.updateGlobalSettings({
      mode: ui_constants.Mode.SHARE
    });

    expect(model.globalSettings.description).toEqual(constantString);
  });

  it('Syncing arrays in global settings works fine', () => {
    var newStunServers = [
      {
        urls: ['something.net:5']
      },
      {
        urls: ['else.net:7']
      }
    ];

    model.updateGlobalSettings({
      stunServers: newStunServers
    });

    expect(model.globalSettings.stunServers.length).toEqual(newStunServers.length);

    for (var i in newStunServers) {
      expect(newStunServers[i]).toEqual(model.globalSettings.stunServers[i]);
    }
  });

  it('Updating global settings does not reassign', () => {
    var a = model.globalSettings;

    model.updateGlobalSettings({
      mode: ui_constants.Mode.SHARE
    });

    expect(model.globalSettings).toEqual(a);
  });
});
