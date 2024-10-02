import {MerkleTree, Field, PrivateKey, Mina, AccountUpdate} from "o1js";
import {MerkleWitness10, TreeM} from  "./TreeM.js";

/**
 *  This file shows a basic example on how to use the API calls and interact with the merkle tree contract on chain
 *  For tou own proofs of concept.
 * 
 *  Don't forget to send a post request to the "initTree" API using curl or postman to set the server @ the right state
 * 
 *  npm run build
 * 
 *  node build/src/main.js
 */

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

// MERKLE TREES, this examples has an associated contract
// That I have to instanciate first to interact with it
const zkAppPrivateKey = PrivateKey.random();
const zkAppPublicKey = zkAppPrivateKey.toPublicKey();

console.log(Field(Field(BigInt("0"))));

const zkAppMerkleTreeInstance = new TreeM(zkAppPublicKey);
await TreeM.compile();

// query merkle tree from the blockchain
console.log("fetching inital tree from the server...");

const initialTree = await fetchTree();

// DEPLOY
console.log("Creating local mina blockchain");

// local chain stuff
const Local = await Mina.LocalBlockchain({
    proofsEnabled : true
});
Mina.setActiveInstance(Local);

const deployerAccount = Local.testAccounts[0];
const deployerKey = deployerAccount.key;
const senderAccount = Local.testAccounts[1];
const senderKey = senderAccount.key;

console.log("deploying the contract...");

// deploying stuff
const deployTx = await Mina.transaction(deployerAccount, async () =>{
    AccountUpdate.fundNewAccount(deployerAccount);
    await zkAppMerkleTreeInstance.deploy();
    await zkAppMerkleTreeInstance.initState(Field(initialTree.getRoot()));
});
await deployTx.prove();
await deployTx.sign([deployerKey, zkAppPrivateKey]);

const pendingDeployTx = await deployTx.send();
await pendingDeployTx.wait();

// INTERACTION

// -----------------------------------------------------------------
// STEP 1 : FETCH FULL MERKLE TREE FROM SERVER

console.log("fetching data from the server...");

const serverTree = await fetchTree();
// serverTree.setLeaf(10n,Field(110)); // comment or uncomment this to show example of tempering with data

console.log("sending TX..");
// We want to modify leaf #10
const witness = new MerkleWitness10(serverTree.getWitness(10n));
// log hashes before
console.log(
    `BasicMerkleTree: local OffChainTree root hash befoer send1: ${serverTree.getRoot()}`
);
console.log(
    `BasicMerkleTree: TreeM contract root hash before send1: ${zkAppMerkleTreeInstance.treeRoot.get()}`
);

// -----------------------------------------------------------------
// STEP 2 : Apply desired changes. Create transaction, run proof, sign, send

const incrementTx = Mina.transaction(senderAccount, async () =>{
    await zkAppMerkleTreeInstance.update(
        witness,
        serverTree.getLeaf(10n),
        Field(9));
});
// TODO ! Attack vector example : people can just send TX and tinker to not update on the server
// this would fuck up the app but would not b reak the trust.
// anyway, if i want to really sync server tree and Smartcontract state, server has to be the one appronving too
// maybe is it possble to get the prrof in the server and requet a server PK sign in order to apply chages to state ?
// Idk men.... for now this will do just fine !
await incrementTx.prove();
await incrementTx.sign([senderKey, zkAppPrivateKey]).send().wait();

// -----------------------------------------------------------------
// Step 3 : Update loacl merkle tree and sync up the server

serverTree.setLeaf(10n, Field(111).add(Field(9)));
const res2 = await fetch('http://localhost:3000/api/updateTree', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        tree : serverTree,
    }), // Convert the object to a JSON string
});

// compare the root of the smart contract tree to our local tree, alegedly the one now present on the server
console.log(
    `BasicMerkleTree: local OffChainTree root hash after send1: ${serverTree.getRoot()}`
);
console.log(
    `TreeM: smart contract root hash after send1: ${zkAppMerkleTreeInstance.treeRoot.get()}`
);