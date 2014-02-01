/**
 * consentSpec.js
 *
 * Sometimes consent between two instances needs to be resolved after they've
 * been disconnected. This file ensures the logic for resolving the correct
 * trust values works.
 */

var uproxy = this;        // Remember global uproxy context so spyOn works.
var state = store.state;  // Depends on state-storage.js.
var Trust = C.Trust;      // From constants.

describe('consent', function() {
  beforeEach(function() {
  });

  // Given Alice and Bob's consents to proxy through each other, generate the
  // correct Trust stanzas.
  it('composes with another consent into trust', function() {
    expect(_composeTrustFromConsent(
        { asProxy: false, asClient: false },
        { asProxy: false, asClient: false }
    )).toEqual({
        asProxy: Trust.NO,
        asClient: Trust.NO
    });

    expect(_composeTrustFromConsent(
        { asProxy: true, asClient: false },
        { asProxy: false, asClient: false }
    )).toEqual({
        asProxy: Trust.NO,
        asClient: Trust.OFFERED
    });
    expect(_composeTrustFromConsent(
        { asProxy: false, asClient: true },
        { asProxy: false, asClient: false }
    )).toEqual({
        asProxy: Trust.REQUESTED,
        asClient: Trust.NO
    });
    expect(_composeTrustFromConsent(
        { asProxy: false, asClient: false },
        { asProxy: true, asClient: false }
    )).toEqual({
        asProxy: Trust.OFFERED,
        asClient: Trust.NO
    });
    expect(_composeTrustFromConsent(
        { asProxy: false, asClient: false },
        { asProxy: false, asClient: true }
    )).toEqual({
        asProxy: Trust.NO,
        asClient: Trust.REQUESTED
    });

    expect(_composeTrustFromConsent(
        { asProxy: true, asClient: true },
        { asProxy: false, asClient: false }
    )).toEqual({
        asProxy: Trust.REQUESTED,
        asClient: Trust.OFFERED
    });
    expect(_composeTrustFromConsent(
        { asProxy: true, asClient: false },
        { asProxy: true, asClient: false }
    )).toEqual({
        asProxy: Trust.OFFERED,
        asClient: Trust.OFFERED
    });
    expect(_composeTrustFromConsent(
        { asProxy: true, asClient: false },
        { asProxy: false, asClient: true }
    )).toEqual({
        asProxy: Trust.NO,
        asClient: Trust.YES
    });
    expect(_composeTrustFromConsent(
        { asProxy: false, asClient: true },
        { asProxy: true, asClient: false }
    )).toEqual({
        asProxy: Trust.YES,
        asClient: Trust.NO
    });
    expect(_composeTrustFromConsent(
        { asProxy: false, asClient: true },
        { asProxy: false, asClient: true }
    )).toEqual({
        asProxy: Trust.REQUESTED,
        asClient: Trust.REQUESTED
    });
    expect(_composeTrustFromConsent(
        { asProxy: false, asClient: false },
        { asProxy: true, asClient: true }
    )).toEqual({
        asProxy: Trust.OFFERED,
        asClient: Trust.REQUESTED
    });

    expect(_composeTrustFromConsent(
        { asProxy: true, asClient: true },
        { asProxy: true, asClient: false }
    )).toEqual({
        asProxy: Trust.YES,
        asClient: Trust.OFFERED
    });
    expect(_composeTrustFromConsent(
        { asProxy: true, asClient: true },
        { asProxy: false, asClient: true }
    )).toEqual({
        asProxy: Trust.REQUESTED,
        asClient: Trust.YES
    });
    expect(_composeTrustFromConsent(
        { asProxy: true, asClient: false },
        { asProxy: true, asClient: true }
    )).toEqual({
        asProxy: Trust.OFFERED,
        asClient: Trust.YES
    });
    expect(_composeTrustFromConsent(
        { asProxy: false, asClient: true },
        { asProxy: true, asClient: true }
    )).toEqual({
        asProxy: Trust.YES,
        asClient: Trust.REQUESTED
    });

    expect(_composeTrustFromConsent(
        { asProxy: true, asClient: true },
        { asProxy: true, asClient: true }
    )).toEqual({
        asProxy: Trust.YES,
        asClient: Trust.YES
    });

  });

  // Given Alice's trust level for Bob whilst offline, pull out the boolean for
  // only her side - whether or not she consents to being a proxy for Bob, and
  // whether or not she consents to having Bob be her proxy. Since there are 4
  // possible values for each direction (NO, OFFERED, REQUESTED, YES), the
  // cross product generates 16 total combinations.
  it('determined from trust correctly', function() {

    expect(_determineConsent({
        asProxy: Trust.NO,
        asClient: Trust.NO
    })).toEqual({
        asProxy: false,
        asClient: false
    });
    expect(_determineConsent({
        asProxy: Trust.OFFERED,
        asClient: Trust.NO
    })).toEqual({
        asProxy: false,
        asClient: false
    });
    expect(_determineConsent({
        asProxy: Trust.REQUESTED,
        asClient: Trust.NO
    })).toEqual({
        asProxy: false,
        asClient: true
    });
    expect(_determineConsent({
        asProxy: Trust.YES,
        asClient: Trust.NO
    })).toEqual({
        asProxy: false,
        asClient: true
    });

    expect(_determineConsent({
        asProxy: Trust.NO,
        asClient: Trust.OFFERED
    })).toEqual({
        asProxy: true,
        asClient: false
    });
    expect(_determineConsent({
        asProxy: Trust.OFFERED,
        asClient: Trust.OFFERED
    })).toEqual({
        asProxy: true,
        asClient: false
    });
    expect(_determineConsent({
        asProxy: Trust.REQUESTED,
        asClient: Trust.OFFERED
    })).toEqual({
        asProxy: true,
        asClient: true
    });
    expect(_determineConsent({
        asProxy: Trust.YES,
        asClient: Trust.OFFERED
    })).toEqual({
        asProxy: true,
        asClient: true
    });

    expect(_determineConsent({
        asProxy: Trust.NO,
        asClient: Trust.REQUESTED
    })).toEqual({
        asProxy: false,
        asClient: false
    });
    expect(_determineConsent({
        asProxy: Trust.OFFERED,
        asClient: Trust.REQUESTED
    })).toEqual({
        asProxy: false,
        asClient: false
    });
    expect(_determineConsent({
        asProxy: Trust.REQUESTED,
        asClient: Trust.REQUESTED
    })).toEqual({
        asProxy: false,
        asClient: true
    });
    expect(_determineConsent({
        asProxy: Trust.YES,
        asClient: Trust.REQUESTED
    })).toEqual({
        asProxy: false,
        asClient: true
    });

    expect(_determineConsent({
        asProxy: Trust.NO,
        asClient: Trust.YES
    })).toEqual({
        asProxy: true,
        asClient: false
    });
    expect(_determineConsent({
        asProxy: Trust.OFFERED,
        asClient: Trust.YES
    })).toEqual({
        asProxy: true,
        asClient: false
    });
    expect(_determineConsent({
        asProxy: Trust.REQUESTED,
        asClient: Trust.YES
    })).toEqual({
        asProxy: true,
        asClient: true
    });
    expect(_determineConsent({
        asProxy: Trust.YES,
        asClient: Trust.YES
    })).toEqual({
        asProxy: true,
        asClient: true
    });
  });

});  // consent
