import { Field, PublicKey, MerkleTree, MerkleWitness } from 'o1js';
import { useEffect, useState } from 'react';
import './reactCOIServiceWorker';
import ZkappWorkerClient from './zkappWorkerClient';
import { ChangeEvent, FormEvent } from 'react';

let transactionFee = 0.1;
const ZKAPP_ADDRESS = 'B62qpbRHo9Wy8YA4Xyoo8V5KNKZBWeSfAAM9NcJzfsAQoNBZRADY1EZ';

class MerkleWitness10 extends MerkleWitness(10){}

async function fetchTree() : Promise<MerkleTree>{
  /**
   * This function fetches merkleTree data from the server.
   * It implements a custom deserialization of the data to enable full
   * compatibility.
   */
  const res = await fetch('http://localhost:3000/api/getTree');
  if (!res.ok) {
      throw new Error(`Error: ${res.status}`);
  }
  const resData  = await res.json();
  const initalTree = new MerkleTree(resData.loadedTree.height);
  initalTree.nodes = resData.loadedTree.nodes;
  //loading nodes
  console.log("loading nodes...")
  for (const [nodeKey , nodeValue] of Object.entries<{}>(resData.loadedTree.nodes)) {
      for (const [innerKey, innerValue ] of Object.entries<string>(nodeValue)) {
          initalTree.nodes[Number(nodeKey)] = {};
          initalTree.nodes[Number(nodeKey)][innerKey] = Field(BigInt(innerValue));
      }
  }
  //loading zeroes
  for(let i = 0; i < 10; i++){
      initalTree.zeroes[i] = Field(BigInt(resData.loadedTree.zeroes[i]));
  }
  console.log("Tree fetched successfuly !");
  return initalTree;
}

