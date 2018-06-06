// @flow

/*global DataView */
/*global WebSocket */

/**
 * Philip Crotwell
 * University of South Carolina, 2016
 * http://www.seis.sc.edu
 */

import {dataViewToString} from './util';
import * as miniseed from 'seisplotjs-miniseed';
import * as RSVP from 'rsvp';
import moment from 'moment';

/* reexport */
export { miniseed, RSVP };

export const DATALINK_PROTOCOL = "1.0";
export const QUERY_MODE = "QUERY";
export const STREAM_MODE = "STREAM";
export const MAX_PROC_NUM = Math.pow(2, 16)-2;
export const USER_BROWSER = "browser";

export const ERROR = "ERROR";
export const PACKET = "PACKET";
export const STREAM = "STREAM";
export const ENDSTREAM = "ENDSTREAM";
export const MSEED_TYPE = "MSEED";

let defaultHandleResponse = function(message) {
  console.log("Unhandled datalink response: "+message);
};

export class DataLinkConnection {
  url: string;
  mode: string | null;
  packetHandler: (packet: DataLinkPacket) => void;
  errorHandler: (error: Error) => void;
  serverId: string | null;
  clientIdNum: number;
  username: string;
  responseResolve: null | (response: string) => void;
  responseReject: null | (error: Error) => void;
  webSocket: WebSocket | null;
  constructor(url :string, packetHandler: (packet: DataLinkPacket) => void, errorHandler: (error: Error) => void) {
    this.url = url;
    this.mode = QUERY_MODE;
    this.packetHandler = packetHandler;
    this.errorHandler = errorHandler;
    this.serverId = null;
    // meant to be processId, so use 1 <= num <= 2^15 to be safe
    this.clientIdNum = Math.floor(Math.random() * MAX_PROC_NUM)+1;
    this.username = USER_BROWSER;
    this.responseResolve = null;
    this.responseReject = null;
  }

/** creates the websocket connection and sends the client
*  ID. Returns a Promise that resolves to the server's
* ID.
*/
  connect() {
    const that = this;
    return new RSVP.Promise(function(resolve, reject) {
      const webSocket = new WebSocket(that.url, DATALINK_PROTOCOL);
      that.webSocket = webSocket;
      webSocket.binaryType = 'arraybuffer';
      webSocket.onmessage = function(event) {
        that.handle(event);
      };
      webSocket.onerror = function(event) {
        that.handleError(new Error(""+miniseed.model.stringify(event)));
        reject(event);
      };
      webSocket.onclose = function() {
        that.webSocket = null; // clean up
      };
      webSocket.onopen = function() {
        resolve(that);
      };
    }).then(datalink => {
      return datalink.sendId();
    }).then( idmsg => {
      that.serverId = idmsg;
      return idmsg;
    });
  }

  stream() :void {
    if (this.mode === STREAM_MODE) {return;}
    this.mode = STREAM_MODE;
    this.sendDLCommand(STREAM, "");
  }

  endStream() :void {
    if (this.mode === QUERY_MODE) {return;}
    this.mode = QUERY_MODE;
    this.sendDLCommand(ENDSTREAM, "");
  }

  close() :void {
    if (this.webSocket) {
      this.endStream(); // end streaming just in case
      if (this.webSocket) {this.webSocket.close();}
      this.webSocket = null;
      this.mode = null;
    }
  }

  /**
  * Send a ID Command. Command is a string.
  * Returns a Promise.
  */
  sendId() :Promise<string> {
    const that = this;
    return this.awaitDLCommand("ID seisplotjs:"+this.username+":"+this.clientIdNum+":javascript")
    .then(replyMsg => {
        if (replyMsg.startsWith("ID DataLink ")) {
          that.serverId = replyMsg;
          return replyMsg;
        } else {
          throw new Error("not ID line: "+miniseed.model.stringify(replyMsg));
        }
    });
  }

/** encodes command with optional data section as
 * a string. This works for client generated commands
 * but not for a PACKET, which would have binary data.
 * PACKET is what client receives, but should never
 * send as we do not generate data. */
  encodeDLCommand(command :string, dataString ?:string) :ArrayBuffer {
    let cmdLen = command.length;
    let len = 3+command.length;
    let lenStr = "";
    if (dataString && dataString.length > 0) {
      lenStr = String(dataString.length);
      len+=lenStr.length+1;
      cmdLen += lenStr.length+1;
      len+=dataString.length;

    }
    let rawPacket = new ArrayBuffer(len);
    let packet = new DataView(rawPacket);
    packet.setUint8(0, 68); // ascii D
    packet.setUint8(1, 76); // ascii L
    packet.setUint8(2, cmdLen);
    let i = 3;
    for (const c of command) {
      packet.setUint8(i, c.charCodeAt(0));
      i++;
    }
    const SPACE = ' ';
    if (dataString && dataString.length > 0) {
      packet.setUint8(i, SPACE.charCodeAt(0)); // ascii space
      i++;
      for (const c of lenStr) {
        packet.setUint8(i, c.charCodeAt(0));
        i++;
      }
      for (const c of dataString) {
        packet.setUint8(i, c.charCodeAt(0));
        i++;
      }
    }
    return rawPacket;
  }

