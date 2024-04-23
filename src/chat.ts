import { create } from "zustand";

export type Peer = {
  peerId: string;
  conn: RTCPeerConnection;
  makingOffer: boolean;
  bePolite: boolean;
  dataChannel?: RTCDataChannel;
};

type PeersStore = {
  peers: Record<string, Peer>;
  addPeer: (
    peerId: string,
    conn: RTCPeerConnection,
    dataChannel?: RTCDataChannel
  ) => void;
  setMakingOffer: (peerId: string, makingOffer: boolean) => void;
  setBePolite: (peerId: string, bePolite: boolean) => void;
  removePeer: (peerId: string) => void;
  setDataChannel: (peerId: string, channel: RTCDataChannel) => void;
};

const usePeersStore = create<PeersStore>()((set) => ({
  peers: {},
  addPeer: (peerId, conn, dataChannel) =>
    set((state) => ({
      peers: {
        ...state.peers,
        [peerId]: {
          peerId,
          conn,
          dataChannel,
          makingOffer: false,
          bePolite: false,
        },
      },
    })),
  setMakingOffer: (peerId: string, makingOffer: boolean) =>
    set((state) => ({
      peers: {
        ...state.peers,
        [peerId]: {
          ...state.peers[peerId],
          makingOffer,
        },
      },
    })),
  setBePolite: (peerId: string, bePolite: boolean) =>
    set((state) => ({
      peers: {
        ...state.peers,
        [peerId]: {
          ...state.peers[peerId],
          bePolite,
        },
      },
    })),
  removePeer: (peerId) =>
    set((state) => {
      const { [peerId]: _peer, ...rest } = state.peers;
      return {
        peers: {
          ...rest,
        },
      };
    }),
  setDataChannel: (peerId: string, dataChannel: RTCDataChannel) =>
    set((state) => ({
      peers: {
        ...state.peers,
        [peerId]: {
          ...state.peers[peerId],
          dataChannel,
        },
      },
    })),
}));

export default usePeersStore;