export default function Home() {
  const [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasWallet: null as null | boolean,
    hasBeenSetup: false,
    accountExists: false,
    currentRoot: null as null | Field,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
  });

  const [displayText, setDisplayText] = useState('');
  const [transactionlink, setTransactionLink] = useState('');

  const [userInputValue, setUserInputValue] = useState('');
  const [userInputLeaf, setUserInputLeaf] = useState('');

  // Local merkle tree HAVE TO SYNC WITH SERVER AFER CHAIN IS UPDATED
  const [localMerkleTree, setLocalMerkleTree] = useState(new MerkleTree(10));

  // -------------------------------------------------------
  // Do Setup

  useEffect(() => {
    async function timeout(seconds: number): Promise<void> {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, seconds * 1000);
      });
    }

    (async () => {
      if (!state.hasBeenSetup) {
        setDisplayText('Loading web worker...');
        console.log('Loading web worker...');
        const zkappWorkerClient = new ZkappWorkerClient();
        await timeout(5);

        setDisplayText('Done loading web worker');
        console.log('Done loading web worker');

        await zkappWorkerClient.setActiveInstanceToDevnet();

        const mina = (window as any).mina;

        if (mina == null) {
          setState({ ...state, hasWallet: false });
          return;
        }

        const publicKeyBase58: string = (await mina.requestAccounts())[0];
        const publicKey = PublicKey.fromBase58(publicKeyBase58);

        console.log(`Using key:${publicKey.toBase58()}`);
        setDisplayText(`Using key:${publicKey.toBase58()}`);

        setDisplayText('Checking if fee payer account exists...');
        console.log('Checking if fee payer account exists...');

        const res = await zkappWorkerClient.fetchAccount({
          publicKey: publicKey!,
        });
        const accountExists = res.error == null;

        await zkappWorkerClient.loadContract();

        console.log('Compiling zkApp...');
        setDisplayText('Compiling zkApp...');
        await zkappWorkerClient.compileContract();
        console.log('zkApp compiled');
        setDisplayText('zkApp compiled...');

        setDisplayText('Fetching server Merkle Tree...');
        console.log("fetching tree from server...");
        const localTree = await fetchTree();
        setLocalMerkleTree(localTree);
        setDisplayText('Server Merkle Tree fetched...');
        console.log("tree fetched");

        const zkappPublicKey = PublicKey.fromBase58(ZKAPP_ADDRESS);

        await zkappWorkerClient.initZkappInstance(zkappPublicKey);

        console.log('Getting zkApp state...');
        setDisplayText('Getting zkApp state...');
        await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey });
        const currentRoot = await zkappWorkerClient.getRoot();
        console.log(`Current state in zkApp: ${currentRoot.toString()}`);
        setDisplayText('');

        setState({
          ...state,
          zkappWorkerClient,
          hasWallet: true,
          hasBeenSetup: true,
          publicKey,
          zkappPublicKey,
          accountExists,
          currentRoot,
        });
      }
    })();
  }, []);

  // -------------------------------------------------------
  // Wait for account to exist, if it didn't

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.accountExists) {
        for (;;) {
          setDisplayText('Checking if fee payer account exists...');
          console.log('Checking if fee payer account exists...');
          const res = await state.zkappWorkerClient!.fetchAccount({
            publicKey: state.publicKey!,
          });
          const accountExists = res.error == null;
          if (accountExists) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        setState({ ...state, accountExists: true });
      }
    })();
  }, [state.hasBeenSetup]);

  // -------------------------------------------------------
  // Send a transaction

  const onSendTransaction = async (event : FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState({ ...state, creatingTransaction: true });

    setDisplayText('Creating a transaction...');
    console.log('Creating a transaction...');

    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.publicKey!,
    });

    setDisplayText('Generating witness...');
    console.log('Generating witness...');

    const tempWitness = new MerkleWitness10(localMerkleTree.getWitness(BigInt(userInputLeaf)));

    setDisplayText('Witeness generated !');
    console.log('Witness generated !');

    setDisplayText('Generating TX !');
    console.log('Generating TX !');

    await state.zkappWorkerClient!.createUpdateTransaction(
      JSON.stringify({tree : localMerkleTree}),
      userInputLeaf,
      String(localMerkleTree.getLeaf(BigInt(userInputLeaf))),
      userInputValue
    );  

    setDisplayText('Creating proof...');
    console.log('Creating proof...');
    await state.zkappWorkerClient!.proveUpdateTransaction();

    console.log('Requesting send transaction...');
    setDisplayText('Requesting send transaction...');
    const transactionJSON = await state.zkappWorkerClient!.getTransactionJSON();

    setDisplayText('Getting transaction JSON...');
    console.log('Getting transaction JSON...');
    const { hash } = await (window as any).mina.sendTransaction({
      transaction: transactionJSON,
      feePayer: {
        fee: transactionFee,
        memo: '',
      },
    });

    const transactionLink = `https://minascan.io/devnet/tx/${hash}`;
    console.log(`View transaction at ${transactionLink}`);

    setTransactionLink(transactionLink);
    setDisplayText(transactionLink);

    setState({ ...state, creatingTransaction: false });
  };

  // -------------------------------------------------------
  // Refresh the current state

  const onRefreshCurrentRoot = async () => {
    console.log('Getting zkApp state...');
    setDisplayText('Getting zkApp state...');

    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.zkappPublicKey!,
    });
    const currentRoot = await state.zkappWorkerClient!.getRoot();
    setState({ ...state, currentRoot });
    console.log(`Current state in zkApp: ${currentRoot.toString()}`);
    setDisplayText('');
  };

  // -------------------------------------------------------
  // Create UI elements

  let hasWallet;
  if (state.hasWallet != null && !state.hasWallet) {
    const auroLink = 'https://www.aurowallet.com/';
    const auroLinkElem = (
      <a href={auroLink} target="_blank" rel="noreferrer">
        Install Auro wallet here
      </a>
    );
    hasWallet = <div>Could not find a wallet. {auroLinkElem}</div>;
  }

  const stepDisplay = transactionlink ? (
    <a
      href={transactionlink}
      target="_blank"
      rel="noreferrer"
    >
      View transaction
    </a>
  ) : (
    displayText
  );

  let setup = (
    <div>
      {stepDisplay}
      {hasWallet}
    </div>
  );

  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.accountExists) {
    const faucetLink =
      'https://faucet.minaprotocol.com/?address=' + state.publicKey!.toBase58();
    accountDoesNotExist = (
      <div>
        <span>Account does not exist.</span>
        <a href={faucetLink} target="_blank" rel="noreferrer">
          Visit the faucet to fund this fee payer account
        </a>
      </div>
    );
  }

  let mainContent;
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = (
      <div>
        <div>
          Current state in zkApp: {state.currentRoot!.toString()}{' '} <br></br>
          Current local tree root : {localMerkleTree.getRoot().toString()}
        </div>
        <div>
          <form onSubmit={onSendTransaction}>
            <input
              type="text"
              value={userInputValue}
              onChange={ (event : ChangeEvent<HTMLInputElement>) : void => {
                setUserInputValue(event.target.value);
              }}
              placeholder="Increment amount"
            />
            <input
              type="text"
              value={userInputLeaf.toString()}
              onChange={ (event : ChangeEvent<HTMLInputElement>) : void => {
                setUserInputLeaf(event.target.value);
              }}
              placeholder="Leaf ID"
            />
            <button 
              type="submit"
              // disabled = {state.creatingTransaction}
            >
              Increment the data
            </button>
          </form>
          <button onClick={onRefreshCurrentRoot}>
            Get Latest State
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        {setup}
        {accountDoesNotExist}
        {mainContent}
      </div>
    </>
  );
}
