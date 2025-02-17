const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", function () {
          let fundMe
          let mockV3Aggregator
          let deployer
          const sendValue = ethers.parseEther("1")
          beforeEach(async () => {
              // const accounts = await ethers.getSigners()
              // deployer = accounts[0]
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              fundMe = await ethers.getContract("FundMe", deployer)
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
          })

          describe("constructor", function () {
              it("sets the aggregator addresses correctly", async () => {
                  const response = await fundMe.getPriceFeed()
                  assert.equal(response, mockV3Aggregator.target)
              })
          })

          describe("fund", function () {
              // https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
              // could also do assert.fail
              it("Fails if you don't send enough ETH", async () => {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  )
              })
              // we could be even more precise here by making sure exactly $50 works
              // but this is good enough for now
              it("Updates the amount funded data structure", async () => {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  assert.equal(response.toString(), sendValue.toString())
              })
              it("Adds funder to array of funders", async () => {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getFunder(0)
                  assert.equal(response, deployer)
              })
          })
          describe("withdraw", function () {
              beforeEach(async () => {
                  await fundMe.fund({ value: sendValue })
              })
              it("withdraws ETH from a single funder", async () => {
                  // Arrange
                  const startingFundMeBalance =
                      //   await fundMe.provider.getBalance(fundMe.target)
                      await ethers.provider.getBalance(fundMe.target)
                  const startingDeployerBalance =
                      //   await fundMe.provider.getBalance(deployer)
                      await ethers.provider.getBalance(deployer)

                  // Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait()
                  //   const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const { gasUsed, gasPrice } = transactionReceipt
                  //   const gasCost = gasUsed.mul(effectiveGasPrice)
                  const gasCost = gasUsed * gasPrice

                  const endingFundMeBalance = await ethers.provider.getBalance(
                      fundMe.target
                  )
                  const endingDeployerBalance =
                      await ethers.provider.getBalance(deployer)

                  // Assert
                  // Maybe clean up to understand the testing
                  assert.equal(endingFundMeBalance, 0)

                  const startingFundMeBalanceAfter =
                      startingFundMeBalance + startingDeployerBalance
                  startingFundMeBalanceAfter.toString()

                  const endingDeployerBalanceAfter =
                      endingDeployerBalance + gasCost
                  endingDeployerBalanceAfter.toString()

                  assert.equal(
                      //   startingFundMeBalance
                      //       .add(startingDeployerBalance)
                      //       .toString(),
                      //   endingDeployerBalance.add(gasCost).toString()
                      startingFundMeBalanceAfter,
                      endingDeployerBalanceAfter
                  )
              })
              // this test is overloaded. Ideally we'd split it into multiple tests
              // but for simplicity we left it as one
              it("is allows us to withdraw with multiple funders", async () => {
                  // Arrange
                  const accounts = await ethers.getSigners()
                  for (i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  const startingFundMeBalance =
                      //   await fundMe.provider.getBalance(fundMe.target)
                      await ethers.provider.getBalance(fundMe.target)
                  const startingDeployerBalance =
                      //   await fundMe.provider.getBalance(deployer)
                      await ethers.provider.getBalance(deployer)

                  // Act
                  const transactionResponse = await fundMe.cheaperWithdraw()
                  // Let's comapre gas costs :)
                  // const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait()
                  //   const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const { gasUsed, gasPrice } = transactionReceipt
                  const withdrawGasCost = gasUsed * gasPrice
                  console.log(`GasCost: ${withdrawGasCost}`)
                  console.log(`GasUsed: ${gasUsed}`)
                  console.log(`GasPrice: ${gasPrice}`)
                  const endingFundMeBalance = await ethers.provider.getBalance(
                      fundMe.target
                  )
                  const endingDeployerBalance =
                      await ethers.provider.getBalance(deployer)
                  // Assert

                  const startingFundMeBalanceAfter =
                      startingFundMeBalance + startingDeployerBalance
                  startingFundMeBalanceAfter.toString()

                  const endingDeployerBalanceAfter =
                      endingDeployerBalance + withdrawGasCost
                  endingDeployerBalanceAfter.toString()

                  assert.equal(
                      //   startingFundMeBalance
                      //       .add(startingDeployerBalance)
                      //       .toString(),
                      //   endingDeployerBalance.add(withdrawGasCost).toString()
                      startingFundMeBalanceAfter,
                      endingDeployerBalanceAfter
                  )
                  // Make a getter for storage variables
                  await expect(fundMe.getFunder(0)).to.be.reverted

                  for (i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              // Freezing: I make a stupid mistake!
                              // I write the "accoutnts[i].target instead of accoutnts[i].address"
                              // but the class only has address, target is not exist!
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })
              it("Only allows the owner to withdraw", async function () {
                  const accounts = await ethers.getSigners()
                  const fundMeConnectedContract = await fundMe.connect(
                      accounts[1]
                  )
                  await expect(
                      fundMeConnectedContract.withdraw()
                  ).to.be.revertedWith("FundMe__NotOwner")
              })
          })
      })
