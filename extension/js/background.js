freedom.once('backward', function(msg) {
  console.log('backward:'+msg);
});
freedom.emit('forward', 'testmessage');
