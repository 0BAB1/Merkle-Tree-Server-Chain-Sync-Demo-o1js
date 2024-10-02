import { Mina, PublicKey, fetchAccount, Field, MerkleTree, MerkleWitness } from 'o1js';

type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;

// ---------------------------------------------------------------------------------------

import { TreeM } from '../../../contracts/src/TreeM';

const state = {
  TreeM: null as null | typeof TreeM,
  zkapp: null as null | TreeM,
  transaction: null as null | Transaction,
};

class MerkleWitness10 extends MerkleWitness(10){}

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
    treeJson : string,
    leaf : string,
    numberBefore : string,
    incrementAmount : string
  }) => {
    const transaction = await Mina.transaction(async () => {
      // get the JSON stringified tree representation and deserielize it
      const treeObject = JSON.parse(args.treeJson);
      const tempTree = new MerkleTree(10);
      for (const [nodeKey , nodeValue] of Object.entries<{}>(treeObject.tree.nodes)) {
        for (const [innerKey, innerValue ] of Object.entries<string>(nodeValue)) {
          tempTree.nodes[Number(nodeKey)] = {};
          tempTree.nodes[Number(nodeKey)][innerKey] = Field(BigInt(innerValue));
        }
      }
      //loading zeroes
      for(let i = 0; i < 10; i++){
        tempTree.zeroes[i] = Field(BigInt(treeObject.tree.zeroes[i]));
      }
      // generate a witness to send to the contract
      const tempWitness = new MerkleWitness10(tempTree.getWitness(BigInt(args.leaf)));
      await state.zkapp!.update(tempWitness, Field(Number(args.numberBefore)), Field(Number(args.incrementAmount)));
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
