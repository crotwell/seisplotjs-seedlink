var seedlink = seisplotjs_seedlink;

console.log("seedlink "+seedlink);
console.log("seedlink.keys "+Object.keys(seedlink));
console.log("seedlink.IRIS_HOST "+seedlink.IRIS_HOST);

var wp = seisplotjs_waveformplot;



var d3 = wp.d3;
var moment = seedlink.moment;

var table = 'table';
var level = 1;
var match = "";
var paused = false;
var stopped = false;
var slConn; // connection just for seedlink
var allSeisPlots = new Map();
var config = [];
var margin = {top: 20, right: 20, bottom: 50, left: 60};

var protocol = 'http:';
if ("https:" == document.location.protocol) {
  protocol = 'https:'
}
var wsProtocol = 'ws:';
if (protocol == 'https:') {
  wsProtocol = 'wss:';
}

if (wsProtocol == 'wss:' && host == IRIS_HOST) {
  console.log("IRIS currently does not support connections from https pages, I will attempt anyway, but you may wish to try from a http page instead.");
}

// set to true to create websocket back to same server
// assuming this page is server directly out of ringserver
var direct_ringserver = false;

var IRIS_HOST = "rtserve.iris.washington.edu";
var host = IRIS_HOST;
var port = 80;
if (direct_ringserver) {
  console.log("assuming pages served directly by ringserver "+document.location.host+" "+document.location.port);
  host = document.location.hostname;
  port = document.location.port;
}
var portStr = "";
if (port != 80) {
  portStr = ":"+port;
}
var seedlinkUrl = wsProtocol+"//"+host+portStr+'/seedlink';

console.log("seedlinkUrl URL: "+seedlinkUrl);

var conn = new seedlink.RingserverConnection(host, port);
//var conn = new ringserver.RingserverConnection('thecloud.seis.sc.edu', 6382);
//var conn = new seedlink.RingserverConnection('eeyore.seis.sc.edu', 6382);


d3.select('.serverId').select(table).remove();
d3.select('.serverId').append(table);
conn.pullId().then(function(servId) {
  console.log("after pullId: "+servId);
  var tr;
  var tbl = d3.select('.serverId').select(table);
  tr = tbl.append('tr');
  tr.append('td').text('URL:');
  tr.append('td').text(conn.formBaseURL());
  tr = tbl.append('tr');
  tr.append('td').text('Ringserver:');
  tr.append('td').text(servId.ringserverVersion);
  tr = tbl.append('tr');
  tr.append('td').text('Organization:');
  tr.append('td').text(servId.serverId);
});

seedlink.RSVP.on('error', function(reason) {
  console.assert(false, reason);
});


var loadLevel = function(newlevel, newmatch) {
  level = newlevel;
  match = newmatch;
  if (level==4) {
    conn.pullStreams(match).then(function(info) {
      var streamIds = [];
      for (const s of info.streams) {
        streamIds.push(s.key);
      }
      handleStreamIds({
        "streamIds": streamIds,
        "streams": info.streams,
        "accessTime": moment.utc()
      });
    });
  } else {
    if (slConn) {slConn.close(); slConn = null;}
    wp.d3.select('div.realtime').selectAll('div').remove();
    allSeisPlots = new Map();
    conn.pullStreamIds(level, match).then(function(streamIds) {
      handleStreamIds({
        "streamIds": streamIds,
        "accessTime": moment.utc()
      });
    });
  }
};

