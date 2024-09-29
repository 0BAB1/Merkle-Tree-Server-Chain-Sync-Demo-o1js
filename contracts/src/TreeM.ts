import {SmartContract, state, Field, State, method, MerkleWitness} from "o1js";

export class MerkleWitness10 extends MerkleWitness(10){};

export class TreeM extends SmartContract{
    @state(Field) treeRoot = State<Field>();

    @method async initState(initialRoot : Field){
        this.treeRoot.set(initialRoot);
    }

    @method async update(
        witness : MerkleWitness10,
        numberBefore : Field,
        incrementAmount : Field
    ){
        const initialRoot = this.treeRoot.getAndRequireEquals();

        // add a condition, the increment amount has to be lower than 20
        incrementAmount.assertLessThan(Field(20));

        // check the witness first to see if off chain data
        // that was used to generate witness matches the contract's
        // root hash
        const rootBefore = witness.calculateRoot(numberBefore);
        initialRoot.assertEquals(rootBefore);

        // if there is a match there is no attempt to cheat
        // we can then we can apply changes
        const newRoot = witness.calculateRoot(
            numberBefore.add(incrementAmount)
        );
        // adn update the root
        this.treeRoot.set(newRoot);

        // if rthis transaction was a success
        // then the off chain tree may be updated
    }
}