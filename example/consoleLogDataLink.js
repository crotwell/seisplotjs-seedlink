
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
var seedlink = seisplotjs_seedlink;

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
var IRIS_HOST = "rtserve.iris.washington.edu";
var EEYORE_HOST = "eeyore.seis.sc.edu";
var EEYORE_PORT = 6383;
var host = EEYORE_HOST;
var port = EEYORE_PORT;
var datalinkUrl = wsProtocol+"//"+host+(port==80?'' : (':'+port))+'/datalink';
console.log("URL: "+datalinkUrl);

if (wsProtocol == 'wss:' && host == IRIS_HOST) {
  console.log("IRIS currently does not support connections from https pages, try from a http page instead.");
}

var numSteps = 0;

var packetHandler = function(dlPacket) {
  var codes = dlPacket.miniseed.codes();
  console.log("datalink: seq="+slPacket.sequence+" "+codes);
    numSteps++;
    if (maxSteps > 0 && numSteps > maxSteps ) {
      console.log("quit after max steps: "+maxSteps);
      datalink.close();
    }
}

var errorHandler = function(error) {
  console.log("error: "+error);
};

var datalink = new seedlink.DataLinkConnection(datalinkUrl, packetHandler, errorHandler);
datalink.connect()
  .then(function(id) {
    console.log("cldl server id: "+id);
    return datalink.awaitDLCommand("MATCH", "IU_ANMO.*");
  }).then(resp => {
    console.log("resp : "+resp);
    return resp;
  }).then(resp => {
    datalink.close();
  });


console.log("consoleLogDataLink connect called");
