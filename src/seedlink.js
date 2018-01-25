/**
 * Philip Crotwell
 * University of South Carolina, 2016
 * http://www.seis.sc.edu
 */

import * as miniseed from 'seisplotjs-miniseed';
import * as RSVP from 'rsvp';
import moment from 'moment';

/* reexport */
export { miniseed, RSVP };

export const SEEDLINK_PROTOCOL = "SeedLink3.1";

RSVP.on('error', function(reason) {
  console.assert(false, reason);
});

export class SeedlinkConnection {

  /** creates a seedlink websocket connection to the given url.
    * requestConfig is an array of seedlink commands
    * like:
    *   [ 'STATION JSC CO',
    *     'SELECT 00BHZ.D' ]
    * and receiveMiniseedFn is the callback function that
    * will be invoked for each seedlink packet received
    * which contains 'sequence', a sequence number
    * and 'miniseed', a single miniseed record.
    * The connection is not made until the connect() method is called.
    */
  constructor(url, requestConfig, receiveMiniseedFn, errorFn) {
    this.url = url;
    this.requestConfig = requestConfig;
    this.receiveMiniseedFn = receiveMiniseedFn;
    this.errorFn = errorFn;
    this.command = 'DATA';
  }

  setTimeCommand(startDate) {
    this.command = "TIME "+moment(startDate).format("YYYY,MM,DD,HH,mm,ss");
  }

  connect() {
    this.webSocket = new WebSocket(this.url, SEEDLINK_PROTOCOL);
    this.webSocket.binaryType = 'arraybuffer';
    const that = this;
    this.webSocket.onopen = function() {
      that.sendHello(that.webSocket)
      .then(function() {
        return that.sendCmdArray(that.webSocket, that.requestConfig);
      })
      .then(function() {
        return that.sendCmdArray(that.webSocket, [ that.command ]);
      })
      .then(function(val) {
        that.webSocket.onmessage = function(event) {
          that.handle(event);
        };
        that.webSocket.send('END\r');
        return val;
      }, function(err) {
        console.assert(false, "reject: "+err);
        that.close();
      });
    };
  }

  close() {
    if (this.webSocket) {
      this.webSocket.close();
    }
  }

  handle(event) {
    if (event.data.byteLength < 64) {
      //assume text
    } else {
      this.handleMiniseed(event);
    }
  }

  handleMiniseed(event) {
    try {
       // let arrBuf = new ArrayBuffer(event.data);
        if (event.data.byteLength < 64) {
          this.errorFn("message too small to be miniseed: "+event.data.byteLength +" "+arrayBufferToString(event.data));
          return;
        }
        let slHeader = new DataView(event.data, 0, 8);
        // check for 'SL' at start
        if (slHeader.getInt8(0) === 83 && slHeader.getInt8(1) === 76) {
          let seqStr = '';
          for (let i=0; i<6; i++) {
            seqStr = seqStr + String.fromCharCode(slHeader.getInt8(2+i));
          }
          let dataView = new DataView(event.data, 8, event.data.byteLength-8);
          let out = {
            rawsequence: seqStr,
            sequence: parseInt(seqStr, 16),
            miniseed: new miniseed.DataRecord(dataView)
          };
          this.receiveMiniseedFn(out);
        } else {
          this.errorFn("Not a seedlink packet, no starting SL: "+slHeader.getInt8(0)+' '+slHeader.getInt8(1));
        }
     } catch(e) {
        console.assert(false, e);
        this.errorFn("Error, closing seedlink. "+e);
        this.close();
     }
  }

  sendHello(webSocket) {
  let promise = new RSVP.Promise(function(resolve, reject) {
    webSocket.onmessage = function(event) {
      let replyMsg = arrayBufferToString(event.data);
      let lines = replyMsg.trim().split('\r');
      if (lines.length == 2) {
        resolve(lines);
      } else {
        reject("not 2 lines: "+replyMsg);
      }
    };
    webSocket.send("HELLO\r");
  });
  return promise;
}

  sendCmdArray(webSocket, cmd) {
    let that = this;
    return cmd.reduce(function(cur, next) {
      return cur.then(function() {
        return that.createCmdPromise(webSocket, next);
      });
    }, RSVP.resolve());
  }

  createCmdPromise(webSocket, mycmd) {
    let promise = new RSVP.Promise(function(resolve, reject) {
      webSocket.onmessage = function(event) {
        let replyMsg = arrayBufferToString(event.data).trim();
        if (replyMsg === 'OK') {
          resolve(replyMsg);
        } else {
          reject("msg not OK: "+replyMsg);
        }
      };
      webSocket.send(mycmd+'\r\n');
    });
    return promise;
  }
}

export function arrayBufferToString(arrBuf) {
  let dataView = new DataView(arrBuf);
  let out = "";
  for (let i=0; i< dataView.byteLength; i++) {
    out += String.fromCharCode(dataView.getUint8(i));
  }
  return out;
}
