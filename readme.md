# Basic Merkle Tree : Server / Chain Sync demo

The pupose of this demo is to serve as a base for proofs of concepts using merkle trees.

It offers a simple API on the server side to manipulate a Merklte tree stored on the server as JSON.

This repos wills erve as a base for my future proofs of concepts, feel free to also use it (NOT FOR PRODUCTION THOUGH) as the code from the MINA tutorial were discontinued.

## Server API

Here are what the API allows the develloper to do :
- Initiate a dummy tree
- Fetch the tree
- Update the tree

## Contracts

On the contract side, we have a basic merkle tree implementation (TreeM) that verifies the witness before applying changes.
This allow the dev the initaite the sync on the server if the TX was sucessful (ie offchain data was legit and not tempred with).

For now, it only has a simple main.ts, emulating client-side running code, that show how to interacts with the contract & the server API, all from the client POV.

### Problems and future works 

- No test case (will do, this is just a save)
- Anyone can break the app by bypassing the server to send transaction to the chain. It will not break the TRUST but rather the FUNCTIONNALITY off the app by tempering with th synchrnoasition (will fix by adding a server signature ? idk yet, this is NOT for production so i'll see)