var loadStream = function(id) {

  var clockOffset = 0; // should get from server somehow
  var duration = 300;
  var maxSteps = -1; // max num of ticks of the timer before stopping, for debugin
  var timeWindow = wp.calcStartEndDates(null, null, duration, clockOffset);
  console.log("timeWindow: "+timeWindow.start+" "+timeWindow.end);


  if (id.endsWith('/MSEED')) {
    id = id.substring(0, id.length-6);
  }
  var splitId = id.split('_');
  if (splitId[2].length == 0) {
    splitId[2] = '--';
  }
  config.push('STATION '+splitId[1]+" "+splitId[0]);
  config.push('SELECT '+splitId[2]+splitId[3]+'.D');


  //wp.createPlotsBySelector('div.myseisplot');
  console.log("before select");
  var svgParent = wp.d3.select('div.realtime');
  if (wsProtocol == 'wss:' && host == IRIS_HOST) {
    svgParent.append("h3").attr('class', 'waitingondata').text("IRIS currently does not support connections from https pages, try from a http page instead.");
  } else {
    svgParent.append("p").attr('class', 'waitingondata').text("waiting on first data");
  }

  var callbackFn = function(slPacket) {
    var codes = slPacket.miniseed.codes();
    console.log("seedlink: seq="+slPacket.sequence+" "+codes);
    var seismogram = wp.miniseed.createSeismogram([slPacket.miniseed]);
    if (allSeisPlots[ codes ]) {
      allSeisPlots[ codes ].trim(timeWindow);
      allSeisPlots[ codes ].append(seismogram);
    } else {
      svgParent.select("p.waitingondata").remove();
      var seisDiv = svgParent.append('div').attr('class', codes);
  //    seisDiv.append('p').text(codes);
      var plotDiv = seisDiv.append('div').attr('class', 'realtimePlot');
      var seisPlot = new wp.Seismograph(plotDiv, [seismogram], timeWindow.start, timeWindow.end);
      seisPlot.disableWheelZoom();
      seisPlot.setXSublabel(codes);
      seisPlot.setMargin(margin );
      seisPlot.draw();
      allSeisPlots[slPacket.miniseed.codes()] = seisPlot;
    }
  }

  var numSteps = 0;
  var timerInterval = (timeWindow.end.valueOf()-timeWindow.start.valueOf())/
                      (parseInt(svgParent.style("width"))-margin.left-margin.right);

  var timer = wp.d3.interval(function(elapsed) {
    if ( paused) {
      return;
    }
    if ( Object.keys(allSeisPlots).length > 1) {
      numSteps++;
      if (maxSteps > 0 && numSteps > maxSteps ) {
        console.log("quit after max steps: "+maxSteps);
        timer.stop();
        slConn.close();
      }
    }
    timeWindow = wp.calcStartEndDates(null, null, duration, clockOffset);
    for (var key in allSeisPlots) {
      if (allSeisPlots.hasOwnProperty(key)) {
        allSeisPlots[key].setPlotStartEnd(timeWindow.start, timeWindow.end);
      }
    }
  }, timerInterval);

  wp.d3.select("button#pause").on("click", function(d) {
    console.log("Pause..."+paused);
    paused = ! paused;
    if (paused) {
      wp.d3.select(this).text("Play");
    } else {
      wp.d3.select(this).text("Pause");
    }
  });

  wp.d3.select("button#disconnect").on("click", function(d) {
    console.log("disconnect..."+stopped);
    stopped = ! stopped;
    if (stopped) {
      slConn.close();
      wp.d3.select(this).text("Reconnect");
    } else {
      slConn.connect();
      wp.d3.select(this).text("Disconnect");
    }
  });

  var errorFn = function(error) {
    console.log("error: "+error);
    svgParent.select("p").text("Error: "+error);
  };

  if (slConn) {slConn.close();}
  slConn = new seedlink.SeedlinkConnection(seedlinkUrl, config, callbackFn, errorFn);
  slConn.setTimeCommand(timeWindow.start);
  slConn.connect();
}

var handleStreamIds = function(streamsResult) {
    let uplevels = d3.select('.streams').select('ul.uplevels');
    uplevels.selectAll('li').remove();
    let split = streamsResult.streamIds[0].split('_');
    split = split.slice(0, split.length-2);
    levelsAbove = [{
      display: 'All',
      key: "",
      level: 1,
      match: ""
    }];
    for (let i=0; i<split.length; i++) {
      let key = split.slice(0, i+1).join('_');
      console.log(split[i]+" "+key);
      let child = {
        display: split[i],
        key: key,
        level: i+2,
        match: "^"+key+"_.*"
      };
      levelsAbove.push(child);
    }
    console.log('levels '+split);
    uplevels.selectAll('li')
      .data(levelsAbove)
      .enter()
      .append('li')
      .text(function(d) { return d.display})
      .attr('class', 'clickable')
      .on("click", function(d) {
        handleClick(d);
      });

    let streamsData = [];
    if (streamsResult.streams) {
      for (const s of streamsResult.streams) {
        s.display = s.key;
        s.level = level+1;
        s.match = "^"+s.key+"_.*";
        streamsData.push(s);
      }
    } else {
      for (const s of streamsResult.streamIds) {
        streamsData.push({
          key: s,
          display: s,
          level: level+1,
          match: "^"+s+"_.*"
        });
      }
    }

    d3.select('.streams').select(table).remove();
    d3.select('.streams').append(table);
//    d3.select('.streams').insert('p', table)
//      .text('Access: '+streamsResult.accessTime.toISOString()+" Found: "+streamsResult.streamIds.length);
    var tbl = d3.select('.streams')
      .select(table);
    var th = tbl.append('thead').append('tr');
    th.append('th').text('Stream');
    th.append('th').text('Earliest Start');
    th.append('th').text('Latest End');
    th.append('th').text('Latency');
    var streamList = tbl
      .append('tbody')
      .selectAll('tr')
      .data(streamsData);

    var tr = streamList.enter()
      .append('tr');

    tr.append('td')
      .text(function(d) { return d.display; })
      .attr('class', 'clickable')
      .on("click", handleClick);

    tr.append('td')
      .text(function(d) { return d.start ? d.start.toISOString() : ""; });

    tr.append('td')
      .text(function(d) { return d.end ? d.end.toISOString() : ""; });

    tr.append('td')
      .text(function(d) { return d.start ? d.calcLatency(streamsResult.accessTime) : ""; });

    streamList.exit()
      .remove();

};

var handleClick = function(d) {
  const key = d.key ;
  console.log("handleClick "+key);
  var splitLevels = key.split('_');
  if (splitLevels.length == 4) {
    // assume a real stream
    loadStream(key);
  } else {
    let match =  "^"+key+".*";
    if (d.level) {
      console.log("d.level "+d.level);
      level = d.level;
      match = d.match;
    } else {
      console.log("big level "+level);
      level = level+1;
    }
    if (level <=7) {
      console.log("loadLevel: "+level+" "+match);
      loadLevel(level, match);
    } else {
      level = 6;
    }
  }
  return true;
}

let latencyTimeInterval = 10000;
var reloadLatencytimer = wp.d3.interval(function(elapsed) {
  console.log("reloadLatencytimer "+level);
  if ( level != 4) {
    return;
  }
  loadLevel(level, match);
}, latencyTimeInterval);

loadLevel(level, match);
