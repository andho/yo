import { useParams } from "react-router-dom";
import SignalingChannel, {
  AnswerMessage,
  IceCandidateMessage,
  Message,
  OfferMessage,
} from "./signaling";
import ShortUniqueId from "short-unique-id";
import { useCallback, useEffect, useState } from "react";
import usePeersStore, { Peer } from "./chat";
import { useShallow } from "zustand/react/shallow";

const configuration = {
  iceServers: [
    {
      urls: "turn:yoturn.andho.xyz",
      username: "admin",
      credential: "Iex4laePhahthaequierae4odieSh8Fe",
    },
  ],
};

const url = "http://localhost:3030";
const token = "SIGNALING123";
const idGenerator = new ShortUniqueId({ length: 10 });

export default function Call() {
  const { callId } = useParams();
  const [peerId] = useState(idGenerator.rnd());
  const peers = usePeersStore((state) => state.peers);
  //console.log("peers", peers);
  const [signalingService] = useState(new SignalingChannel(peerId, url, token));

  const { addPeer, removePeer, setDataChannel, setMakingOffer, setBePolite } =
    usePeersStore(
      useShallow((state) => ({
        addPeer: state.addPeer,
        removePeer: state.removePeer,
        setDataChannel: state.setDataChannel,
        setMakingOffer: state.setMakingOffer,
        setBePolite: state.setBePolite,
      }))
    );

  const handleNewPeer = useCallback(
    (peerId: string, bePolite: boolean) => {
      console.log("add peer", peerId);
      const pc = new RTCPeerConnection(configuration);
      const dataChannel = pc.createDataChannel("sendChannel");
      console.log("setting up data channel handlers");
      dataChannel.addEventListener("open", (event) =>
        console.log("channel open", event)
      );
      dataChannel.addEventListener("close", (event) =>
        console.log("channel close", event)
      );
      dataChannel.addEventListener("error", (event) =>
        console.log("channel error", event)
      );
      dataChannel.addEventListener("message", (event) =>
        console.log("channel message", event)
      );

      pc.addEventListener("negotiationneeded", async () => {
        setMakingOffer(peerId, true);
        try {
          await pc.setLocalDescription();
          signalingService.sendTo(peerId, { offer: pc.localDescription });
        } catch (e) {
          console.error(e);
        } finally {
          setMakingOffer(peerId, false);
        }
      });

      addPeer(peerId, pc, dataChannel);
      setBePolite(peerId, bePolite);
    },
    [addPeer, setBePolite, setMakingOffer, signalingService]
  );

  const handleRemovePeer = useCallback(
    (peerId: string) => {
      console.log("remove peer", peerId);
      removePeer(peerId);
    },
    [removePeer]
  );

  const handleRemoteDataChannel = useCallback(
    (peerId: string, dataChannel: RTCDataChannel) => {
      const peer = peers[peerId];
      if (!peer) {
        console.log("cannot find peer", peerId);
      }

      dataChannel.addEventListener("open", (event) =>
        console.log("channel open", event)
      );
      dataChannel.addEventListener("close", (event) =>
        console.log("channel close", event)
      );
      dataChannel.addEventListener("error", (event) =>
        console.log("channel error", event)
      );
      dataChannel.addEventListener("message", (event) =>
        console.log("channel message", event)
      );

      setDataChannel(peerId, dataChannel);
    },
    [peers, setDataChannel]
  );

  const handleOffer = useCallback(
    async (peerId: string, offer: OfferMessage) => {
      console.log("received offer");
      // @todo if making offer, don't do anything

      const peer = peers[peerId];

      if (
        (peer?.makingOffer && peer?.bePolite) ||
        peer?.conn.signalingState !== "stable"
      ) {
        console.log("not looking for offers a the time. reject offer");
        return;
      }

      const peerConnection = peer?.conn ?? new RTCPeerConnection(configuration);

      peerConnection.addEventListener("icecandidate", ({ candidate }) => {
        if (!candidate) {
          console.log("empty ice candidate", candidate);
          return;
        }
        console.log("sending ice candidate", candidate);
        signalingService.send({ candidate });
      });

      peerConnection.addEventListener("datachannel", ({ channel }) => {
        console.log("data channel", channel);
        handleRemoteDataChannel(peerId, channel);
      });

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer.offer)
      );
      await peerConnection.setLocalDescription();
      console.log("sending answer");
      signalingService.sendTo(peerId, {
        answer: peerConnection.localDescription,
      });

      addPeer(peerId, peerConnection);
    },
    [addPeer, handleRemoteDataChannel, peers, signalingService]
  );

  const handleAnswer = useCallback(
    async (peerId: string, answer: AnswerMessage) => {
      const peer = peers[peerId];
      if (!peer) {
        console.log("cannot find peer", peerId);
      }

      peer.conn.setRemoteDescription(answer.answer);
    },
    [peers]
  );

  const handleCandidate = useCallback(
    async (peerId: string, candidate: IceCandidateMessage) => {
      const peer = peers[peerId];
      if (!peer) {
        console.log("cannot find peer", peerId);
      }

      console.log("received ice candidate added");
      peer.conn.addIceCandidate(candidate.candidate);
    },
    [peers]
  );

  useEffect(() => {
    const onMessage = async (parcel: Message) => {
      console.log("got message", parcel, parcel.message);
      if (
        parcel.from === "all" &&
        parcel.target === peerId &&
        "connections" in parcel.payload
      ) {
        for (const connection of parcel.payload.connections) {
          handleNewPeer(connection.peerId, parcel.payload.bePolite);
        }
      } else if (parcel.payload?.action === "close") {
        handleRemovePeer(parcel.from);
      } else if (parcel.payload?.action === "open") {
        for (const connection of parcel.payload.connections) {
          handleNewPeer(connection.peerId, parcel.payload.bePolite);
        }
      } else if ("offer" in parcel.message) {
        handleOffer(parcel.from, parcel.message);
      } else if ("answer" in parcel.message) {
        handleAnswer(parcel.from, parcel.message);
      } else if ("candidate" in parcel.message) {
        handleCandidate(parcel.from, parcel.message);
      }
    };

    const connect = async () => {
      signalingService.addMessageHandler(onMessage);
      signalingService.connect();
    };

    connect();

    return () => signalingService.removeMessageHandler(onMessage);
  }, [
    signalingService,
    peerId,
    handleNewPeer,
    handleRemovePeer,
    handleOffer,
    handleAnswer,
    handleCandidate,
  ]);

  const handleSendPress = useCallback((peer: Peer) => {
    peer.dataChannel?.send(`${Math.random()}`);
  }, []);

  return (
    <div>
      <div>Call {callId}</div>
      <div>
        <ul>
          {Object.values(peers).map((peer) => (
            <li key={peer.peerId}>
              {peer.peerId}
              <button onClick={() => handleSendPress(peer)}>Send</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
