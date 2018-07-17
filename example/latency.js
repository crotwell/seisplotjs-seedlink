var seedlink = seisplotjs_seedlink;

console.log("seedlink "+seedlink);
console.log("seedlink.keys "+Object.keys(seedlink));
console.log("seedlink.IRIS_HOST "+seedlink.IRIS_HOST);

var wp = seisplotjs_waveformplot;



var d3 = wp.d3;
var moment = seedlink.moment;

console.log("in latency.js");

const networkLatitude=34;
const networkLongitude=-81;
const maxQuakeRadius=10;
const netCode = 'CO';
var match = '^'+netCode+'_.+';

var conn = new seedlink.RingserverConnection();


seedlink.RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

var table = 'table';

d3.select('.serverId').select(table).remove();
d3.select('.serverId').append(table);
conn.pullId().then(function(servId) {
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

d3.select('.streams').select(table).remove();
d3.select('.streams').append(table);
d3.select('.quakes').select(table).remove();
d3.select('.quakes').append(table)
conn.pullStreams(match).then(function(streamsResult) {
  streamsResult.stationStreams = seedlink.stationsFromStreams(streamsResult.streams);
  console.log("stations found: "+streamsResult.stationStreams.length);
  return streamsResult;
}).then(function(streamsResult) {
  d3.select('.streams').insert('p', table)
    .text('Access: '+streamsResult.accessTime.toISOString()+" Found: "+streamsResult.streams.length);
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
    .data(streamsResult.stationStreams);

  var tr = streamList.enter()
    .append('tr');

  tr.append('td')
    .text(function(d) { return d.key; });

  tr.append('td')
    .text(function(d) { return d.start.toISOString(); });

  tr.append('td')
    .text(function(d) { return d.end.toISOString(); });

  tr.append('td')
    .text(function(d) { return d.calcLatency(streamsResult.accessTime); });

  streamList.exit()
    .remove();
console.log("before quake "+streamsResult.streams.length);

  const earliest = streamsResult.streams.reduce(function(accum, val) {
    return moment.min(accum, val.start);
  }, moment.now());
console.log("earliest: "+earliest.toISOString());
/*
  var quakeQuery = new seisplotjs.fdsnevent.EventQuery()
    .minMag(3.5)
    .startTime(earliest)
    .endTime(new Date())
    .latitude(networkLatitude)
    .longitude(networkLongitude)
    .maxRadius(maxQuakeRadius);
  console.log("quake url: "+quakeQuery.formURL());
  quakeQuery.query().then(function(quakeList) {
    if (quakeList.length == 0) {
      console.log("no quakes");
      wp.d3.select("div.quakes")
        .append("p")
        .text("Zero quakes returned... Sorry. ");
    }
  console.log("num quake: "+quakeList.length);
  const quakeTbl = d3.select('.quakes')
    .select(table);
  const qth = quakeTbl.append('thead').append('tr');
  qth.append('th').text('Time');
  qth.append('th').text('Loc');
  qth.append('th').text('Depth');
  qth.append('th').text('Mag');
  var quakeBody = quakeTbl
    .append('tbody')
    .selectAll('tr')
    .data(quakeList);
  const qtr = quakeBody.enter()
    .append('tr');
  qtr.append('td')
    .text(function(d) { return d.time(); });
  qtr.append('td')
    .text(function(d) { return d.latitude()+","+d.longitude(); });
  qtr.append('td')
    .text(function(d) { return d.depth() / 1000; });
  qtr.append('td')
    .text(function(d) { return d.magnitude().mag(); });
  }).catch(function(err) {
    console.log("error");
    console.log("errors: "+err);
  });
  */
});
