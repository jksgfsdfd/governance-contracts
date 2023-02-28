const { ethers } = require("hardhat");
const {
  loadFixture,
  mine,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
const { initialFixture, proposedFixture } = require("./fixtures");
const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { toUtf8Bytes } = require("ethers/lib/utils");

describe("Governor", function () {
  it("has setup the Governer Address correctly", async function () {
    const { governor, token } = await loadFixture(initialFixture);
    expect(await token.governor()).to.equal(governor.address);
  });

  it("has minted 1000e18 tokens for the deployer", async function () {
    const { governor, token } = await loadFixture(initialFixture);
    const deployer = await ethers.getSigner();
    const balance = await token.balanceOf(deployer.address);
    expect(balance.toString()).to.equal(
      ethers.utils.parseEther("1000").toString()
    );
  });

  it("nobody except the governor can mint tokens", async function () {
    const { governor, token } = await loadFixture(initialFixture);
    const deployer = await ethers.getSigner();

    await expect(token.mint(deployer.address, 1000)).to.be.reverted;
  });
});

describe("Governor", function () {
  it("starts voting only after 1 extra block has been mined", async function () {
    const { governor, token, proposalId } = await loadFixture(proposedFixture);
    await expect(governor.castVote(proposalId, 1)).to.be.revertedWith(
      "Governor: vote not currently active"
    );
  });

  it("emits VoteCast event when a vote is cast", async function () {
    const { governor, token, proposalId } = await loadFixture(proposedFixture);
    await mine(1);
    await expect(governor.castVote(proposalId, 1))
      .to.emit(governor, "VoteCast")
      .withArgs(
        await governor.signer.getAddress(),
        proposalId,
        1,
        anyValue,
        ""
      );
  });

  it("disables vote cast after 50400blocks", async function () {
    const { governor, token, proposalId } = await loadFixture(proposedFixture);
    await mine(1 + 50400);
    await expect(governor.castVote(proposalId, 1)).to.be.rejectedWith(
      "Governor: vote not currently active"
    );
  });

  it("needs 4% percentage quorum", async function () {
    const { governor, token } = await loadFixture(initialFixture);

    // totally there is 1000e18 tokens
    // therefore needs atleast 40e18 tokens weight
    const voter = (await ethers.getSigners())[4];
    const txTransfer = await token.transfer(
      voter.address,
      ethers.utils.parseEther("39")
    );
    await txTransfer.wait();
    const txDelegate = await token.connect(voter).delegate(voter.address);
    await txDelegate.wait();

    const abi = ["function mint(address,uint256)"];
    const interface = new ethers.utils.Interface(abi);
    const calldata = interface.encodeFunctionData("mint", [
      await token.signer.getAddress(),
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
    const txVote = await governor.connect(voter).castVote(proposalId, 1);
    const voteReceipt = await txVote.wait();

    expect(
      (await governor.proposalVotes(proposalId)).forVotes.toString()
    ).to.equal(ethers.utils.parseEther("39"));

    const descriptionHash = ethers.utils.keccak256(
      toUtf8Bytes("Proposal to mine 1000wei")
    );

    await mine(50400);
    await expect(
      governor.execute([token.address], [0], [calldata], descriptionHash)
    ).to.be.rejectedWith("Governor: proposal not successful");
  });

  it("executes when 4% percentage quorum is met and forVotes>againstVotes", async function () {
    const { governor, token } = await loadFixture(initialFixture);

    // totally there is 1000e18 tokens
    // therefore needs atleast 40e18 tokens weight
    const voter = (await ethers.getSigners())[4];
    const txTransfer = await token.transfer(
      voter.address,
      ethers.utils.parseEther("41")
    );
    await txTransfer.wait();
    const txDelegate = await token.connect(voter).delegate(voter.address);
    await txDelegate.wait();

    const abi = ["function mint(address,uint256)"];
    const interface = new ethers.utils.Interface(abi);
    const calldata = interface.encodeFunctionData("mint", [
      await token.signer.getAddress(),
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
    const txVote = await governor.connect(voter).castVote(proposalId, 1);
    const voteReceipt = await txVote.wait();

    expect(
      (await governor.proposalVotes(proposalId)).forVotes.toString()
    ).to.equal(ethers.utils.parseEther("41"));

    const descriptionHash = ethers.utils.keccak256(
      toUtf8Bytes("Proposal to mine 1000wei")
    );

    await mine(50400);
    await expect(
      governor.execute([token.address], [0], [calldata], descriptionHash)
    )
      .to.emit(governor, "ProposalExecuted")
      .withArgs(proposalId);
  });
});
