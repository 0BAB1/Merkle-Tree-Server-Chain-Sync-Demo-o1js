import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs} from 'fs';
import path from 'path';
import {MerkleTree, Field} from "o1js";

// Path to the JSON file that stores the tree locally
const dataFilePath = path.join(process.cwd(), 'data/tree.json');

export default async function handler(
    req : NextApiRequest,
    res : NextApiResponse) {
  if (req.method === 'POST') {
    // instantiate an empty merkle tree of height 10 for now
    const initialTree = new MerkleTree(10);
    initialTree.setLeaf(10n,Field(111));
    
    const jsonString = JSON.stringify(initialTree, null, 2);

    try {
        await fs.writeFile(dataFilePath, jsonString);
        console.log('MerkleTree init success ! leaf 10n was set to value Field(111) as initial value to tinker with');
      } catch (error) {
        console.error('Error writing to file', error);
      }

    return res.status(200).json({ message: 'Merle tree init !', jsonString });
  }else{
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
