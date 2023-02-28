const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
const { fixture } = require("./fixtures");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Governor", function () {
  it("has setup the Governer Address correctly", async function () {
    const { governor, token } = await loadFixture(fixture);
    expect(await token.governor()).to.equal(governor.address);
  });

  it("has minted 1000e18 tokens for the deployer", async function () {
    const { governor, token } = await loadFixture(fixture);
    const deployer = await ethers.getSigner();
    const balance = await token.balanceOf(deployer.address);
    expect(balance.toString()).to.equal(
      ethers.utils.parseEther("1000").toString()
    );
  });

  it("nobody except the governor can mint tokens", async function () {
    const { governor, token } = await loadFixture(fixture);
    const deployer = await ethers.getSigner();

    await expect(token.mint(deployer.address, 1000)).to.be.reverted;
  });
});

describe("Governor", function () {
  it("starts voting only after 1 extra block has been mined", async function () {
    const { governor, token } = await loadFixture(fixture);
    const signer = await ethers.getSigner();
    const abi = ["function mint(address,uint256)"];
    const interace = new ethers.utils.Interface(abi);
    const calldata = interace.encodeFunctionData("mint", [
      signer.address,
      1000,
    ]);
    const txProposal = await governor.propose(
      [token.address],
      [0],
      [calldata],
      "Proposal to mine 1000wei"
    );
    const receipt = await txProposal.wait();
    const proposalId = receipt.events[0].args[0];
    await expect(governor.castVote(proposalId, 1)).to.be.revertedWith(
      "Governor: vote not currently active"
    );
  });

  it("emits VoteCast event when a vote is cast", async function () {
    const { governor, token } = await loadFixture(fixture);
    const signer = await ethers.getSigner();
    const abi = ["function mint(address,uint256)"];
    const interace = new ethers.utils.Interface(abi);
    const calldata = interace.encodeFunctionData("mint", [
      signer.address,
      1000,
    ]);
    const txProposal = await governor.propose(
      [token.address],
      [0],
      [calldata],
      "Proposal to mine 1000wei"
    );
    const receipt = await txProposal.wait();
    const proposalId = receipt.events[0].args[0];
    await mine(1);
    await expect(governor.castVote(proposalId, 1))
      .to.emit(governor, "VoteCast")
      .withArgs(signer.address, proposalId, 1, anyValue, "");
  });

  it("disables vote cast after 50400blocks", async function () {
    const { governor, token } = await loadFixture(fixture);
    const signer = await ethers.getSigner();
    const abi = ["function mint(address,uint256)"];
    const interace = new ethers.utils.Interface(abi);
    const calldata = interace.encodeFunctionData("mint", [
      signer.address,
      1000,
    ]);
    const txProposal = await governor.propose(
      [token.address],
      [0],
      [calldata],
      "Proposal to mine 1000wei"
    );
    const receipt = await txProposal.wait();
    const proposalId = receipt.events[0].args[0];
    await mine(1 + 50400);
    await expect(governor.castVote(proposalId, 1)).to.be.rejectedWith(
      "Governor: vote not currently active"
    );
  });
});
