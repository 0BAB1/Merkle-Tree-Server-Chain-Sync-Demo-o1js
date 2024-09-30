import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from 'fs';
import path from 'path';
import {MerkleTree} from "o1js";
const dataFilePath = path.join(process.cwd(), 'data/tree.json');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      console.log(req.body);
      const { tree } = req.body;
      const newTree = new MerkleTree(tree.height);
      newTree.nodes = tree.nodes;
      
      console.log(newTree);
      // Write updated data back to the JSON file
      await fs.writeFile(dataFilePath, JSON.stringify(newTree,null,2), "utf-8");

      res.status(200).json({ message: 'Data updated successfully,recieved data payload as tree in res body', tree });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update data', error: error });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
