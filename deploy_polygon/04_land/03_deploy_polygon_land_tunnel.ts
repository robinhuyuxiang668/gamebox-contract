import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {skipUnlessTestnet} from '../../utils/network';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy, execute, read, catchUnknownSigner} = deployments;
  const {deployer} = await getNamedAccounts();

  const TRUSTED_FORWARDER = await deployments.get('TRUSTED_FORWARDER');
  const FXCHILD = await deployments.get('FXCHILD');
  const PolygonLand = await deployments.get('PolygonLand');
  const maxGasLimit = 500;
  const maxAllowedQuads = 144;
  const limits = [5, 10, 20, 90, 340];

  const PolygonLandTunnel = await deploy('PolygonLandTunnel', {
    from: deployer,
    contract: 'PolygonLandTunnel',
    args: [
      FXCHILD.address,
      PolygonLand.address,
      TRUSTED_FORWARDER.address,
      maxGasLimit,
      maxAllowedQuads,
      limits,
    ],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  const LandTunnel = await hre.companionNetworks['l1'].deployments.getOrNull(
    'LandTunnel'
  );
  // get deployer on l1
  const {deployer: deployerOnL1} = await hre.companionNetworks[
    'l1'
  ].getNamedAccounts();

  if (LandTunnel) {
    const fxChildTunnel = await hre.companionNetworks['l1'].deployments.read(
      'LandTunnel',
      'fxChildTunnel'
    );
    if (fxChildTunnel !== PolygonLandTunnel.address) {
      await hre.companionNetworks['l1'].deployments.execute(
        'LandTunnel',
        {from: deployerOnL1, log: true},
        'setFxChildTunnel',
        PolygonLandTunnel.address
      );
    }
    const fxRootTunnel = await read('PolygonLandTunnel', 'fxRootTunnel');
    if (fxRootTunnel !== LandTunnel.address) {
      await execute(
        'PolygonLandTunnel',
        {from: deployer, log: true},
        'setFxRootTunnel',
        LandTunnel.address
      );
    }
  }

  const polygonLandTunnel = await read('PolygonLand', 'polygonLandTunnel');

  if (polygonLandTunnel !== PolygonLandTunnel.address) {
    const admin = await read('PolygonLand', 'getAdmin');
    await catchUnknownSigner(
      execute(
        'PolygonLand',
        {from: admin, log: true},
        'setPolygonLandTunnel',
        PolygonLandTunnel.address
      )
    );
  }
};

export default func;
func.tags = ['PolygonLandTunnel', 'PolygonLandTunnel_deploy', 'L2'];
func.dependencies = ['PolygonLand', 'FXCHILD'];
func.skip = skipUnlessTestnet;