  sendDLCommand(command :string, dataString ?:string) :void {
    console.log("send: "+command+" | "+(dataString ? dataString : ""));
    const rawPacket = this.encodeDLCommand(command, dataString);
    if (this.webSocket) {
      this.webSocket.send(rawPacket);
    } else {
      throw new Error("WebSocket has been closed.");
    }
  }

  /**
  * Send a DataLink Command and await the response. Command is a string.
  * Returns a Promise that resolves with the webSocket MessageEvent.
  */
  awaitDLCommand(command :string, dataString ?:string) :Promise<string> {
    let that = this;
    let promise = new RSVP.Promise(function(resolve, reject) {
      that.responseResolve = resolve;
      that.responseReject = reject;
      that.sendDLCommand(command, dataString);
    }).then(response => {
      that.responseResolve = null;
      that.responseReject = null;
      return response;
    }).catch(error => {
      that.responseResolve = null;
      that.responseReject = null;
      throw error;
    });
    return promise;
  }

  handle(wsEvent :MessageEvent ) {
    const rawData :ArrayBuffer = ((wsEvent.data :any) :ArrayBuffer);
    let dlPreHeader = new DataView(rawData, 0, 3);
    if ('D' === String.fromCharCode(dlPreHeader.getUint8(0))
        && 'L' === String.fromCharCode(dlPreHeader.getUint8(1))) {
      const headerLen = dlPreHeader.getUint8(2);
      const header = dataViewToString(new DataView(rawData, 3, headerLen));
      //console.log("handle wsEvent   header: '"+header+"'");
      if (header.startsWith(PACKET)) {
        if (this.packetHandler) {
          try {
            let packet = new DataLinkPacket(header,
                    new DataView(rawData, 3+headerLen));
            this.packetHandler(packet);
          } catch (e) {
            this.errorHandler(e);
          }
        } else {
          this.errorHandler(new Error("packetHandler not defined"));
        }
      } else if (header.startsWith(ERROR) || header.startsWith("OK")) {
        const split = header.split(' ');
        const value = split[1];
        // not needed as one datalink packet per web socket event
        // const dataSize = Number.parseInt(split[2]);
        const message = dataViewToString(new DataView(rawData, 3+headerLen));
        if (header.startsWith(ERROR)) {
          this.handleError(new Error("value="+value+" "+message));
        } else if (header.startsWith("OK")) {
          if (this.responseResolve) {
            this.responseResolve(header+" | "+message);
            console.log(header+" | "+message);
          } else {
            console.log("OK without responseResolve");
          }
        }
      } else if (this.responseResolve) {
        this.responseResolve(header);
      } else {
        defaultHandleResponse(header);
      }
    } else {
      throw new Error("DataLink Packet did not start with DL");
    }
  }

  handleError(error: Error) {
    if (this.responseReject) {
      this.responseReject(error);
    }
    if (this.errorHandler) {
      this.errorHandler(error);
    }
    console.log("handleError: "+error.message);
  }
}

export class DataLinkPacket {
  header: string;
  data: DataView;
  streamId: string;
  pktid: string;
  hppackettime: string;
  hppacketstart: string;
  hppacketend: string;
  dataSize: number;
  miniseed: miniseed.DataRecord;
  constructor(header :string, dataview :DataView) {
    this.header = header;
    this.data = dataview;
    let split = this.header.split(' ');
    this.streamId = split[1];
    this.pktid = split[2];
    this.hppackettime = split[3];
    this.hppacketstart = split[4];
    this.hppacketend = split[5];
    this.dataSize = Number.parseInt(split[6]);
    if (dataview.byteLength < this.dataSize) {
      throw new Error("not enough bytes in dataview for packet: "+this.dataSize);
    }
    if (this.streamId.endsWith(MSEED_TYPE)) {
      this.miniseed = new miniseed.DataRecord(dataview);
    } else {
      throw new Error("Unknown DataLink Packet type: "+this.streamId);
    }
  }

}
