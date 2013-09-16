
navigator.getUserMedia = ( navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia);

var x = "";

navigator.getUserMedia (
   // constraints
   {
      video: true,
      audio: true
   },

   // successCallback
   function(localMediaStream) {
      //var video = document.querySelector('video');
      x = window.URL.createObjectURL(localMediaStream);
      //video.onloadedmetadata = function(e) {
      //  console.log("Got video media!");
         // Do something with the video here.
      //};
      localMediaStream.stop()
   },

   // errorCallback
   function(err) {
    console.log("The following error occured: ", err);
   }
);

