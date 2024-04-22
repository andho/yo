import { useCallback, useEffect, useRef, useState } from "react";
import ShortUniqueId from "short-unique-id";
import "./App.css";
import SignalingChannel, { Message } from "./signaling";

const configuration = {
  iceServers: [
    {
      urls: "turn:yoturn.andho.xyz",
      username: "admin",
      credential: "Iex4laePhahthaequierae4odieSh8Fe",
    },
  ],
  iceTransportPolicy: "all",
};
const url = "http://localhost:3030";
const token = "SIGNALING123";
const idGenerator = new ShortUniqueId({ length: 10 });
const peerId = idGenerator.rnd();

function App() {
  const onceRef = useRef(false);
  const [makingOffer, setMakingOffer] = useState(false);

  const channelRef = useRef<SignalingChannel>(
    new SignalingChannel(peerId, url, token)
  );
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection>(
    new RTCPeerConnection(configuration)
  );
  const [dataChannel, setDataChannel] = useState<RTCDataChannel>();

  useEffect(() => {
    if (onceRef.current) {
      return;
    }

    onceRef.current = true;

    const connect = async () => {
      console.log("trying to connect", peerId);
      channelRef.current.onMessage = async (parcel: Message) => {
        console.debug("parcel", parcel);
        if (!("message" in parcel)) {
          return;
        }
        const { message } = parcel;
        if ("offer" in message) {
          if (makingOffer || peerConnection.signalingState !== "stable") {
            console.log("not looking for offers a the time. reject offer");
            return;
          }

          peerConnection.addEventListener("icecandidate", ({ candidate }) => {
            console.log("candidate", candidate);
            channelRef.current.send({ candidate });
          });

          peerConnection.addEventListener("datachannel", ({ channel }) => {
            console.log("data channel", channel);
            setDataChannel(channel);
          });

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(message.offer)
          );
          await peerConnection.setLocalDescription();
          channelRef.current.send({ answer: peerConnection.localDescription });
        }

        if ("answer" in message) {
          const remoteDesc = new RTCSessionDescription(message.answer);
          console.log("state", peerConnection.connectionState);
          console.log("ice state", peerConnection.iceConnectionState);
          console.log("ice gathering", peerConnection.iceGatheringState);
          console.log("signaling state", peerConnection.signalingState);
          await peerConnection.setRemoteDescription(remoteDesc);
          console.log("accepted answer");
        }

        if ("candidate" in message) {
          try {
            await peerConnection.addIceCandidate(message.candidate);
            console.log("added remote ice candidate");
          } catch (e) {
            console.error("ice candidate error", e);
          }
        }

        //if (message.iceCandidate) {
        //  try {
        //    await peerConnection.addIceCandidate(message.iceCandidate);
        //  } catch (e) {
        //    console.error('Error adding received ice candidate', e);
        //  }
        //}
      };

      //peerConnection.addEventListener("icecandidate", async (event) => {
      //  if (event.candidate) {
      //    console.log("sending local ice candidate to remote", event.candidate);
      //    channelRef.current.send({ "new-ice-candidate": event.candidate });
      //  }
      //});
      //peerConnection.addEventListener("connectionstatechange", (event) => {
      //  console.log("connection status", event);
      //});
      //peerConnection.addEventListener("iceconnectionstatechange", (event) => {
      //  console.log("ice connection status", event);
      //});

      await channelRef.current.connect();

      //const offer = await peerConnection.createOffer();
      //await peerConnection.setLocalDescription(offer);
      //console.log("state", peerConnection.connectionState);
      //console.log("ice state", peerConnection.iceConnectionState);
      //console.log("sending peer offer");
      //channelRef.current.send({ offer });
    };

    connect();
  }, [peerConnection]);

  const handleCreate = useCallback(() => {
    const sendChannel = peerConnection.createDataChannel("sendChannel");
    setDataChannel(sendChannel);

    peerConnection.addEventListener("negotiationneeded", async () => {
      setMakingOffer(true);
      try {
        await peerConnection.setLocalDescription();
        channelRef.current.send({ offer: peerConnection.localDescription });
      } catch (e) {
        console.error(e);
      } finally {
        setMakingOffer(false);
      }
    });

    peerConnection.addEventListener("icecandidate", ({ candidate }) => {
      console.log("candidate", candidate);
      channelRef.current.send({ candidate });
    });
  }, [peerConnection]);

  useEffect(() => {
    if (!dataChannel) {
      return;
    }

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
  }, [dataChannel]);

  const handleSend = useCallback(() => {
    dataChannel?.send(`${Math.random()}`);
  }, [dataChannel]);

  return (
    <div>
      <button onClick={handleCreate}>Create call</button>
      <button onClick={handleSend}>Send</button>
    </div>
  );
}

export default App;
