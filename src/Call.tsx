import { useParams } from "react-router-dom";
import SignalingChannel, {
  AnswerMessage,
  IceCandidateMessage,
  Message,
  OfferMessage,
} from "./signaling";
import ShortUniqueId from "short-unique-id";
import { FC, PropsWithChildren, useCallback, useEffect, useState } from "react";
import usePeersStore, { Peer } from "./chat";
import { useShallow } from "zustand/react/shallow";
import useSWR from "swr";
import { loadAudio } from "./audio";

const configuration = {
  iceServers: [
    {
      urls: "turn:yoturn.andho.xyz",
      username: "admin",
      credential: "Iex4laePhahthaequierae4odieSh8Fe",
    },
  ],
};

const url = "https://yosignal.andho.xyz";
const token = "SIGNALING123";
const idGenerator = new ShortUniqueId({ length: 10 });

const audioSrc = "/audio/yo.mp3";
//const audioSrc = "http://localhost:5173/audio/the_xx_-_intro.mp3";

export default function Call() {
  const { callId } = useParams();
  const [peerId] = useState(idGenerator.rnd());
  const peers = usePeersStore((state) => state.peers);
  const [src, setSrc] = useState<string>();
  const [start, setStart] = useState(false);
  //console.log("peers", peers);
  const [signalingService] = useState(new SignalingChannel(peerId, url, token));

  const { data: audio } = useSWR(src, async (src_) => {
    return loadAudio(src_);
  });

  //console.log("audio", audio);

  //useEffect(() => {
  //  if (audio) {
  //    const src = ctx.createBufferSource();
  //    src.buffer = audio;
  //    //src.connect(bq);

  //    src.start();
  //  }
  //}, [audio]);

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

  const handleOffer = useCallback(
    async (peerId: string, offer: OfferMessage) => {
      console.log("received offer");
      // @todo if making offer, don't do anything

      const peer = peers[peerId];

      const offerCollision =
        peer?.makingOffer || peer?.conn.signalingState !== "stable";

      if (!peer?.bePolite && offerCollision) {
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
        setDataChannel(peerId, channel);
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
    [addPeer, peers, setDataChannel, signalingService]
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

  const handleStart = useCallback(() => {
    setSrc(audioSrc);
    setStart(true);
  }, []);

  return (
    <div>
      {!start && <button onClick={handleStart}>Start</button>}
      <div className="">
        <div>Call {callId}</div>
        <div className="flex gap-4 p-5">
          <ul>
            {Object.values(peers).map((peer) => (
              <PeerCircle key={peer.peerId} peer={peer} audio={audio} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function playYo(audio: AudioBuffer) {
  const ctx = new AudioContext();
  const src = ctx.createBufferSource();

  //const g = ctx.createGain();
  //g.gain.value = 4;
  //g.connect(ctx.destination);

  //const bq = ctx.createBiquadFilter();
  //bq.type = "lowpass";
  //bq.frequency.value = 2000;
  //bq.gain.value = 0;
  //bq.connect(g);
  //bq.connect(ctx.destination);

  src.buffer = audio;
  src.connect(ctx.destination);
  console.log("playing yo");
  src.start();
}

type PeerCircleProps = {
  peer: Peer;
  audio?: AudioBuffer;
};

//type PeerStatus = {
//  canTrickleIce: boolean;
//  connStatus: string;
//  iceConnectionStatus: string;
//  iceGatheringStatus: string;
//  signalingState: string;
//  dataChannelStatus: string;
//};

const PeerCircle: FC<PeerCircleProps> = ({ peer, audio }) => {
  //const [peerStatus, setPeerStatus] = useState<PeerStatus>({
  //  canTrickleIce: false,
  //  connStatus: "",
  //  iceConnectionStatus: "",
  //  iceGatheringStatus: "",
  //  signalingState: "",
  //  dataChannelStatus: "",
  //});

  const handleSendPress = useCallback(async (peer: Peer) => {
    peer.dataChannel?.send("yo");
  }, []);

  useEffect(() => {
    const dataChannel = peer.dataChannel;

    if (!dataChannel) {
      return;
    }

    const abortController = new AbortController();
    const signal = abortController.signal;

    console.log("setting up data channel handlers");
    dataChannel.addEventListener(
      "open",
      (event) => console.log("channel open", event),
      { signal }
    );
    dataChannel.addEventListener(
      "close",
      (event) => console.log("channel close", event),
      { signal }
    );
    dataChannel.addEventListener(
      "error",
      (event) => console.log("channel error", event),
      { signal }
    );
    dataChannel.addEventListener(
      "message",
      (event) => {
        console.log("channel message", event);
        if (!audio) {
          console.log("audio not available");
          return;
        }
        playYo(audio);
      },
      { signal }
    );

    //peer.conn.addEventListener(
    //  "connectionstatechange",
    //  () =>
    //    setPeerStatus((prev) => ({
    //      ...prev,
    //      connStatus: peer.conn.connectionState,
    //    })),
    //  { signal }
    //);

    //peer.conn.addEventListener(
    //  "iceconnectionstatechange",
    //  () =>
    //    setPeerStatus((prev) => ({
    //      ...prev,
    //      iceConnectionStatus: peer.conn.iceConnectionState,
    //    })),
    //  { signal }
    //);

    //peer.conn.addEventListener(
    //  "iceconnectionstatechange",
    //  () =>
    //    setPeerStatus((prev) => ({
    //      ...prev,
    //      iceGatheringStatus: peer.conn.iceGatheringState,
    //    })),
    //  { signal }
    //);

    //peer.conn.addEventListener(
    //  "iceconnectionstatechange",
    //  () =>
    //    setPeerStatus((prev) => ({
    //      ...prev,
    //      signalingState: peer.conn.signalingState,
    //    })),
    //  { signal }
    //);

    return () => abortController.abort();
  }, [audio, peer]);

  return (
    <li className="border border-slate-200 rounded-lg bg-white p-3 flex flex-col gap-y-1 max-w-[300px]">
      <div>
        <span>Peer: </span>
        <span className="font-bold">{peer.peerId}</span>
      </div>
      <Button onClick={() => handleSendPress(peer)} disabled={!audio}>
        Send
      </Button>
      <div className="flex flex-col text-md">
        <ul>
          <li>Conn status: {peer.conn.connectionState || "-"}</li>
          <li>Ice conn status: {peer.conn.iceConnectionState || "-"}</li>
          <li>Ice gathering status: {peer.conn.iceGatheringState || "-"}</li>
          <li>Signaling State: {peer.conn.signalingState || "-"}</li>
          <li>
            Can Trickle: {peer.conn.canTrickleIceCandidates ? "yes" : "no"}
          </li>
        </ul>
      </div>
      <div className="flex flex-col">
        <span>Local description: </span>
        {peer.conn.localDescription?.sdp}
      </div>
      <div className="flex flex-col">
        <span>Remote description: </span>
        {peer.conn.remoteDescription?.sdp}
      </div>
    </li>
  );
};

type ButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

const Button: FC<PropsWithChildren<ButtonProps>> = ({
  onClick,
  disabled = false,
  children,
}) => (
  <button
    className={`${
      disabled
        ? "bg-sky-300 text-sky-200"
        : "bg-sky-600 text-sky-50 hover:bg-sky-500"
    } rounded-md p-0.5 transition:color duration-100`}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);
