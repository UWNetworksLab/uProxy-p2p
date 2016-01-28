/**
* Temporary hack until cordova-plugin-iosrtc version 2.2.3 is released. 
*/

cordova.define("cordova-plugin-iosrtc.Plugin", function(require, exports, module) { /*
 * cordova-plugin-iosrtc v2.2.2
 * Cordova iOS plugin exposing the full WebRTC W3C JavaScript APIs
 * Copyright 2015 Iñaki Baz Castillo at eFace2Face, inc. (https://eface2face.com)
 * License MIT
 */

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.iosrtc = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Expose an object with WebRTC Errors.
 */
var Errors = module.exports = {},


/**
 * Local variables.
 */
	IntermediateInheritor = function () {};


IntermediateInheritor.prototype = Error.prototype;


/**
 * Create error classes.
 */
addError('InvalidStateError');
addError('InvalidSessionDescriptionError');
addError('InternalError');
addError('MediaStreamError');


function addError(name) {
	Errors[name] = function () {
		var tmp = Error.apply(this, arguments);

		this.name = tmp.name = name;
		this.message = tmp.message;

		Object.defineProperty(this, 'stack', {
			get: function () {
				return tmp.stack;
			}
		});

		return this;
	};

	Errors[name].prototype = new IntermediateInheritor();
}

},{}],2:[function(require,module,exports){
/**
 * Expose the MediaDeviceInfo class.
 */
module.exports = MediaDeviceInfo;


function MediaDeviceInfo(data) {
	data = data || {};

	Object.defineProperties(this, {
		// MediaDeviceInfo spec.
		deviceId: {
			value: data.deviceId
		},
		kind: {
			value: data.kind
		},
		label: {
			value: data.label
		},
		groupId: {
			value: data.groupId || ''
		},
		// SourceInfo old spec.
		id: {
			value: data.deviceId
		},
		facing: {
			value: ''
		}
	});
}

},{}],3:[function(require,module,exports){
/**
 * Expose the MediaStream class.
 * Make MediaStream be a Blob so it can be consumed by URL.createObjectURL().
 */
var MediaStream = module.exports = window.Blob,


/**
 * Spec: http://w3c.github.io/mediacapture-main/#mediastream
 */


/**
 * Dependencies.
 */
	debug = require('debug')('iosrtc:MediaStream'),
	exec = require('cordova/exec'),
	EventTarget = require('yaeti').EventTarget,
	MediaStreamTrack = require('./MediaStreamTrack'),


/**
 * Local variables.
 */

	// Dictionary of MediaStreams (provided via setMediaStreams() class method).
	// - key: MediaStream blobId.
	// - value: MediaStream.
	mediaStreams;


/**
 * Class methods.
 */


MediaStream.setMediaStreams = function (_mediaStreams) {
	mediaStreams = _mediaStreams;
};


MediaStream.create = function (dataFromEvent) {
	debug('create() | [dataFromEvent:%o]', dataFromEvent);

	var stream,
		blobId = 'MediaStream_' + dataFromEvent.id,
		trackId,
		track;

	// Note that this is the Blob constructor.
	stream = new MediaStream([blobId], {
		type: 'stream'
	});

	// Store the stream into the dictionary.
	mediaStreams[blobId] = stream;

	// Make it an EventTarget.
	EventTarget.call(stream);

	// Public atributes.
	stream.id = dataFromEvent.id;
	stream.label = dataFromEvent.id;  // Backwards compatibility.
	stream.active = true;

	// Public but internal attributes.
	stream.connected = false;

	// Private attributes.
	stream._blobId = blobId;
	stream._audioTracks = {};
	stream._videoTracks = {};

	for (trackId in dataFromEvent.audioTracks) {
		if (dataFromEvent.audioTracks.hasOwnProperty(trackId)) {
			track = new MediaStreamTrack(dataFromEvent.audioTracks[trackId]);

			stream._audioTracks[track.id] = track;

			addListenerForTrackEnded.call(stream, track);
		}
	}

	for (trackId in dataFromEvent.videoTracks) {
		if (dataFromEvent.videoTracks.hasOwnProperty(trackId)) {
			track = new MediaStreamTrack(dataFromEvent.videoTracks[trackId]);

			stream._videoTracks[track.id] = track;

			addListenerForTrackEnded.call(stream, track);
		}
	}

	function onResultOK(data) {
		onEvent.call(stream, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'MediaStream_setListener', [stream.id]);

	return stream;
};


MediaStream.prototype.getAudioTracks = function () {
	debug('getAudioTracks()');

	var tracks = [],
		id;

	for (id in this._audioTracks) {
		if (this._audioTracks.hasOwnProperty(id)) {
			tracks.push(this._audioTracks[id]);
		}
	}

	return tracks;
};


MediaStream.prototype.getVideoTracks = function () {
	debug('getVideoTracks()');

	var tracks = [],
		id;

	for (id in this._videoTracks) {
		if (this._videoTracks.hasOwnProperty(id)) {
			tracks.push(this._videoTracks[id]);
		}
	}

	return tracks;
};


MediaStream.prototype.getTracks = function () {
	debug('getTracks()');

	var tracks = [],
		id;

	for (id in this._audioTracks) {
		if (this._audioTracks.hasOwnProperty(id)) {
			tracks.push(this._audioTracks[id]);
		}
	}

	for (id in this._videoTracks) {
		if (this._videoTracks.hasOwnProperty(id)) {
			tracks.push(this._videoTracks[id]);
		}
	}

	return tracks;
};


MediaStream.prototype.getTrackById = function (id) {
	debug('getTrackById()');

	return this._audioTracks[id] || this._videoTracks[id] || null;
};


MediaStream.prototype.addTrack = function (track) {
	debug('addTrack() [track:%o]', track);

	if (!(track instanceof MediaStreamTrack)) {
		throw new Error('argument must be an instance of MediaStreamTrack');
	}

	if (this._audioTracks[track.id] || this._videoTracks[track.id]) {
		return;
	}

	if (track.kind === 'audio') {
		this._audioTracks[track.id] = track;
	} else if (track.kind === 'video') {
		this._videoTracks[track.id] = track;
	} else {
		throw new Error('unknown kind attribute: ' + track.kind);
	}

	addListenerForTrackEnded.call(this, track);

	exec(null, null, 'iosrtcPlugin', 'MediaStream_addTrack', [this.id, track.id]);
};


MediaStream.prototype.removeTrack = function (track) {
	debug('removeTrack() [track:%o]', track);

	if (!(track instanceof MediaStreamTrack)) {
		throw new Error('argument must be an instance of MediaStreamTrack');
	}

	if (!this._audioTracks[track.id] && !this._videoTracks[track.id]) {
		return;
	}

	if (track.kind === 'audio') {
		delete this._audioTracks[track.id];
	} else if (track.kind === 'video') {
		delete this._videoTracks[track.id];
	} else {
		throw new Error('unknown kind attribute: ' + track.kind);
	}

	exec(null, null, 'iosrtcPlugin', 'MediaStream_removeTrack', [this.id, track.id]);

	checkActive.call(this);
};


// Backwards compatible API.
MediaStream.prototype.stop = function () {
	debug('stop()');

	var trackId;

	for (trackId in this._audioTracks) {
		if (this._audioTracks.hasOwnProperty(trackId)) {
			this._audioTracks[trackId].stop();
		}
	}

	for (trackId in this._videoTracks) {
		if (this._videoTracks.hasOwnProperty(trackId)) {
			this._videoTracks[trackId].stop();
		}
	}
};


// TODO: API methods and events.


/**
 * Private API.
 */


MediaStream.prototype.emitConnected = function () {
	debug('emitConnected()');

	var self = this;

	if (this.connected) {
		return;
	}
	this.connected = true;

	setTimeout(function () {
		self.dispatchEvent(new Event('connected'));
	});
};


function addListenerForTrackEnded(track) {
	var self = this;

	track.addEventListener('ended', function () {
		if (track.kind === 'audio' && !self._audioTracks[track.id]) {
			return;
		} else if (track.kind === 'video' && !self._videoTracks[track.id]) {
			return;
		}

		checkActive.call(self);
	});
}


function checkActive() {
	// A MediaStream object is said to be active when it has at least one MediaStreamTrack
	// that has not ended. A MediaStream that does not have any tracks or only has tracks
	// that are ended is inactive.

	var self = this,
		trackId;

	if (!this.active) {
		return;
	}

	if (Object.keys(this._audioTracks).length === 0 && Object.keys(this._videoTracks).length === 0) {
		debug('no tracks, releasing MediaStream');

		release();
		return;
	}

	for (trackId in this._audioTracks) {
		if (this._audioTracks.hasOwnProperty(trackId)) {
			if (this._audioTracks[trackId].readyState !== 'ended') {
				return;
			}
		}
	}

	for (trackId in this._videoTracks) {
		if (this._videoTracks.hasOwnProperty(trackId)) {
			if (this._videoTracks[trackId].readyState !== 'ended') {
				return;
			}
		}
	}

	debug('all tracks are ended, releasing MediaStream');
	release();

	function release() {
		self.active = false;
		self.dispatchEvent(new Event('inactive'));

		// Remove the stream from the dictionary.
		delete mediaStreams[self._blobId];

		exec(null, null, 'iosrtcPlugin', 'MediaStream_release', [self.id]);
	}
}


function onEvent(data) {
	var type = data.type,
		event,
		track;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	switch (type) {
		case 'addtrack':
			track = new MediaStreamTrack(data.track);

			if (track.kind === 'audio') {
				this._audioTracks[track.id] = track;
			} else if (track.kind === 'video') {
				this._videoTracks[track.id] = track;
			}
			addListenerForTrackEnded.call(this, track);

			event = new Event('addtrack');
			event.track = track;

			this.dispatchEvent(event);

			// Also emit 'update' for the MediaStreamRenderer.
			this.dispatchEvent(new Event('update'));
			break;

		case 'removetrack':
			if (data.track.kind === 'audio') {
				track = this._audioTracks[data.track.id];
				delete this._audioTracks[data.track.id];
			} else if (data.track.kind === 'video') {
				track = this._videoTracks[data.track.id];
				delete this._videoTracks[data.track.id];
			}

			if (!track) {
				throw new Error('"removetrack" event fired on MediaStream for a non existing MediaStreamTrack');
			}

			event = new Event('removetrack');
			event.track = track;

			this.dispatchEvent(event);
			// Also emit 'update' for the MediaStreamRenderer.
			this.dispatchEvent(new Event('update'));

			// Check whether the MediaStream still is active.
			checkActive.call(this);
			break;
	}
}

},{"./MediaStreamTrack":5,"cordova/exec":undefined,"debug":15,"yaeti":20}],4:[function(require,module,exports){
/**
 * Expose the MediaStreamRenderer class.
 */
module.exports = MediaStreamRenderer;


/**
 * Dependencies.
 */
var
	debug = require('debug')('iosrtc:MediaStreamRenderer'),
	exec = require('cordova/exec'),
	randomNumber = require('random-number').generator({min: 10000, max: 99999, integer: true}),
	EventTarget = require('yaeti').EventTarget,
	MediaStream = require('./MediaStream');


function MediaStreamRenderer(element) {
	debug('new() | [element:"%s"]', element);

	var self = this;

	// Make this an EventTarget.
	EventTarget.call(this);

	if (!(element instanceof HTMLElement)) {
		throw new Error('a valid HTMLElement is required');
	}

	// Public atributes.
	this.element = element;
	this.stream = undefined;
	this.videoWidth = undefined;
	this.videoHeight = undefined;

	// Private attributes.
	this.id = randomNumber();

	function onResultOK(data) {
		onEvent.call(self, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'new_MediaStreamRenderer', [this.id]);

	this.refresh(this);
}


MediaStreamRenderer.prototype.render = function (stream) {
	debug('render() [stream:%o]', stream);

	var self = this;

	if (!(stream instanceof MediaStream)) {
		throw new Error('render() requires a MediaStream instance as argument');
	}

	this.stream = stream;

	exec(null, null, 'iosrtcPlugin', 'MediaStreamRenderer_render', [this.id, stream.id]);

	// Subscribe to 'update' event so we call native mediaStreamChanged() on it.
	stream.addEventListener('update', function () {
		if (self.stream !== stream) {
			return;
		}

		debug('MediaStream emits "update", calling native mediaStreamChanged()');

		exec(null, null, 'iosrtcPlugin', 'MediaStreamRenderer_mediaStreamChanged', [self.id]);
	});

	// Subscribe to 'inactive' event and emit "close" so the video element can react.
	stream.addEventListener('inactive', function () {
		if (self.stream !== stream) {
			return;
		}

		debug('MediaStream emits "inactive", emiting "close" and closing this MediaStreamRenderer');

		self.dispatchEvent(new Event('close'));
		self.close();
	});

	if (stream.connected) {
		connected();
	// Otherwise subscribe to 'connected' event to emulate video elements events.
	} else {
		stream.addEventListener('connected', function () {
			if (self.stream !== stream) {
				return;
			}

			connected();
		});
	}

	function connected() {
		// Emit video events.
		self.element.dispatchEvent(new Event('loadedmetadata'));
		self.element.dispatchEvent(new Event('loadeddata'));
		self.element.dispatchEvent(new Event('canplay'));
		self.element.dispatchEvent(new Event('canplaythrough'));
	}
};


MediaStreamRenderer.prototype.refresh = function () {
	debug('refresh()');

	var elementPositionAndSize = getElementPositionAndSize.call(this),
		computedStyle,
		videoRatio,
		elementRatio,
		elementLeft = elementPositionAndSize.left,
		elementTop = elementPositionAndSize.top,
		elementWidth = elementPositionAndSize.width,
		elementHeight = elementPositionAndSize.height,
		videoViewWidth,
		videoViewHeight,
		visible,
		opacity,
		zIndex,
		mirrored,
		objectFit,
		clip,
		borderRadius,
		paddingTop,
		paddingBottom,
		paddingLeft,
		paddingRight;

	computedStyle = window.getComputedStyle(this.element);

	// get padding values
	paddingTop = parseInt(computedStyle.paddingTop) | 0;
	paddingBottom = parseInt(computedStyle.paddingBottom) | 0;
	paddingLeft = parseInt(computedStyle.paddingLeft) | 0;
	paddingRight = parseInt(computedStyle.paddingRight) | 0;

	// fix position according to padding
	elementLeft += paddingLeft;
	elementTop += paddingTop;

	// fix width and height according to padding
	elementWidth -= (paddingLeft + paddingRight);
	elementHeight -= (paddingTop + paddingBottom);

	videoViewWidth = elementWidth;
	videoViewHeight = elementHeight;

	// visible
	if (computedStyle.visibility === 'hidden') {
		visible = false;
	} else {
		visible = !!this.element.offsetHeight;  // Returns 0 if element or any parent is hidden.
	}

	// opacity
	opacity = parseFloat(computedStyle.opacity);

	// zIndex
	zIndex = parseFloat(computedStyle.zIndex) || parseFloat(this.element.style.zIndex) || 0;

	// mirrored (detect "-webkit-transform: scaleX(-1);" or equivalent)
	if (computedStyle.transform === 'matrix(-1, 0, 0, 1, 0, 0)' ||
		computedStyle['-webkit-transform'] === 'matrix(-1, 0, 0, 1, 0, 0)') {
		mirrored = true;
	} else {
		mirrored = false;
	}

	// objectFit ('contain' is set as default value)
	objectFit = computedStyle.objectFit || 'contain';

	// clip
	if (objectFit === 'none') {
		clip = false;
	} else {
		clip = true;
	}

	// borderRadius
	borderRadius = parseFloat(computedStyle.borderRadius);
	if (/%$/.test(borderRadius)) {
		borderRadius = Math.min(elementHeight, elementWidth) * borderRadius;
	}

	/**
	 * No video yet, so just update the UIView with the element settings.
	 */

	if (!this.videoWidth || !this.videoHeight) {
		debug('refresh() | no video track yet');

		nativeRefresh.call(this);
		return;
	}

	videoRatio = this.videoWidth / this.videoHeight;

	/**
	 * Element has no width and/or no height.
	 */

	if (!elementWidth || !elementHeight) {
		debug('refresh() | video element has 0 width and/or 0 height');

		nativeRefresh.call(this);
		return;
	}

	/**
	 * Set video view position and size.
	 */

	elementRatio = elementWidth / elementHeight;

	switch (objectFit) {
		case 'cover':
			// The element has higher or equal width/height ratio than the video.
			if (elementRatio >= videoRatio) {
				videoViewWidth = elementWidth;
				videoViewHeight = videoViewWidth / videoRatio;
			// The element has lower width/height ratio than the video.
			} else if (elementRatio < videoRatio) {
				videoViewHeight = elementHeight;
				videoViewWidth = videoViewHeight * videoRatio;
			}
			break;

		case 'fill':
			videoViewHeight = elementHeight;
			videoViewWidth = elementWidth;
			break;

		case 'none':
			videoViewHeight = this.videoHeight;
			videoViewWidth = this.videoWidth;
			break;

		case 'scale-down':
			// Same as 'none'.
			if (this.videoWidth <= elementWidth && this.videoHeight <= elementHeight) {
				videoViewHeight = this.videoHeight;
				videoViewWidth = this.videoWidth;
			// Same as 'contain'.
			} else {
				// The element has higher or equal width/height ratio than the video.
				if (elementRatio >= videoRatio) {
					videoViewHeight = elementHeight;
					videoViewWidth = videoViewHeight * videoRatio;
				// The element has lower width/height ratio than the video.
				} else if (elementRatio < videoRatio) {
					videoViewWidth = elementWidth;
					videoViewHeight = videoViewWidth / videoRatio;
				}
			}
			break;

		// 'contain'.
		default:
			objectFit = 'contain';
			// The element has higher or equal width/height ratio than the video.
			if (elementRatio >= videoRatio) {
				videoViewHeight = elementHeight;
				videoViewWidth = videoViewHeight * videoRatio;
			// The element has lower width/height ratio than the video.
			} else if (elementRatio < videoRatio) {
				videoViewWidth = elementWidth;
				videoViewHeight = videoViewWidth / videoRatio;
			}
			break;
	}

	nativeRefresh.call(this);

	function nativeRefresh() {
		var data = {
			elementLeft: elementLeft,
			elementTop: elementTop,
			elementWidth: elementWidth,
			elementHeight: elementHeight,
			videoViewWidth: videoViewWidth,
			videoViewHeight: videoViewHeight,
			visible: visible,
			opacity: opacity,
			zIndex: zIndex,
			mirrored: mirrored,
			objectFit: objectFit,
			clip: clip,
			borderRadius: borderRadius
		};

		debug('refresh() | [data:%o]', data);

		exec(null, null, 'iosrtcPlugin', 'MediaStreamRenderer_refresh', [this.id, data]);
	}
};


MediaStreamRenderer.prototype.close = function () {
	debug('close()');

	if (!this.stream) {
		return;
	}
	this.stream = undefined;

	exec(null, null, 'iosrtcPlugin', 'MediaStreamRenderer_close', [this.id]);
};


/**
 * Private API.
 */


function onEvent(data) {
	var type = data.type,
		event;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	switch (type) {
		case 'videoresize':
			this.videoWidth = data.size.width;
			this.videoHeight = data.size.height;
			this.refresh(this);

			event = new Event(type);
			event.videoWidth = data.size.width;
			event.videoHeight = data.size.height;
			this.dispatchEvent(event);

			break;
	}
}


function getElementPositionAndSize() {
	var rect = this.element.getBoundingClientRect();

	return {
		left:   rect.left + this.element.clientLeft,
		top:    rect.top + this.element.clientTop,
		width:  this.element.clientWidth,
		height: this.element.clientHeight
	};
}

},{"./MediaStream":3,"cordova/exec":undefined,"debug":15,"random-number":19,"yaeti":20}],5:[function(require,module,exports){
/**
 * Expose the MediaStreamTrack class.
 */
module.exports = MediaStreamTrack;


/**
 * Spec: http://w3c.github.io/mediacapture-main/#mediastreamtrack
 */


/**
 * Dependencies.
 */
var
	debug = require('debug')('iosrtc:MediaStreamTrack'),
	exec = require('cordova/exec'),
	enumerateDevices = require('./enumerateDevices'),
	EventTarget = require('yaeti').EventTarget;


function MediaStreamTrack(dataFromEvent) {
	debug('new() | [dataFromEvent:%o]', dataFromEvent);

	var self = this;

	// Make this an EventTarget.
	EventTarget.call(this);

	// Public atributes.
	this.id = dataFromEvent.id;  // NOTE: It's a string.
	this.kind = dataFromEvent.kind;
	this.label = dataFromEvent.label;
	this.muted = false;  // TODO: No "muted" property in ObjC API.
	this.readyState = dataFromEvent.readyState;

	// Private attributes.
	this._enabled = dataFromEvent.enabled;
	this._ended = false;

	function onResultOK(data) {
		onEvent.call(self, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'MediaStreamTrack_setListener', [this.id]);
}


// Setters.
Object.defineProperty(MediaStreamTrack.prototype, 'enabled', {
	get: function () {
		return this._enabled;
	},
	set: function (value) {
		debug('enabled = %s', !!value);

		this._enabled = !!value;
		exec(null, null, 'iosrtcPlugin', 'MediaStreamTrack_setEnabled', [this.id, this._enabled]);
	}
});


MediaStreamTrack.prototype.stop = function () {
	debug('stop()');

	if (this._ended) {
		return;
	}

	exec(null, null, 'iosrtcPlugin', 'MediaStreamTrack_stop', [this.id]);
};


// TODO: API methods and events.


/**
 * Class methods.
 */


MediaStreamTrack.getSources = function () {
	debug('getSources()');

	return enumerateDevices.apply(this, arguments);
};


/**
 * Private API.
 */


function onEvent(data) {
	var type = data.type;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	switch (type) {
		case 'statechange':
			this.readyState = data.readyState;
			this._enabled = data.enabled;

			switch (data.readyState) {
				case 'initializing':
					break;
				case 'live':
					break;
				case 'ended':
					this._ended = true;
					this.dispatchEvent(new Event('ended'));
					break;
				case 'failed':
					break;
			}
			break;
	}
}

},{"./enumerateDevices":10,"cordova/exec":undefined,"debug":15,"yaeti":20}],6:[function(require,module,exports){
/**
 * Expose the RTCDataChannel class.
 */
module.exports = RTCDataChannel;


/**
 * Dependencies.
 */
var
	debug = require('debug')('iosrtc:RTCDataChannel'),
	debugerror = require('debug')('iosrtc:ERROR:RTCDataChannel'),
	exec = require('cordova/exec'),
	randomNumber = require('random-number').generator({min: 10000, max: 99999, integer: true}),
	EventTarget = require('yaeti').EventTarget;


debugerror.log = console.warn.bind(console);


function RTCDataChannel(peerConnection, label, options, dataFromEvent) {
	var self = this;

	// Make this an EventTarget.
	EventTarget.call(this);

	// Created via pc.createDataChannel().
	if (!dataFromEvent) {
		debug('new() | [label:%o, options:%o]', label, options);

		//if (!label || typeof label !== 'string') {
    if ((!label && label !== "") || typeof label !== 'string'){
      throw new Error('label argument required');
		}

		options = options || {};

		if (options.hasOwnProperty('maxPacketLifeTime') && options.hasOwnProperty('maxRetransmits')) {
			throw new SyntaxError('both maxPacketLifeTime and maxRetransmits can not be present');
		}

		if (options.hasOwnProperty('id')) {
			if (typeof options.id !== 'number' || isNaN(options.id) || options.id < 0) {
				throw new SyntaxError('id must be a number');
			}
			// TODO:
			//   https://code.google.com/p/webrtc/issues/detail?id=4618
			if (options.id > 1023) {
				throw new SyntaxError('id cannot be greater than 1023 (https://code.google.com/p/webrtc/issues/detail?id=4614)');
			}
		}

		// Public atributes.
		this.label = label;
		this.ordered = options.hasOwnProperty('ordered') ? !!options.ordered : true;
		this.maxPacketLifeTime = options.hasOwnProperty('maxPacketLifeTime') ? Number(options.maxPacketLifeTime) : null;
		this.maxRetransmits = options.hasOwnProperty('maxRetransmits') ? Number(options.maxRetransmits) : null;
		this.protocol = options.hasOwnProperty('protocol') ? String(options.protocol) : '';
		this.negotiated = options.hasOwnProperty('negotiated') ? !!options.negotiated : false;
		this.id = options.hasOwnProperty('id') ? Number(options.id) : undefined;
		this.readyState = 'connecting';
		this.bufferedAmount = 0;

		// Private attributes.
		this.peerConnection = peerConnection;
		this.dcId = randomNumber();

		exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_createDataChannel', [this.peerConnection.pcId, this.dcId, label, options]);
	// Created via pc.ondatachannel.
	} else {
		debug('new() | [dataFromEvent:%o]', dataFromEvent);

		// Public atributes.
		this.label = dataFromEvent.label;
		this.ordered = dataFromEvent.ordered;
		this.maxPacketLifeTime = dataFromEvent.maxPacketLifeTime;
		this.maxRetransmits = dataFromEvent.maxRetransmits;
		this.protocol = dataFromEvent.protocol;
		this.negotiated = dataFromEvent.negotiated;
		this.id = dataFromEvent.id;
		this.readyState = dataFromEvent.readyState;
		this.bufferedAmount = dataFromEvent.bufferedAmount;

		// Private attributes.
		this.peerConnection = peerConnection;
		this.dcId = dataFromEvent.dcId;

		exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_setListener', [this.peerConnection.pcId, this.dcId]);
	}

	function onResultOK(data) {
		if (data.type) {
			onEvent.call(self, data);
		// Special handler for received binary mesage.
		} else {
			onEvent.call(self, {
				type: 'message',
				message: data
			});
		}
	}
}


// Just 'arraybuffer' binaryType is implemented in Chromium.
Object.defineProperty(RTCDataChannel.prototype, 'binaryType', {
	get: function () {
		return 'arraybuffer';
	},
	set: function (type) {
		if (type !== 'arraybuffer') {
			throw new Error('just "arraybuffer" is implemented for binaryType');
		}
	}
});


RTCDataChannel.prototype.send = function (data) {
	if (isClosed.call(this) || this.readyState !== 'open') {
		return;
	}

	debug('send() | [data:%o]', data);

	if (!data) {
		return;
	}

	var self = this;

	function onResultOK(data) {
		self.bufferedAmount = data.bufferedAmount;
	}

	if (typeof data === 'string' || data instanceof String) {
		exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_sendString', [this.peerConnection.pcId, this.dcId, data]);
	} else if (window.ArrayBuffer && data instanceof window.ArrayBuffer) {
		exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_sendBinary', [this.peerConnection.pcId, this.dcId, data]);
	} else if (
		(window.Int8Array && data instanceof window.Int8Array) ||
		(window.Uint8Array && data instanceof window.Uint8Array) ||
		(window.Uint8ClampedArray && data instanceof window.Uint8ClampedArray) ||
		(window.Int16Array && data instanceof window.Int16Array) ||
		(window.Uint16Array && data instanceof window.Uint16Array) ||
		(window.Int32Array && data instanceof window.Int32Array) ||
		(window.Uint32Array && data instanceof window.Uint32Array) ||
		(window.Float32Array && data instanceof window.Float32Array) ||
		(window.Float64Array && data instanceof window.Float64Array) ||
		(window.DataView && data instanceof window.DataView)
	) {
		exec(onResultOK, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_sendBinary', [this.peerConnection.pcId, this.dcId, data.buffer]);
	} else {
		throw new Error('invalid data type');
	}
};


RTCDataChannel.prototype.close = function () {
	if (isClosed.call(this)) {
		return;
	}

	debug('close()');

	this.readyState = 'closing';

	exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_RTCDataChannel_close', [this.peerConnection.pcId, this.dcId]);
};


/**
 * Private API.
 */


function isClosed() {
	return this.readyState === 'closed' || this.readyState === 'closing' || this.peerConnection.signalingState === 'closed';
}


function onEvent(data) {
	var type = data.type,
		event;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	switch (type) {
		case 'new':
			// Update properties and exit without firing the event.
			this.ordered = data.channel.ordered;
			this.maxPacketLifeTime = data.channel.maxPacketLifeTime;
			this.maxRetransmits = data.channel.maxRetransmits;
			this.protocol = data.channel.protocol;
			this.negotiated = data.channel.negotiated;
			this.id = data.channel.id;
			this.readyState = data.channel.readyState;
			this.bufferedAmount = data.channel.bufferedAmount;
			break;

		case 'statechange':
			this.readyState = data.readyState;

			switch (data.readyState) {
				case 'connecting':
					break;
				case 'open':
					this.dispatchEvent(new Event('open'));
					break;
				case 'closing':
					break;
				case 'closed':
					this.dispatchEvent(new Event('close'));
					break;
			}
			break;

		case 'message':
			event = new Event('message');
			event.data = data.message;
			this.dispatchEvent(event);
			break;
	}
}

},{"cordova/exec":undefined,"debug":15,"random-number":19,"yaeti":20}],7:[function(require,module,exports){
/**
 * Expose the RTCIceCandidate class.
 */
module.exports = RTCIceCandidate;


function RTCIceCandidate(data) {
	data = data || {};

	// Public atributes.
	this.sdpMid = data.sdpMid;
	this.sdpMLineIndex = data.sdpMLineIndex;
	this.candidate = data.candidate;
}

},{}],8:[function(require,module,exports){
(function (global){
/**
 * Expose the RTCPeerConnection class.
 */
module.exports = RTCPeerConnection;


/**
 * Dependencies.
 */
var
	debug = require('debug')('iosrtc:RTCPeerConnection'),
	debugerror = require('debug')('iosrtc:ERROR:RTCPeerConnection'),
	exec = require('cordova/exec'),
	randomNumber = require('random-number').generator({min: 10000, max: 99999, integer: true}),
	EventTarget = require('yaeti').EventTarget,
	RTCSessionDescription = require('./RTCSessionDescription'),
	RTCIceCandidate = require('./RTCIceCandidate'),
	RTCDataChannel = require('./RTCDataChannel'),
	MediaStream = require('./MediaStream'),
	Errors = require('./Errors');


debugerror.log = console.warn.bind(console);


function RTCPeerConnection(pcConfig, pcConstraints) {
	debug('new() | [pcConfig:%o, pcConstraints:%o]', pcConfig, pcConstraints);

	var self = this;

	// Make this an EventTarget.
	EventTarget.call(this);

	// Public atributes.
	this.localDescription = null;
	this.remoteDescription = null;
	this.signalingState = 'stable';
	this.iceGatheringState = 'new';
	this.iceConnectionState = 'new';
	this.pcConfig = fixPcConfig(pcConfig);

	// Private attributes.
	this.pcId = randomNumber();
	this.localStreams = {};
	this.remoteStreams = {};

	function onResultOK(data) {
		onEvent.call(self, data);
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'new_RTCPeerConnection', [this.pcId, this.pcConfig, pcConstraints]);
}


RTCPeerConnection.prototype.createOffer = function () {
	var self = this,
		isPromise,
		options,
		callback, errback;

	if (typeof arguments[0] !== 'function') {
		isPromise = true;
		options = arguments[0];
	} else {
		isPromise = false;
		callback = arguments[0];
		errback = arguments[1];
		options = arguments[2];
	}

	if (isClosed.call(this)) {
		return;
	}

	debug('createOffer() [options:%o]', options);

	if (isPromise) {
		return new Promise(function (resolve, reject) {
			function onResultOK(data) {
				if (isClosed.call(self)) {
					return;
				}

				var desc = new RTCSessionDescription(data);

				debug('createOffer() | success [desc:%o]', desc);
				resolve(desc);
			}

			function onResultError(error) {
				if (isClosed.call(self)) {
					return;
				}

				debugerror('createOffer() | failure: %s', error);
				reject(new global.DOMError(error));
			}

			exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_createOffer', [self.pcId, options]);
		});
	}

	function onResultOK(data) {
		if (isClosed.call(self)) {
			return;
		}

		var desc = new RTCSessionDescription(data);

		debug('createOffer() | success [desc:%o]', desc);
		callback(desc);
	}

	function onResultError(error) {
		if (isClosed.call(self)) {
			return;
		}

		debugerror('createOffer() | failure: %s', error);
		if (typeof errback === 'function') {
			errback(new global.DOMError(error));
		}
	}

	exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_createOffer', [this.pcId, options]);
};


RTCPeerConnection.prototype.createAnswer = function () {
	var self = this,
		isPromise,
		options,
		callback, errback;

	if (typeof arguments[0] !== 'function') {
		isPromise = true;
		options = arguments[0];
	} else {
		isPromise = false;
		callback = arguments[0];
		errback = arguments[1];
		options = arguments[2];
	}

	if (isClosed.call(this)) {
		return;
	}

	debug('createAnswer() [options:%o]', options);

	if (isPromise) {
		return new Promise(function (resolve, reject) {
			function onResultOK(data) {
				if (isClosed.call(self)) {
					return;
				}

				var desc = new RTCSessionDescription(data);

				debug('createAnswer() | success [desc:%o]', desc);
				resolve(desc);
			}

			function onResultError(error) {
				if (isClosed.call(self)) {
					return;
				}

				debugerror('createAnswer() | failure: %s', error);
				reject(new global.DOMError(error));
			}

			exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_createAnswer', [self.pcId, options]);
		});
	}

	function onResultOK(data) {
		if (isClosed.call(self)) {
			return;
		}

		var desc = new RTCSessionDescription(data);

		debug('createAnswer() | success [desc:%o]', desc);
		callback(desc);
	}

	function onResultError(error) {
		if (isClosed.call(self)) {
			return;
		}

		debugerror('createAnswer() | failure: %s', error);
		if (typeof errback === 'function') {
			errback(new global.DOMError(error));
		}
	}

	exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_createAnswer', [this.pcId, options]);
};



RTCPeerConnection.prototype.setLocalDescription = function (desc) {
	var self = this,
		isPromise,
		callback, errback;

	if (typeof arguments[1] !== 'function') {
		isPromise = true;
	} else {
		isPromise = false;
		callback = arguments[1];
		errback = arguments[2];
	}

	if (isClosed.call(this)) {
		if (isPromise) {
			return new Promise(function (resolve, reject) {
				reject(new Errors.InvalidStateError('peerconnection is closed'));
			});
		} else {
			throw new Errors.InvalidStateError('peerconnection is closed');
		}
	}

	debug('setLocalDescription() [desc:%o]', desc);

	if (!(desc instanceof RTCSessionDescription)) {
		if (isPromise) {
			return new Promise(function (resolve, reject) {
				reject(new Errors.InvalidSessionDescriptionError('setLocalDescription() must be called with a RTCSessionDescription instance as first argument'));
			});
		} else {
			if (typeof errback === 'function') {
				errback(new Errors.InvalidSessionDescriptionError('setLocalDescription() must be called with a RTCSessionDescription instance as first argument'));
			}
			return;
		}
	}

	if (isPromise) {
		return new Promise(function (resolve, reject) {
			function onResultOK(data) {
				if (isClosed.call(self)) {
					return;
				}

				debug('setLocalDescription() | success');
				// Update localDescription.
				self.localDescription = new RTCSessionDescription(data);
				resolve();
			}

			function onResultError(error) {
				if (isClosed.call(self)) {
					return;
				}

				debugerror('setLocalDescription() | failure: %s', error);
				reject(new Errors.InvalidSessionDescriptionError('setLocalDescription() failed: ' + error));
			}

			exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_setLocalDescription', [self.pcId, desc]);
		});
	}

	function onResultOK(data) {
		if (isClosed.call(self)) {
			return;
		}

		debug('setLocalDescription() | success');
		// Update localDescription.
		self.localDescription = new RTCSessionDescription(data);
		callback();
	}

	function onResultError(error) {
		if (isClosed.call(self)) {
			return;
		}

		debugerror('setLocalDescription() | failure: %s', error);

		if (typeof errback === 'function') {
			errback(new Errors.InvalidSessionDescriptionError('setLocalDescription() failed: ' + error));
		}
	}

	exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_setLocalDescription', [this.pcId, desc]);
};


RTCPeerConnection.prototype.setRemoteDescription = function (desc) {
	var self = this,
		isPromise,
		callback, errback;

	if (typeof arguments[1] !== 'function') {
		isPromise = true;
	} else {
		isPromise = false;
		callback = arguments[1];
		errback = arguments[2];
	}

	if (isClosed.call(this)) {
		if (isPromise) {
			return new Promise(function (resolve, reject) {
				reject(new Errors.InvalidStateError('peerconnection is closed'));
			});
		} else {
			throw new Errors.InvalidStateError('peerconnection is closed');
		}
	}

	debug('setRemoteDescription() [desc:%o]', desc);

	if (!(desc instanceof RTCSessionDescription)) {
		if (isPromise) {
			return new Promise(function (resolve, reject) {
				reject(new Errors.InvalidSessionDescriptionError('setRemoteDescription() must be called with a RTCSessionDescription instance as first argument'));
			});
		} else {
			if (typeof errback === 'function') {
				errback(new Errors.InvalidSessionDescriptionError('setRemoteDescription() must be called with a RTCSessionDescription instance as first argument'));
			}
			return;
		}
	}

	if (isPromise) {
		return new Promise(function (resolve, reject) {
			function onResultOK(data) {
				if (isClosed.call(self)) {
					return;
				}

				debug('setRemoteDescription() | success');
				// Update remoteDescription.
				self.remoteDescription = new RTCSessionDescription(data);
				resolve();
			}

			function onResultError(error) {
				if (isClosed.call(self)) {
					return;
				}

				debugerror('setRemoteDescription() | failure: %s', error);
				reject(new Errors.InvalidSessionDescriptionError('setRemoteDescription() failed: ' + error));
			}

			exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_setRemoteDescription', [self.pcId, desc]);
		});
	}

	function onResultOK(data) {
		if (isClosed.call(self)) {
			return;
		}

		debug('setRemoteDescription() | success');
		// Update remoteDescription.
		self.remoteDescription = new RTCSessionDescription(data);
		callback();
	}

	function onResultError(error) {
		if (isClosed.call(self)) {
			return;
		}

		debugerror('setRemoteDescription() | failure: %s', error);

		if (typeof errback === 'function') {
			errback(new Errors.InvalidSessionDescriptionError('setRemoteDescription() failed: ' + error));
		}
	}

	exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_setRemoteDescription', [this.pcId, desc]);
};



RTCPeerConnection.prototype.addIceCandidate = function (candidate) {
	var self = this,
		isPromise,
		callback, errback;

	if (typeof arguments[1] !== 'function') {
		isPromise = true;
	} else {
		isPromise = false;
		callback = arguments[1];
		errback = arguments[2];
	}

	if (isClosed.call(this)) {
		if (isPromise) {
			return new Promise(function (resolve, reject) {
				reject(new Errors.InvalidStateError('peerconnection is closed'));
			});
		} else {
			throw new Errors.InvalidStateError('peerconnection is closed');
		}
	}

	debug('addIceCandidate() | [candidate:%o]', candidate);

	if (!(candidate instanceof RTCIceCandidate)) {
		if (isPromise) {
			return new Promise(function (resolve, reject) {
				reject(new global.DOMError('addIceCandidate() must be called with a RTCIceCandidate instance as first argument'));
			});
		} else {
			if (typeof errback === 'function') {
				errback(new global.DOMError('addIceCandidate() must be called with a RTCIceCandidate instance as first argument'));
			}
			return;
		}
	}

	if (isPromise) {
		return new Promise(function (resolve, reject) {
			function onResultOK(data) {
				if (isClosed.call(self)) {
					return;
				}

				debug('addIceCandidate() | success');
				// Update remoteDescription.
				if (self.remoteDescription && data.remoteDescription) {
					self.remoteDescription.type = data.remoteDescription.type;
					self.remoteDescription.sdp = data.remoteDescription.sdp;
				} else if (data.remoteDescription) {
					self.remoteDescription = new RTCSessionDescription(data.remoteDescription);
				}
				resolve();
			}

			function onResultError() {
				if (isClosed.call(self)) {
					return;
				}

				debugerror('addIceCandidate() | failure');
				reject(new global.DOMError('addIceCandidate() failed'));
			}

			exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_addIceCandidate', [self.pcId, candidate]);
		});
	}

	function onResultOK(data) {
		if (isClosed.call(self)) {
			return;
		}

		debug('addIceCandidate() | success');
		// Update remoteDescription.
		if (self.remoteDescription && data.remoteDescription) {
			self.remoteDescription.type = data.remoteDescription.type;
			self.remoteDescription.sdp = data.remoteDescription.sdp;
		} else if (data.remoteDescription) {
			self.remoteDescription = new RTCSessionDescription(data.remoteDescription);
		}
		callback();
	}

	function onResultError() {
		if (isClosed.call(self)) {
			return;
		}

		debugerror('addIceCandidate() | failure');
		if (typeof errback === 'function') {
			errback(new global.DOMError('addIceCandidate() failed'));
		}
	}

	exec(onResultOK, onResultError, 'iosrtcPlugin', 'RTCPeerConnection_addIceCandidate', [this.pcId, candidate]);
};


RTCPeerConnection.prototype.getConfiguration = function () {
	debug('getConfiguration()');

	return this.pcConfig;
};


RTCPeerConnection.prototype.getLocalStreams = function () {
	debug('getLocalStreams()');

	var streams = [],
		id;

	for (id in this.localStreams) {
		if (this.localStreams.hasOwnProperty(id)) {
			streams.push(this.localStreams[id]);
		}
	}

	return streams;
};


RTCPeerConnection.prototype.getRemoteStreams = function () {
	debug('getRemoteStreams()');

	var streams = [],
		id;

	for (id in this.remoteStreams) {
		if (this.remoteStreams.hasOwnProperty(id)) {
			streams.push(this.remoteStreams[id]);
		}
	}

	return streams;
};


RTCPeerConnection.prototype.getStreamById = function (id) {
	debug('getStreamById()');

	return this.localStreams[id] || this.remoteStreams[id] || null;
};


RTCPeerConnection.prototype.addStream = function (stream) {
	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	debug('addStream()');

	if (!(stream instanceof MediaStream)) {
		throw new Error('addStream() must be called with a MediaStream instance as argument');
	}

	if (this.localStreams[stream.id]) {
		debugerror('addStream() | given stream already in present in local streams');
		return;
	}

	this.localStreams[stream.id] = stream;

	exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_addStream', [this.pcId, stream.id]);
};


RTCPeerConnection.prototype.removeStream = function (stream) {
	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	debug('removeStream()');

	if (!(stream instanceof MediaStream)) {
		throw new Error('removeStream() must be called with a MediaStream instance as argument');
	}

	if (!this.localStreams[stream.id]) {
		debugerror('removeStream() | given stream not present in local streams');
		return;
	}

	delete this.localStreams[stream.id];

	exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_removeStream', [this.pcId, stream.id]);
};


RTCPeerConnection.prototype.createDataChannel = function (label, options) {
	if (isClosed.call(this)) {
		throw new Errors.InvalidStateError('peerconnection is closed');
	}

	debug('createDataChannel() [label:%s, options:%o]', label, options);

	return new RTCDataChannel(this, label, options);
};


RTCPeerConnection.prototype.close = function () {
	if (isClosed.call(this)) {
		return;
	}

	debug('close()');

	exec(null, null, 'iosrtcPlugin', 'RTCPeerConnection_close', [this.pcId]);
};


/**
 * Private API.
 */


function fixPcConfig(pcConfig) {
	if (!pcConfig) {
		return {
			iceServers: []
		};
	}

	var iceServers = pcConfig.iceServers,
		i, len, iceServer;

	if (!Array.isArray(iceServers)) {
		pcConfig.iceServers = [];
		return pcConfig;
	}

	for (i = 0, len = iceServers.length; i < len; i++) {
		iceServer = iceServers[i];

		// THe Objective-C wrapper of WebRTC is old and does not implement .urls.
		if (iceServer.url) {
			continue;
		} else if (Array.isArray(iceServer.urls)) {
			iceServer.url = iceServer.urls[0];
		} else if (typeof iceServer.urls === 'string') {
			iceServer.url = iceServer.urls;
		}
	}

	return pcConfig;
}


function isClosed() {
	return this.signalingState === 'closed';
}


function onEvent(data) {
	var type = data.type,
		event = new Event(type),
		stream,
		dataChannel,
		id;

	debug('onEvent() | [type:%s, data:%o]', type, data);

	switch (type) {
		case 'signalingstatechange':
			this.signalingState = data.signalingState;
			break;

		case 'icegatheringstatechange':
			this.iceGatheringState = data.iceGatheringState;
			break;

		case 'iceconnectionstatechange':
			this.iceConnectionState = data.iceConnectionState;

			// Emit "connected" on remote streams if ICE connected.
			if (data.iceConnectionState === 'connected') {
				for (id in this.remoteStreams) {
					if (this.remoteStreams.hasOwnProperty(id)) {
						this.remoteStreams[id].emitConnected();
					}
				}
			}
			break;

		case 'icecandidate':
			if (data.candidate) {
				event.candidate = new RTCIceCandidate(data.candidate);
			} else {
				event.candidate = null;
			}
			// Update localDescription.
			if (this.localDescription) {
				this.localDescription.type = data.localDescription.type;
				this.localDescription.sdp = data.localDescription.sdp;
			} else {
				this.localDescription = new RTCSessionDescription(data);
			}
			break;

		case 'negotiationneeded':
			break;

		case 'addstream':
			stream = MediaStream.create(data.stream);
			event.stream = stream;

			// Append to the remote streams.
			this.remoteStreams[stream.id] = stream;

			// Emit "connected" on the stream if ICE connected.
			if (this.iceConnectionState === 'connected' || this.iceConnectionState === 'completed') {
				stream.emitConnected();
			}
			break;

		case 'removestream':
			stream = this.remoteStreams[data.streamId];
			event.stream = stream;

			// Remove from the remote streams.
			delete this.remoteStreams[stream.id];
			break;

		case 'datachannel':
			dataChannel = new RTCDataChannel(this, null, null, data.channel);
			event.channel = dataChannel;
			break;
	}

	this.dispatchEvent(event);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Errors":1,"./MediaStream":3,"./RTCDataChannel":6,"./RTCIceCandidate":7,"./RTCSessionDescription":9,"cordova/exec":undefined,"debug":15,"random-number":19,"yaeti":20}],9:[function(require,module,exports){
/**
 * Expose the RTCSessionDescription class.
 */
module.exports = RTCSessionDescription;


function RTCSessionDescription(data) {
	data = data || {};

	// Public atributes.
	this.type = data.type;
	this.sdp = data.sdp;
}

},{}],10:[function(require,module,exports){
/**
 * Expose the enumerateDevices function.
 */
module.exports = enumerateDevices;


/**
 * Dependencies.
 */
var
	debug = require('debug')('iosrtc:enumerateDevices'),
	exec = require('cordova/exec'),
	MediaDeviceInfo = require('./MediaDeviceInfo');


function enumerateDevices() {
	debug('');

	var isPromise,
		callback;

	if (typeof arguments[0] !== 'function') {
		isPromise = true;
	} else {
		isPromise = false;
		callback = arguments[0];
	}

	if (isPromise) {
		return new Promise(function (resolve) {
			function onResultOK(data) {
				debug('enumerateDevices() | success');
				resolve(getMediaDeviceInfos(data.devices));
			}

			exec(onResultOK, null, 'iosrtcPlugin', 'enumerateDevices', []);
		});
	}

	function onResultOK(data) {
		debug('enumerateDevices() | success');
		callback(getMediaDeviceInfos(data.devices));
	}

	exec(onResultOK, null, 'iosrtcPlugin', 'enumerateDevices', []);
}


/**
 * Private API.
 */


function getMediaDeviceInfos(devices) {
	debug('getMediaDeviceInfos() | [devices:%o]', devices);

	var id,
		mediaDeviceInfos = [];

	for (id in devices) {
		if (devices.hasOwnProperty(id)) {
			mediaDeviceInfos.push(new MediaDeviceInfo(devices[id]));
		}
	}

	return mediaDeviceInfos;
}

},{"./MediaDeviceInfo":2,"cordova/exec":undefined,"debug":15}],11:[function(require,module,exports){
/**
 * Expose the getUserMedia function.
 */
module.exports = getUserMedia;


/**
 * Dependencies.
 */
var
	debug = require('debug')('iosrtc:getUserMedia'),
	debugerror = require('debug')('iosrtc:ERROR:getUserMedia'),
	exec = require('cordova/exec'),
	MediaStream = require('./MediaStream'),
	Errors = require('./Errors');

debugerror.log = console.warn.bind(console);


function isPositiveInteger(number) {
	return typeof number === 'number' && number >= 0 && number % 1 === 0;
}

function isPositiveFloat(number) {
	return typeof number === 'number' && number >= 0;
}


function getUserMedia(constraints) {
	debug('[original constraints:%o]', constraints);

	var
		isPromise,
		callback, errback,
		audioRequested = false,
		videoRequested = false,
		newConstraints = {
			audio: false,
			video: false
		};

	if (typeof arguments[1] !== 'function') {
		isPromise = true;
	} else {
		isPromise = false;
		callback = arguments[1];
		errback = arguments[2];
	}

	if (
		typeof constraints !== 'object' ||
		(!constraints.hasOwnProperty('audio') && !constraints.hasOwnProperty('video'))
	) {
		if (isPromise) {
			return new Promise(function (resolve, reject) {
				reject(new Errors.MediaStreamError('constraints must be an object with at least "audio" or "video" keys'));
			});
		} else {
			if (typeof errback === 'function') {
				errback(new Errors.MediaStreamError('constraints must be an object with at least "audio" or "video" keys'));
			}
			return;
		}
	}

	if (constraints.audio) {
		audioRequested = true;
		newConstraints.audio = true;
	}
	if (constraints.video) {
		videoRequested = true;
		newConstraints.video = true;
	}

	// Example:
	//
	// getUserMedia({
	//  audio: true,
	//  video: {
	//  	deviceId: 'qwer-asdf-zxcv',
	//  	width: {
	//  		min: 400,
	//  		max: 600
	//  	},
	//  	frameRate: {
	//  		min: 1.0,
	//  		max: 60.0
	//  	}
	//  }
	// });

	// Get video constraints
	if (videoRequested) {
		// Get requested video deviceId.
		if (typeof constraints.video.deviceId === 'string') {
			newConstraints.videoDeviceId = constraints.video.deviceId;
		}

		// Get requested min/max width.
		if (typeof constraints.video.width === 'object') {
			if (isPositiveInteger(constraints.video.width.min)) {
				newConstraints.videoMinWidth = constraints.video.width.min;
			}
			if (isPositiveInteger(constraints.video.width.max)) {
				newConstraints.videoMaxWidth = constraints.video.width.max;
			}
		}
		// Get requested min/max height.
		if (typeof constraints.video.height === 'object') {
			if (isPositiveInteger(constraints.video.height.min)) {
				newConstraints.videoMinHeight = constraints.video.height.min;
			}
			if (isPositiveInteger(constraints.video.height.max)) {
				newConstraints.videoMaxHeight = constraints.video.height.max;
			}
		}
		// Get requested min/max frame rate.
		if (typeof constraints.video.frameRate === 'object') {
			if (isPositiveFloat(constraints.video.frameRate.min)) {
				newConstraints.videoMinFrameRate = constraints.video.frameRate.min;
			}
			if (isPositiveFloat(constraints.video.frameRate.max)) {
				newConstraints.videoMaxFrameRate = constraints.video.frameRate.max;
			}
		} else if (isPositiveFloat(constraints.video.frameRate)) {
			newConstraints.videoMinFrameRate = constraints.video.frameRate;
			newConstraints.videoMaxFrameRate = constraints.video.frameRate;
		}
	}

	debug('[computed constraints:%o]', newConstraints);

	if (isPromise) {
		return new Promise(function (resolve, reject) {
			function onResultOK(data) {
				debug('getUserMedia() | success');
				resolve(MediaStream.create(data.stream));
			}

			function onResultError(error) {
				debugerror('getUserMedia() | failure: %s', error);
				reject(new Errors.MediaStreamError('getUserMedia() failed: ' + error));
			}

			exec(onResultOK, onResultError, 'iosrtcPlugin', 'getUserMedia', [newConstraints]);
		});
	}

	function onResultOK(data) {
		debug('getUserMedia() | success');

		var stream = MediaStream.create(data.stream);

		callback(stream);

		// Emit "connected" on the stream.
		stream.emitConnected();
	}

	function onResultError(error) {
		debugerror('getUserMedia() | failure: %s', error);

		if (typeof errback === 'function') {
			errback(new Errors.MediaStreamError('getUserMedia() failed: ' + error));
		}
	}

	exec(onResultOK, onResultError, 'iosrtcPlugin', 'getUserMedia', [newConstraints]);
}

},{"./Errors":1,"./MediaStream":3,"cordova/exec":undefined,"debug":15}],12:[function(require,module,exports){
(function (global){
/**
 * Variables.
 */

var
	// Dictionary of MediaStreamRenderers.
	// - key: MediaStreamRenderer id.
	// - value: MediaStreamRenderer.
	mediaStreamRenderers = {},

	// Dictionary of MediaStreams.
	// - key: MediaStream blobId.
	// - value: MediaStream.
	mediaStreams = {},


/**
 * Dependencies.
 */
	debug                  = require('debug')('iosrtc'),
	exec                   = require('cordova/exec'),
	domready               = require('domready'),

	getUserMedia           = require('./getUserMedia'),
	enumerateDevices       = require('./enumerateDevices'),
	RTCPeerConnection      = require('./RTCPeerConnection'),
	RTCSessionDescription  = require('./RTCSessionDescription'),
	RTCIceCandidate        = require('./RTCIceCandidate'),
	MediaStream            = require('./MediaStream'),
	MediaStreamTrack       = require('./MediaStreamTrack'),
	videoElementsHandler   = require('./videoElementsHandler'),
	rtcninjaPlugin         = require('./rtcninjaPlugin');


/**
 * Expose the iosrtc object.
 */
module.exports = {
	// Expose WebRTC classes and functions.
	getUserMedia:          getUserMedia,
	enumerateDevices:      enumerateDevices,
	getMediaDevices:       enumerateDevices,  // TMP
	RTCPeerConnection:     RTCPeerConnection,
	RTCSessionDescription: RTCSessionDescription,
	RTCIceCandidate:       RTCIceCandidate,
	MediaStream:           MediaStream,
	MediaStreamTrack:      MediaStreamTrack,

	// Expose a function to refresh current videos rendering a MediaStream.
	refreshVideos:         refreshVideos,

	// Expose a function to handle a video not yet inserted in the DOM.
	observeVideo:          videoElementsHandler.observeVideo,

	// Select audio output (earpiece or speaker).
	selectAudioOutput:     selectAudioOutput,

	// Expose a function to pollute window and naigator namespaces.
	registerGlobals:       registerGlobals,

	// Expose the rtcninjaPlugin module.
	rtcninjaPlugin:        rtcninjaPlugin,

	// Expose the debug module.
	debug:                 require('debug'),

	// Debug function to see what happens internally.
	dump:                  dump
};


domready(function () {
	// Let the MediaStream class and the videoElementsHandler share same MediaStreams container.
	MediaStream.setMediaStreams(mediaStreams);
	videoElementsHandler(mediaStreams, mediaStreamRenderers);
});


function refreshVideos() {
	debug('refreshVideos()');

	var id;

	for (id in mediaStreamRenderers) {
		if (mediaStreamRenderers.hasOwnProperty(id)) {
			mediaStreamRenderers[id].refresh();
		}
	}
}


function selectAudioOutput(output) {
	debug('selectAudioOutput() | [output:"%s"]', output);

	switch (output) {
		case 'earpiece':
			exec(null, null, 'iosrtcPlugin', 'selectAudioOutputEarpiece', []);
			break;
		case 'speaker':
			exec(null, null, 'iosrtcPlugin', 'selectAudioOutputSpeaker', []);
			break;
		default:
			throw new Error('output must be "earpiece" or "speaker"');
	}
}


function registerGlobals() {
	if (!global.navigator) {
		global.navigator = {};
	}

	if (!navigator.mediaDevices) {
		navigator.mediaDevices = {};
	}

	navigator.getUserMedia                  = getUserMedia;
	navigator.webkitGetUserMedia            = getUserMedia;
	navigator.mediaDevices.getUserMedia     = getUserMedia;
	navigator.mediaDevices.enumerateDevices = enumerateDevices;
	window.RTCPeerConnection                = RTCPeerConnection;
	window.webkitRTCPeerConnection          = RTCPeerConnection;
	window.RTCSessionDescription            = RTCSessionDescription;
	window.RTCIceCandidate                  = RTCIceCandidate;
	window.MediaStream                      = MediaStream;
	window.webkitMediaStream                = MediaStream;
	window.MediaStreamTrack                 = MediaStreamTrack;
}


function dump() {
	exec(null, null, 'iosrtcPlugin', 'dump', []);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./MediaStream":3,"./MediaStreamTrack":5,"./RTCIceCandidate":7,"./RTCPeerConnection":8,"./RTCSessionDescription":9,"./enumerateDevices":10,"./getUserMedia":11,"./rtcninjaPlugin":13,"./videoElementsHandler":14,"cordova/exec":undefined,"debug":15,"domready":18}],13:[function(require,module,exports){
/**
 * Expose the rtcninjaPlugin object.
 */
module.exports = {
	isRequired: function () {
		return true;
	},

	isInstalled: function () {
		return true;
	},

	interface: {
		getUserMedia:          require('./getUserMedia'),
		enumerateDevices:      require('./enumerateDevices'),
		getMediaDevices:       require('./enumerateDevices'),  // TMP
		RTCPeerConnection:     require('./RTCPeerConnection'),
		RTCSessionDescription: require('./RTCSessionDescription'),
		RTCIceCandidate:       require('./RTCIceCandidate'),
		MediaStreamTrack:      require('./MediaStreamTrack'),
		attachMediaStream:     attachMediaStream,
		canRenegotiate:        true
	}
};


function attachMediaStream(element, stream) {
	element.src = URL.createObjectURL(stream);
	return element;
}

},{"./MediaStreamTrack":5,"./RTCIceCandidate":7,"./RTCPeerConnection":8,"./RTCSessionDescription":9,"./enumerateDevices":10,"./getUserMedia":11}],14:[function(require,module,exports){
(function (global){
/**
 * Expose a function that must be called when the library is loaded.
 * And also a helper function.
 */
module.exports = videoElementsHandler;
module.exports.observeVideo = observeVideo;


/**
 * Dependencies.
 */
var debug = require('debug')('iosrtc:videoElementsHandler'),
	MediaStreamRenderer = require('./MediaStreamRenderer'),


/**
 * Local variables.
 */

	// RegExp for MediaStream blobId.
	MEDIASTREAM_ID_REGEXP = new RegExp(/^MediaStream_/),

	// RegExp for Blob URI.
	BLOB_URI_REGEX = new RegExp(/^blob:/),

	// Dictionary of MediaStreamRenderers (provided via module argument).
	// - key: MediaStreamRenderer id.
	// - value: MediaStreamRenderer.
	mediaStreamRenderers,

	// Dictionary of MediaStreams (provided via module argument).
	// - key: MediaStream blobId.
	// - value: MediaStream.
	mediaStreams,

	// Video element mutation observer.
	videoObserver = new MutationObserver(function (mutations) {
		var i, numMutations, mutation,
			video;

		for (i = 0, numMutations = mutations.length; i < numMutations; i++) {
			mutation = mutations[i];

			// HTML video element.
			video = mutation.target;

			// .src removed.
			if (!video.src) {
				// If this video element was previously handling a MediaStreamRenderer, release it.
				releaseMediaStreamRenderer(video);
				continue;
			}

			handleVideo(video);
		}
	}),

	// DOM mutation observer.
	domObserver = new MutationObserver(function (mutations) {
		var i, numMutations, mutation,
			j, numNodes, node;

		for (i = 0, numMutations = mutations.length; i < numMutations; i++) {
			mutation = mutations[i];

			// Check if there has been addition or deletion of nodes.
			if (mutation.type !== 'childList') {
				continue;
			}

			// Check added nodes.
			for (j = 0, numNodes = mutation.addedNodes.length; j < numNodes; j++) {
				node = mutation.addedNodes[j];

				checkNewNode(node);
			}

			// Check removed nodes.
			for (j = 0, numNodes = mutation.removedNodes.length; j < numNodes; j++) {
				node = mutation.removedNodes[j];

				checkRemovedNode(node);
			}
		}

		function checkNewNode(node) {
			var j, childNode;

			if (node.nodeName === 'VIDEO') {
				debug('new video element added');

				// Avoid same node firing more than once (really, may happen in some cases).
				if (node._iosrtcVideoHandled) {
					return;
				}
				node._iosrtcVideoHandled = true;

				// Observe changes in the video element.
				observeVideo(node);
			} else {
				for (j = 0; j < node.childNodes.length; j++) {
					childNode = node.childNodes.item(j);

					checkNewNode(childNode);
				}
			}
		}

		function checkRemovedNode(node) {
			var j, childNode;

			if (node.nodeName === 'VIDEO') {
				debug('video element removed');

				// If this video element was previously handling a MediaStreamRenderer, release it.
				releaseMediaStreamRenderer(node);
			} else {
				for (j = 0; j < node.childNodes.length; j++) {
					childNode = node.childNodes.item(j);

					checkRemovedNode(childNode);
				}
			}
		}
	});


function videoElementsHandler(_mediaStreams, _mediaStreamRenderers) {
	var existingVideos = document.querySelectorAll('video'),
		i, len,
		video;

	mediaStreams = _mediaStreams;
	mediaStreamRenderers = _mediaStreamRenderers;

	// Search the whole document for already existing HTML video elements and observe them.
	for (i = 0, len = existingVideos.length; i < len; i++) {
		video = existingVideos.item(i);

		debug('video element found');

		observeVideo(video);
	}

	// Observe the whole document for additions of new HTML video elements and observe them.
	domObserver.observe(document, {
		// Set to true if additions and removals of the target node's child elements (including text nodes) are to
		// be observed.
		childList: true,
		// Set to true if mutations to target's attributes are to be observed.
		attributes: false,
		// Set to true if mutations to target's data are to be observed.
		characterData: false,
		// Set to true if mutations to not just target, but also target's descendants are to be observed.
		subtree: true,
		// Set to true if attributes is set to true and target's attribute value before the mutation needs to be
		// recorded.
		attributeOldValue: false,
		// Set to true if characterData is set to true and target's data before the mutation needs to be recorded.
		characterDataOldValue: false
		// Set to an array of attribute local names (without namespace) if not all attribute mutations need to be
		// observed.
		// attributeFilter:
	});
}


function observeVideo(video) {
	debug('observeVideo()');

	// If the video already has a src property but is not yet handled by the plugin
	// then handle it now.
	if (video.src && !video._iosrtcMediaStreamRendererId) {
		handleVideo(video);
	}

	// Add .src observer to the video element.
	videoObserver.observe(video, {
		// Set to true if additions and removals of the target node's child elements (including text
		// nodes) are to be observed.
		childList: false,
		// Set to true if mutations to target's attributes are to be observed.
		attributes: true,
		// Set to true if mutations to target's data are to be observed.
		characterData: false,
		// Set to true if mutations to not just target, but also target's descendants are to be observed.
		subtree: false,
		// Set to true if attributes is set to true and target's attribute value before the mutation
		// needs to be recorded.
		attributeOldValue: false,
		// Set to true if characterData is set to true and target's data before the mutation needs to be
		// recorded.
		characterDataOldValue: false,
		// Set to an array of attribute local names (without namespace) if not all attribute mutations
		// need to be observed.
		// TODO: Add srcObject, mozSrcObject
		attributeFilter: ['src']
	});

	// Intercept video 'error' events if it's due to the attached MediaStream.
	video.addEventListener('error', function (event) {
		if (video.error.code === global.MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && BLOB_URI_REGEX.test(video.src)) {
			debug('stopping "error" event propagation for video element');

			event.stopImmediatePropagation();
		}
	});
}


/**
 * Private API.
 */

function handleVideo(video) {
	var xhr = new XMLHttpRequest();

	xhr.open('GET', video.src, true);
	xhr.responseType = 'blob';
	xhr.onload = function () {
		if (xhr.status !== 200) {
			// If this video element was previously handling a MediaStreamRenderer, release it.
			releaseMediaStreamRenderer(video);

			return;
		}

		var reader = new FileReader();

		// Some versions of Safari fail to set onloadend property, some others do not react
		// on 'loadend' event. Try everything here.
		try {
			reader.onloadend = onloadend;
		} catch (error) {
			reader.addEventListener('loadend', onloadend);
		}
		reader.readAsText(xhr.response);

		function onloadend() {
			var mediaStreamBlobId = reader.result;

			// The retrieved URL does not point to a MediaStream.
			if (!mediaStreamBlobId || typeof mediaStreamBlobId !== 'string' || !MEDIASTREAM_ID_REGEXP.test(mediaStreamBlobId)) {
				// If this video element was previously handling a MediaStreamRenderer, release it.
				releaseMediaStreamRenderer(video);

				return;
			}

			provideMediaStreamRenderer(video, mediaStreamBlobId);
		}
	};
	xhr.send();
}


function provideMediaStreamRenderer(video, mediaStreamBlobId) {
	var mediaStream = mediaStreams[mediaStreamBlobId],
		mediaStreamRenderer = mediaStreamRenderers[video._iosrtcMediaStreamRendererId];

	if (!mediaStream) {
		releaseMediaStreamRenderer(video);

		return;
	}

	if (mediaStreamRenderer) {
		mediaStreamRenderer.render(mediaStream);
	} else {
		mediaStreamRenderer = new MediaStreamRenderer(video);
		mediaStreamRenderer.render(mediaStream);

		mediaStreamRenderers[mediaStreamRenderer.id] = mediaStreamRenderer;
		video._iosrtcMediaStreamRendererId = mediaStreamRenderer.id;
	}

	// Close the MediaStreamRenderer of this video if it emits "close" event.
	mediaStreamRenderer.addEventListener('close', function () {
		if (mediaStreamRenderers[video._iosrtcMediaStreamRendererId] !== mediaStreamRenderer) {
			return;
		}

		releaseMediaStreamRenderer(video);
	});

	// Override some <video> properties.
	// NOTE: This is a terrible hack but it works.
	Object.defineProperties(video, {
		videoWidth: {
			configurable: true,
			get: function () {
				return mediaStreamRenderer.videoWidth || 0;
			}
		},
		videoHeight: {
			configurable: true,
			get: function () {
				return mediaStreamRenderer.videoHeight || 0;
			}
		},
		readyState: {
			configurable: true,
			get: function () {
				if (mediaStreamRenderer && mediaStreamRenderer.stream && mediaStreamRenderer.stream.connected) {
					return video.HAVE_ENOUGH_DATA;
				} else {
					return video.HAVE_NOTHING;
				}
			}
		}
	});
}


function releaseMediaStreamRenderer(video) {
	if (!video._iosrtcMediaStreamRendererId) {
		return;
	}

	var mediaStreamRenderer = mediaStreamRenderers[video._iosrtcMediaStreamRendererId];

	if (mediaStreamRenderer) {
		delete mediaStreamRenderers[video._iosrtcMediaStreamRendererId];
		mediaStreamRenderer.close();
	}

	delete video._iosrtcMediaStreamRendererId;

	// Remove overrided <video> properties.
	delete video.videoWidth;
	delete video.videoHeight;
	delete video.readyState;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./MediaStreamRenderer":4,"debug":15}],15:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage(){
  try {
    return window.localStorage;
  } catch (e) {}
}

},{"./debug":16}],16:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":17}],17:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = '' + str;
  if (str.length > 10000) return;
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],18:[function(require,module,exports){
/*!
  * domready (c) Dustin Diaz 2014 - License MIT
  */
!function (name, definition) {

  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && typeof define.amd == 'object') define(definition)
  else this[name] = definition()

}('domready', function () {

  var fns = [], listener
    , doc = document
    , hack = doc.documentElement.doScroll
    , domContentLoaded = 'DOMContentLoaded'
    , loaded = (hack ? /^loaded|^c/ : /^loaded|^i|^c/).test(doc.readyState)


  if (!loaded)
  doc.addEventListener(domContentLoaded, listener = function () {
    doc.removeEventListener(domContentLoaded, listener)
    loaded = 1
    while (listener = fns.shift()) listener()
  })

  return function (fn) {
    loaded ? setTimeout(fn, 0) : fns.push(fn)
  }

});

},{}],19:[function(require,module,exports){
void function(root){

  function defaults(options){
    var options = options || {}
    var min = options.min
    var max = options.max
    var integer = options.integer || false
    if ( min == null && max == null ) {
      min = 0
      max = 1
    } else if ( min == null ) {
      min = max - 1
    } else if ( max == null ) {
      max = min + 1
    }
    if ( max < min ) throw new Error('invalid options, max must be >= min')
    return {
      min:     min
    , max:     max
    , integer: integer
    }
  }

  function random(options){
    options = defaults(options)
    if ( options.max === options.min ) return options.min
    var r = Math.random() * (options.max - options.min + Number(!!options.integer)) + options.min
    return options.integer ? Math.floor(r) : r
  }

  function generator(options){
    options = defaults(options)
    return function(min, max, integer){
      options.min     = min     || options.min
      options.max     = max     || options.max
      options.integer = integer != null ? integer : options.integer
      return random(options)
    }
  }

  module.exports =  random
  module.exports.generator = generator
  module.exports.defaults = defaults
}(this)

},{}],20:[function(require,module,exports){
module.exports = {
	EventTarget:  require('./lib/EventTarget'),
	Event:        require('./lib/Event')
};

},{"./lib/Event":21,"./lib/EventTarget":22}],21:[function(require,module,exports){
(function (global){
/**
 * In browsers export the native Event interface.
 */

module.exports = global.Event;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],22:[function(require,module,exports){
/**
 * Expose the _EventTarget class.
 */
module.exports = _EventTarget;


function _EventTarget() {
	// Do nothing if called for a native EventTarget object..
	if (typeof this.addEventListener === 'function') {
		return;
	}

	this._listeners = {};

	this.addEventListener = _addEventListener;
	this.removeEventListener = _removeEventListener;
	this.dispatchEvent = _dispatchEvent;
}


Object.defineProperties(_EventTarget.prototype, {
	listeners: {
		get: function () {
			return this._listeners;
		}
	}
});


function _addEventListener(type, newListener) {
	var listenersType,
		i, listener;

	if (!type || !newListener) {
		return;
	}

	listenersType = this._listeners[type];
	if (listenersType === undefined) {
		this._listeners[type] = listenersType = [];
	}

	for (i = 0; !!(listener = listenersType[i]); i++) {
		if (listener === newListener) {
			return;
		}
	}

	listenersType.push(newListener);
}


function _removeEventListener(type, oldListener) {
	var listenersType,
		i, listener;

	if (!type || !oldListener) {
		return;
	}

	listenersType = this._listeners[type];
	if (listenersType === undefined) {
		return;
	}

	for (i = 0; !!(listener = listenersType[i]); i++) {
		if (listener === oldListener) {
			listenersType.splice(i, 1);
			break;
		}
	}

	if (listenersType.length === 0) {
		delete this._listeners[type];
	}
}


function _dispatchEvent(event) {
	var type,
		listenersType,
		dummyListener,
		stopImmediatePropagation = false,
		i, listener;

	if (!event || typeof event.type !== 'string') {
		throw new Error('`event` must have a valid `type` property');
	}

	if (event._dispatched) {
		throw new Error('event already dispatched');
	}
	event._dispatched = true;

	// Force the event to be cancelable.
	// event.cancelable = true;
	event.target = this;

	// Override stopImmediatePropagation() function.
	event.stopImmediatePropagation = function () {
		stopImmediatePropagation = true;
	};

	type = event.type;
	listenersType = (this._listeners[type] || []);

	dummyListener = this['on' + type];
	if (typeof dummyListener === 'function') {
		listenersType.push(dummyListener);
	}

	for (i = 0; !!(listener = listenersType[i]); i++) {
		if (stopImmediatePropagation) {
			break;
		}

		listener.call(this, event);
	}

	return !event.defaultPrevented;
}

},{}]},{},[12])(12)
});
});
