/**
 * Philip Crotwell
 * University of South Carolina, 2016
 * http://www.seis.sc.edu
 */

import * as miniseed from 'seisplotjs-miniseed';

/* reexport */
export { miniseed };

export function seedlinkConnect(url, requestConfig, callback, error) {
  let webSocket = WebSocket(url, "seedlink");
  webSocket.onerror(error);
  webSocket.onopen = function(event) {
    webSocket.send("HELLO");
    webSocket.onmessage = function(event) {
      console.log("reply to HELLO: "+event);
      for (let c of requestConfig) {
        websocket.send(c);
      }
      websocket.send('DATA');
      websocket.send('END');
      webSocket.onmessage = function(event) {
        console.log("Response: "+event);
        let arrBuf = new ArrayBuffer(event.data);
        let slHeader = new DataView(arrBuf, 0, 8);
        // check for 'SL' at start
        if (slHeader.getInt8() === 83 && slHeader.getInt8(1) === 76) {
          let seqStr = '';
          for (let i=0; i<6; i++) {
            seqStr = seqStr + String.fromCharCode(slHeader.getInt8(2+i));
          }
          let dataView = new DataView(arrBuf, 8, arrBuf.length-8);
          let out = {
            sequence: parseInt(seqStr, 16),
            miniseed: new miniseed.DataRecord(dataView)
          }
          callback(out);
        }
      };
    };
    return webSocket;
  };
};

