import { Field, PublicKey, MerkleTree, MerkleWitness, PendingTransaction } from 'o1js';
import { useEffect, useState } from 'react';
import './reactCOIServiceWorker';
import ZkappWorkerClient from './zkappWorkerClient';
import { ChangeEvent, FormEvent } from 'react';
import { stat } from 'fs';
import {Tooltip} from "../components/ToolTipsProps"

let transactionFee = 0.1;
const ZKAPP_ADDRESS = 'B62qm6HB5scBLahNUPbX9XLUHHNirzCVESTcCehb8C2NrAoEyf5zZyx';

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
          initalTree.nodes[Number(nodeKey)][innerKey] = Field(Number(innerValue));
      }
  }
  //loading zeroes
  for(let i = 0; i < 10; i++){
      initalTree.zeroes[i] = Field(BigInt(resData.loadedTree.zeroes[i]));
  }
  console.log("Tree fetched successfuly !");
  return initalTree;
}

async function updateServerTree(localTree : MerkleTree) : Promise<any>{
  const response = await fetch('http://localhost:3000/api/updateTree', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          tree : localTree,
      }), // Convert the object to a JSON string
  });
  return response.json();
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
  const [userSearchLeaf, setUserSearchLeaf] = useState('');
  const [searchLeafResult, setSearchLeafResult] = useState('');

  // Local merkle tree HAVE TO SYNC WITH SERVER AFER CHAIN IS UPDATED
  const [localMerkleTree, setLocalMerkleTree] = useState(new MerkleTree(10));
  // Server tree for sync information
  const [fetchedServerMerkleTree, setFetchedServerMerkleTree] = useState(new MerkleTree(10));

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
        const fetchedTree = await fetchTree();
        setLocalMerkleTree(fetchedTree);
        setFetchedServerMerkleTree(fetchedTree);
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

        console.log((localMerkleTree.getRoot().toString() == state.currentRoot?.toString()))

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

    try{
      setDisplayText('Creating a transaction...');
      console.log('Creating a transaction...');
      await state.zkappWorkerClient!.fetchAccount({
        publicKey: state.publicKey!,
      });
    }catch{
      setDisplayText('Error creating the TX');
      console.log("error creating th TX");
      setState({ ...state, creatingTransaction: false });
    }

    try{
      setDisplayText('Generating TX !');
      console.log('Generating TX !');
      await state.zkappWorkerClient!.createUpdateTransaction(
        JSON.stringify({tree : localMerkleTree}),
        userInputLeaf,
        String(localMerkleTree.getLeaf(BigInt(userInputLeaf))),
        userInputValue
      );
    }catch{
      setDisplayText('error generating the TX');
      console.log('error generating the TX');
      setState({ ...state, creatingTransaction: false });
    }

    try{
      setDisplayText('Creating proof...');
      console.log('Creating proof...');
      await state.zkappWorkerClient!.proveUpdateTransaction();

      setDisplayText('Getting transaction JSON...');
      console.log('Getting transaction JSON...');
      const transactionJSON = await state.zkappWorkerClient!.getTransactionJSON();

      console.log('Requesting send transaction...');
      setDisplayText('Requesting send transaction...');
      const pendingTransaction = await (window as any).mina.sendTransaction({
        transaction: transactionJSON,
        feePayer: {
          fee: transactionFee,
          memo: '',
        },
      });

      const transactionLink = `https://minascan.io/devnet/tx/${pendingTransaction.hash}`;
      console.log(`View transaction at ${transactionLink}`);

      setTransactionLink(transactionLink);
      setDisplayText(`View transaction at ${transactionLink}`);

      // update local tree with changes
      const tempTree = localMerkleTree;
      tempTree.setLeaf(
        BigInt(userInputLeaf),
        tempTree.getLeaf(BigInt(userInputLeaf)).add(Field(Number(userInputValue)))
      );
      setLocalMerkleTree(tempTree);

      // and sync server tree with local tree
      const respose = await updateServerTree(localMerkleTree);
    }catch{
      setDisplayText('error sending the TX to the chain');
      console.log('error sending the TX to the chain');
      setState({ ...state, creatingTransaction: false });
    }

    setState({ ...state, creatingTransaction: false });
  };

  // -------------------------------------------------------
  // Search for latest server tree data

  const onSearchTree = async (event : FormEvent<HTMLFormElement>) : Promise<void> => {
    event.preventDefault();
    const tempSearchTree = await fetchTree();
    setSearchLeafResult(tempSearchTree.getLeaf(BigInt(userSearchLeaf)).toString());
  };

  // -------------------------------------------------------
  // Refresh the current state

  const onRefreshCurrentRoot = async () => {
    // Get the contract Infos
    console.log('Getting zkApp state...');
    setDisplayText('Getting zkApp state...');
    await state.zkappWorkerClient!.fetchAccount({
      publicKey: state.zkappPublicKey!,
    });
    const currentRoot = await state.zkappWorkerClient!.getRoot();
    setState({ ...state, currentRoot });
    console.log(`Current state in zkApp: ${currentRoot.toString()}`);
    setDisplayText('');

    // Get the server infos
    setFetchedServerMerkleTree(await fetchTree());

    console.log(localMerkleTree.getRoot().toString(),state.currentRoot?.toString());
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
        <div className='status-wrapper'>
          <Tooltip text={"Local tree root : " + localMerkleTree.getRoot().toString().slice(0,7) + "... Chain state : " + state.currentRoot!.toString().slice(0,7)+ "..."} >
            <div className='status'>
              Local Sync w.r.t. Chain
              <div className={(localMerkleTree.getRoot().toString() == state.currentRoot?.toString()) ? "status-okay" : "status-not-okay"}></div>
            </div>
          </Tooltip>
          <Tooltip text={"Last fetched server root : " + localMerkleTree.getRoot().toString().slice(0,7) + "... Chain state : " + state.currentRoot!.toString().slice(0,7)+ "..."}>
            <div className='status'>
              Server Sync w.r.t. Chain
              <div className={(localMerkleTree.getRoot().toString() == state.currentRoot?.toString()) ? "status-okay" : "status-not-okay"}></div>
            </div>
          </Tooltip>
        </div>
        <div>

          <form onSubmit={onSearchTree}>
            <input
              type="text"
              value={userSearchLeaf}
              onChange={ (event : ChangeEvent<HTMLInputElement>) : void => {
                setUserSearchLeaf(event.target.value);
              }}
              placeholder="Search for a leaf value on the server"
              className="simple-input"
            />
            <button 
              type="submit"
              // disabled = {state.creatingTransaction}
              className='simple-button'
            >
              Search
            </button>
          </form>

          <p>Search leaf result {searchLeafResult ? searchLeafResult : "   ===> no search done yet ! lunch a search to get a result !"}</p>

          <form onSubmit={onSendTransaction}>
            <input
              type="text"
              value={userInputValue}
              onChange={ (event : ChangeEvent<HTMLInputElement>) : void => {
                setUserInputValue(event.target.value);
              }}
              placeholder="Increment amount"
              className="simple-input"
            />
            <input
              type="text"
              value={userInputLeaf.toString()}
              onChange={ (event : ChangeEvent<HTMLInputElement>) : void => {
                setUserInputLeaf(event.target.value);
              }}
              placeholder="Leaf ID"
              className="simple-input"
            />
            <button 
              type="submit"
              // disabled = {state.creatingTransaction}
              className='simple-button'
            >
              Increment the data
            </button>
          </form>
          <button 
            onClick={onRefreshCurrentRoot}
            className='simple-button'
          >
            Get Latest State
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div>
        <h1>Merkle Tree MINA Demo</h1>
        {setup}
        {accountDoesNotExist}
        {mainContent}
      </div>
    </>
  );
}
