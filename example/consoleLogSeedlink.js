
// this sets up console.log to append to the textarea with id="console"
var textarea = document.getElementById("log");
textarea.value = '';// empty it
var origLog = console.log;
console.log = function(msg) {
  origLog(msg);
  textarea.value += msg+'\n';
};

//var seedlink = require('seisplotjs-seedlink');
// this global comes from the seisplotjs_seedlink standalone js
var seedlink = seisplotjs_seedlink

var clockOffset = 0; // should get from server somehow
var duration = 300;

var maxSteps = 10; // max num of ticks of the timer before stopping, for debugin

endDate = new Date(new Date().getTime()-clockOffset);
startDate = new Date(endDate.getTime()-duration*1000);
var protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
var wsProtocol = 'ws:';
if (protocol == 'https:') {
  wsProtocol = 'wss:';
}
//
// Note: currently rtserve.iris does not support wss, and so this will
// not work from https pages as you cannot use non-encrypted (ws)
// loaded from a https web page
//
if (wsProtocol == 'wss:' && host == IRIS_HOST) {
  console.log("IRIS currently does not support connections from https pages, I will attempt anyway, but you may wish to try from a http page instead.");
}

var IRIS_HOST = "rtserve.iris.washington.edu";
var host = IRIS_HOST;
var port = 80;
var seedlinkUrl = wsProtocol+"//"+host+(port==80?'':'80')+'/seedlink';
console.log("URL: "+seedlinkUrl);

var config = [
  'STATION KMSC TA',
  'SELECT --BHZ.D' ];


console.log("before select");
if (wsProtocol == 'wss:' && host == IRIS_HOST) {
  console.log("IRIS currently does not support connections from https pages, try from a http page instead.");
}


var numSteps = 0;

var callbackFn = function(slPacket) {
  var codes = slPacket.miniseed.codes();
  console.log("seedlink: seq="+slPacket.sequence+" "+codes);
    numSteps++;
    if (maxSteps > 0 && numSteps > maxSteps ) {
      console.log("quit after max steps: "+maxSteps);
      slConn.close();
    }
}

var errorFn = function(error) {
  console.log("error: "+error);
};

var slConn = new seedlink.SeedlinkConnection(seedlinkUrl, config, callbackFn, errorFn);
slConn.setTimeCommand(new Date(new Date().getTime()-duration*1000));
slConn.connect();
console.log("Seedlink connect called");
