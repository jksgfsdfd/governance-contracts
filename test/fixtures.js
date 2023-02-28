const { ethers } = require("hardhat");

async function fixture() {
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

module.exports = {
  fixture,
};
