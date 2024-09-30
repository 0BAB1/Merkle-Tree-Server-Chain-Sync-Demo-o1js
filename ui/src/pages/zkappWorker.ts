import { Mina, PublicKey, fetchAccount, Field } from 'o1js';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import type { TreeM, MerkleWitness10} from '../../../contracts/src/TreeM';

const state = {
  TreeM: null as null | typeof TreeM,
  zkapp: null as null | TreeM,
  transaction: null as null | Transaction,
};

// ---------------------------------------------------------------------------------------

const functions = {
  setActiveInstanceToDevnet: async (args: {}) => {
    const Network = Mina.Network(
      'https://api.minascan.io/node/devnet/v1/graphql'
    );
    console.log('Devnet network instance configured.');
    Mina.setActiveInstance(Network);
  },
  loadContract: async (args: {}) => {
    const { TreeM } = await import('../../../contracts/build/src/TreeM.js');
    state.TreeM = TreeM;
  },
  compileContract: async (args: {}) => {
    await state.TreeM!.compile();
  },
  fetchAccount: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    return await fetchAccount({ publicKey });
  },
  initZkappInstance: async (args: { publicKey58: string }) => {
    const publicKey = PublicKey.fromBase58(args.publicKey58);
    state.zkapp = new state.TreeM!(publicKey);
  },
  getRoot: async (args: {}) => {
    const currentRoot = await state.zkapp!.treeRoot.get();
    return JSON.stringify(currentRoot.toJSON());
  },
  createUpdateTransaction: async (args: {
    witness : MerkleWitness10,
    numberBefore : Field,
    incrementAmount : Field
  }) => {
    const transaction = await Mina.transaction(async () => {
      await state.zkapp!.update(args.witness, args.numberBefore, args.incrementAmount);
    });
    state.transaction = transaction;
  },
  proveUpdateTransaction: async (args: {}) => {
    await state.transaction!.prove();
  },
  getTransactionJSON: async (args: {}) => {
    return state.transaction!.toJSON();
  },
};

// ---------------------------------------------------------------------------------------

export type WorkerFunctions = keyof typeof functions;

export type ZkappWorkerRequest = {
  id: number;
  fn: WorkerFunctions;
  args: any;
};

export type ZkappWorkerReponse = {
  id: number;
  data: any;
};

if (typeof window !== 'undefined') {
  addEventListener(
    'message',
    async (event: MessageEvent<ZkappWorkerRequest>) => {
      const returnData = await functions[event.data.fn](event.data.args);

      const message: ZkappWorkerReponse = {
        id: event.data.id,
        data: returnData,
      };
      postMessage(message);
    }
  );
}

console.log('Web Worker Successfully Initialized.');
