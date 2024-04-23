import { Socket, io } from "socket.io-client";

export type OfferMessage = {
  offer: {
    type: "offer";
    sdp: string;
  };
};

export type AnswerMessage = {
  answer: {
    type: "answer";
    sdp: string;
  };
};

export type IceCandidateMessage = {
  candidate: RTCIceCandidate;
};

type PeerConnect = {
  action: "open";
  message: string;
  connections: {
    peerId: string;
    socketId: string;
  }[];
  bePolite: boolean;
};

type PeerDisconnect = {
  action: "close";
  message: string;
};

type Payload = PeerDisconnect | PeerConnect;

export type Message = {
  from: string;
  target: "all";
  message: OfferMessage | AnswerMessage | IceCandidateMessage;
  payload: Payload;
};

type MessageHandler = (message: Message) => void | Promise<void>;

// This is a bare minimum example of how one might setup a signaling channel as a class
export default class SignalingChannel {
  public peerId: string;
  public socket: Socket;
  public state: "pending" | "connecting" | "connected" = "pending";

  constructor(peerId: string, signalingServerUrl: string, token: string) {
    this.peerId = peerId;
    this.socket = io(signalingServerUrl, {
      auth: { token },
      autoConnect: false, // disables auto connection, by default the client would connect to the server as soon as the io() object is instatiated
      reconnection: false, // disables auto reconnection, this can occur when for example the host server disconnects. When set to true, the client would keep trying to reconnect
      // for a complete list of the available options, see https://socket.io/docs/v4/client-api/#new-Manager-url-options
    });
    this.onMessage = () => {};
  }
  async connect() {
    return new Promise<void>((resolve) => {
      if (this.state !== "pending") {
        return;
      }

      console.log("Connecting to signaling server", this.peerId);

      this.state = "connecting";

      this.socket.on("connect", () => {
        this.state = "connected";

        console.log("Connected with id", this.socket.id);
        this.socket.emit("ready", this.peerId);
        resolve();
      });
      this.socket.on("disconnect", () => {
        console.log("Disconnected");
        this.state = "pending";
      });
      this.socket.on("connect_error", (error) => {
        console.log("Connection error", error.message);
      });
      this.socket.on("uniquenessError", (message) => {
        console.log("Error:", message);
        // process.exit(1);
      });
      this.socket.connect();
    });
  }
  addMessageHandler(fn: MessageHandler) {
    this.socket.on("message", fn);
  }
  removeMessageHandler(fn: MessageHandler) {
    this.socket.off("message", fn);
  }
  send(message: object) {
    this.socket.emit("message", {
      from: this.peerId,
      target: "all",
      message: message,
    });
  }
  sendTo(targetPeerId: string, message: object) {
    this.socket.emit("messageOne", {
      from: this.peerId,
      target: targetPeerId,
      message: message,
    });
  }
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
