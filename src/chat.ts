import { create } from "zustand";

type PeersStore = {
  peers: { [key: number]: string };
  addPeer: (peerId: string) => void;
};

const peersStore = create<PeersStore>()((set) => ({
  peers: {},
  addPeer: (peerId: string) =>
    set((state) => {
      return {
        peers: { ...state.peers, [peerId]: { peerId } },
      };
    }),
}));

export default peersStore;
