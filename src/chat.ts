import { create } from "zustand";
import { DataConnection } from "peerjs";

export type Peer = {
  peerId: string;
  makingOffer: boolean;
  bePolite: boolean;
};

type PeersStore = {
  peers: Record<string, Peer>;
  addPeer: (peerId: string) => void;
  setMakingOffer: (peerId: string, makingOffer: boolean) => void;
  setBePolite: (peerId: string, bePolite: boolean) => void;
  removePeer: (peerId: string) => void;
  setDataChannel: (peerId: string, channel: DataConnection) => void;
};

const usePeersStore = create<PeersStore>()((set) => ({
  peers: {},
  addPeer: (peerId) =>
    set((state) => ({
      peers: {
        ...state.peers,
        [peerId]: {
          peerId,
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
  setDataChannel: (peerId: string, dataChannel: DataConnection) =>
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
