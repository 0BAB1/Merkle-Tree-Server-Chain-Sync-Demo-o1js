import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from 'fs';
import path from 'path';
import {MerkleTree} from "o1js";

// Path to the JSON file that stores the tree locally
const dataFilePath = path.join(process.cwd(), 'data/tree.json');

export default async function handler(
    req : NextApiRequest,
    res : NextApiResponse) {
  if (req.method === 'GET') {
    try {
        const jsonString = await fs.readFile(dataFilePath, 'utf-8');
        const data : MerkleTree = JSON.parse(jsonString);
    
        const loadedTree : MerkleTree = data;
    
        console.log('MerkleTree loaded from JSON file:', loadedTree);
        return res.status(200).json({ message: 'Merle tree deserialize succes!', loadedTree });

      } catch (error) {
        console.error('Error reading from file', error);
        return res.status(500).json({ message: 'Internal error while deserializing the tree' });
      }
  }else{
    res.status(405).json({ message: 'Method Not Allowed' });
  }
}
