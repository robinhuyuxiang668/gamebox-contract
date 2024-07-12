import {
  deployments,
  ethers,
  getNamedAccounts,
  getUnnamedAccounts,
} from 'hardhat';

import {Address} from 'hardhat-deploy/types';
import {Contract} from 'ethers';
import {withSnapshot} from '../utils';

export interface User {
  address: Address;
  Game: Contract;
}

const setApprovalForAll = async (
  assetConstractName: string,
  gameContractAddress: string,
  gameOwnerAddress: string
) => {
  const assetContractAsGameOwner = await ethers.getContract(
    assetConstractName,
    gameOwnerAddress
  );
  await assetContractAsGameOwner.setApprovalForAll(gameContractAddress, true);
};

const changeAssetMinter = async (
  assetConstractName: string,
  assetAdminAddress: string,
  assetMinterAddress: string
) => {
  const assetContractAsAdmin = await ethers.getContract(
    assetConstractName,
    assetAdminAddress
  );
  await assetContractAsAdmin.transferOwnership(assetMinterAddress);
};

export interface GameFixturesData {
  gameToken: Contract;
  gameTokenAsAdmin: Contract;
  gameTokenAsMinter: Contract;
  assetAdmin: string;
  GameOwner: User;
  GameEditor1: User;
  GameEditor2: User;
  users: User[];
  trustedForwarder: Contract;
}

const gameFixtures = async (): Promise<GameFixturesData> => {
  const {gameTokenAdmin, assetAdmin} = await getNamedAccounts();
  const others = await getUnnamedAccounts();

  const gameToken = await ethers.getContract('ChildGameToken');
  const TRUSTED_FORWARDER = await deployments.get('TRUSTED_FORWARDER');
  const trustedForwarder = await ethers.getContractAt(
    'TestMetaTxForwarder',
    TRUSTED_FORWARDER.address
  );
  const gameTokenAsAdmin = await ethers.getContract(
    'ChildGameToken',
    gameTokenAdmin
  );
  const gameTokenAsMinter = await gameToken.connect(
    ethers.provider.getSigner(gameTokenAdmin)
  );

  const users = [];
  for (const other of others) {
    users.push({
      address: other,
      Game: gameToken.connect(ethers.provider.getSigner(other)),
    });
  }

  const GameOwner = {
    address: users[0].address,
    Game: gameToken.connect(ethers.provider.getSigner(users[0].address)),
  };

  const GameEditor1 = {
    address: users[1].address,
    Game: gameToken.connect(ethers.provider.getSigner(users[1].address)),
  };

  const GameEditor2 = {
    address: users[1].address,
    Game: gameToken.connect(ethers.provider.getSigner(users[2].address)),
  };

  setApprovalForAll(
    'MockERC1155Asset',
    gameTokenAsAdmin.address,
    users[0].address
  );

  setApprovalForAll(
    'MockERC721Asset',
    gameTokenAsAdmin.address,
    users[0].address
  );

  return {
    gameToken,
    gameTokenAsAdmin,
    gameTokenAsMinter,
    assetAdmin,
    GameOwner,
    GameEditor1,
    GameEditor2,
    users,
    trustedForwarder,
  };
};

export const setupTest = withSnapshot(['ChildGameToken'], gameFixtures);

const gameFixturesWithAdminGameMinter = async (): Promise<GameFixturesData> => {
  const gameFixturesData: GameFixturesData = await gameFixtures();
  const {gameTokenAdmin} = await getNamedAccounts();
  const {gameTokenAsAdmin} = gameFixturesData;
  await gameTokenAsAdmin.changeMinter(gameTokenAdmin);
  return gameFixturesData;
};

export const setupTestWithAdminGameMinter = withSnapshot(
  ['ChildGameToken'],
  gameFixturesWithAdminGameMinter
);

const gameFixturesWithGameOwnerMinter = async (): Promise<GameFixturesData> => {
  const gameFixturesData: GameFixturesData = await gameFixtures();
  const {assetAdmin, gameTokenAsAdmin, GameOwner} = gameFixturesData;
  await changeAssetMinter('MockERC1155Asset', assetAdmin, GameOwner.address);
  await changeAssetMinter('MockERC721Asset', assetAdmin, GameOwner.address);

  const {gameTokenAdmin} = await getNamedAccounts();
  await gameTokenAsAdmin.changeMinter(gameTokenAdmin);

  return gameFixturesData;
};

export const setupTestWithGameOwnerMinter = withSnapshot(
  ['MockERC1155Asset', 'MockERC721Asset', 'ChildGameToken'],
  gameFixturesWithGameOwnerMinter
);
