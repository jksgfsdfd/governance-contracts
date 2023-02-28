const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

async function initialFixture() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const nextNonce = await deployer.getTransactionCount();
  const governorAddress = ethers.utils.getContractAddress({
    from: deployer.address,
    nonce: nextNonce + 1,
  });
  const Token = await ethers.getContractFactory("MyToken", deployer);
  const token = await Token.deploy(governorAddress);
  await token.deployed();
  const Governor = await ethers.getContractFactory("MyGovernor", deployer);
  const governor = await Governor.deploy(token.address);
  await governor.deployed();

  return {
    token,
    governor,
  };
}

async function proposedFixture() {
  const { governor, token } = await loadFixture(initialFixture);
  const signer = await ethers.getSigner();
  const abi = ["function mint(address,uint256)"];
  const interface = new ethers.utils.Interface(abi);
  const calldata = interface.encodeFunctionData("mint", [signer.address, 1000]);
  const txProposal = await governor.propose(
    [token.address],
    [0],
    [calldata],
    "Proposal to mine 1000wei"
  );
  const receipt = await txProposal.wait();
  const proposalId = receipt.events[0].args[0];
  return {
    governor,
    token,
    proposalId,
  };
}

module.exports = {
  initialFixture,
  proposedFixture,
};
