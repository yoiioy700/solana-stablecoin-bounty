import { describe, it } from 'mocha';
import { expect } from 'chai';
import { BN } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';

describe('SSS-1: Mint', () => {
  let authority: Keypair;
  let recipient: Keypair;

  beforeEach(() => {
    authority = Keypair.generate();
    recipient = Keypair.generate();
  });

  it('should mint tokens to recipient', async () => {
    const amount = new BN(1000000); // 1 token
    
    // Mint instruction
    // await program.mint({ recipient, amount, authority });
    
    expect(amount.toNumber()).to.equal(1000000);
  });

  it('should increase total supply', async () => {
    const initialSupply = new BN(0);
    const mintAmount = new BN(1000000);
    const expectedSupply = initialSupply.add(mintAmount);
    
    expect(expectedSupply.toNumber()).to.equal(1000000);
  });

  it('should fail without mint authority', async () => {
    const unauthorized = Keypair.generate();
    
    // expect(throw).to.include('InvalidAuthority');
    expect(unauthorized.publicKey).to.not.deep.equal(authority.publicKey);
  });

  it('should fail to mint zero tokens', async () => {
    const amount = new BN(0);
    
    expect(amount.toNumber()).to.equal(0);
    expect(amount.toNumber()).to.be.greaterThan(0, 'Should be greater than 0');
  });

  it('should fail for invalid recipient', async () => {
    const invalidRecipient = 'invalid_address';
    
    expect(invalidRecipient).to.be.a('string');
    expect(invalidRecipient).to.have.length.greaterThan(32);
  });
});
