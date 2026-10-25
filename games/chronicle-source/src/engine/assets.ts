import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const KCH_GAME_MODELS = {
  player: { url: 'assets/models/kch/player.glb', sha256: '9457ddcd1e18a63cc01c392caee8800ca3e59a2a64d7c467377140295213cfec' },
  arms: { url: 'assets/models/kch/arms.glb', sha256: 'c56f9d93d7c1e34b6afb47b404d80d797922a49e86d8d76d487d91dfafd8ce33' },
  ar9: { url: 'assets/models/kch/ar9.glb', sha256: '365548aeeadb84b3c07f321e83d79f8f31ea193dd1b2e98bbd9f0334d21a142b' },
  scar: { url: 'assets/models/kch/scar.glb', sha256: 'eadc8a2908428fa962f8d68f02781f1e83de7b31c185dc8d4160bb5fecd21837' },
  lar: { url: 'assets/models/kch/lar.glb', sha256: '2cdd08c03b12f164ca19c4e9a6895a0f53f71148ae6b23925da2a3c62a02c10d' },
  m60: { url: 'assets/models/kch/m60.glb', sha256: '7274f68837e08f50ca381c68f4c2f6e9898c2550750971ee21531903743acc1e' },
  mac10: { url: 'assets/models/kch/mac10.glb', sha256: '6862af6c197fb03a224d9241d13748a4b49635c1e4c91792bef5e947149af25a' },
  revolver: { url: 'assets/models/kch/revolver.glb', sha256: 'e099d330969cb859689f6fc538e5a4539cf4331a7f75453376bdeaa618c1c186' },
  shark: { url: 'assets/models/kch/shark.glb', sha256: 'ea92c57b231bdbf9ecdc48274f69ce20196a72f86c3789da6fc47f4864d1700a' },
  vita: { url: 'assets/models/kch/vita.glb', sha256: 'e79752419d5478679048049613b1f82bb91acd7aaa2d32ce1d272c4ac6ac6d91' },
  weatie: { url: 'assets/models/kch/weatie.glb', sha256: '4eb57d45a9c76c38ce8c8f8692ca137476342428dfa9149e85265799634b46e5' },
  bayonet: { url: 'assets/models/kch/bayonet.glb', sha256: '61dd54e96c94b547ef91727faa2fad2fdff2d9e96cf82d52ddba99076cd05d96' },
  tomahawk: { url: 'assets/models/kch/tomahawk.glb', sha256: '805a7520a2a3d6b646b23b297e0657d1934b8624a9a47236e8bda8c816bb4b30' },
} as const

export const KCH_GAME_MAPS: Record<string, { url: string; sha256: string }> = {
  "acid": { url: "assets/maps/kch/acid.json?v=20261025", sha256: "49e06c4b30f0c1c1eb911cebd8e9d4f5348f99e04cc70a4200d3ebc18fc4911f" },
  "amphitheater": { url: "assets/maps/kch/amphitheater.json?v=20261025", sha256: "03230e26ae0493abba10c6d4da13356984ca0e9c0bff46400de56845be012d2c" },
  "ancient": { url: "assets/maps/kch/ancient.json?v=20261025", sha256: "d16b99729dc099702a47a551e82c68efeb71200c71c3eb92856563ee62725ed2" },
  "antfarm": { url: "assets/maps/kch/antfarm.json?v=20261025", sha256: "34ccffa01146e5ecd7949e98155055d07fc2f4405592e52f7d725bae99f9ce08" },
  "apartment": { url: "assets/maps/kch/apartment.json?v=20261025", sha256: "2b712abc57291e302241425fbb47fb107969fde96f78fb037b97e5ea40365008" },
  "arena": { url: "assets/maps/kch/arena.json?v=20261025", sha256: "97a98845dc9e11af8cd667530e205daebd9a42f0976e299ca69822b5b5e15e3d" },
  "arid": { url: "assets/maps/kch/arid.json?v=20261025", sha256: "71cb4800032f038f57f4c6c409d1177c53febf922df08e89ce3cdb5646c876b8" },
  "arsenal": { url: "assets/maps/kch/arsenal.json?v=20261025", sha256: "65a2c857b3351b0931cad8bd4ed3600fd8d0a51bc48c979d45a5ff6c82a59824" },
  "backrooms": { url: "assets/maps/kch/backrooms.json?v=20261025", sha256: "ced94e7b2281d34fb8df871d4eebe1c667c700f7be03a379193307b109e55917" },
  "ballistic": { url: "assets/maps/kch/ballistic.json?v=20261025", sha256: "0dfac45cfa350c70bb8cdb39ba375edec0eb85df133741f80b0462ed6db65b1e" },
  "bed": { url: "assets/maps/kch/bed.json?v=20261025", sha256: "aff30154a8f04134515f509c1ea98b1b06bb3df219bd8c792bac764067a95b09" },
  "blossom": { url: "assets/maps/kch/blossom.json?v=20261025", sha256: "d865c25b0d413324018f0eeb43cca377a38d66709aafb54f858a4e40b96f1341" },
  "bulwark": { url: "assets/maps/kch/bulwark.json?v=20261025", sha256: "fec38cc436845643a882973a46729072f3794dcf9f47809b1cd48c944cd098c9" },
  "bunker": { url: "assets/maps/kch/bunker.json?v=20261025", sha256: "fc74e079a936f822cc980c0e1e36e73f15789c1461f62c9f87dfb90d65630c6b" },
  "castle-winter": { url: "assets/maps/kch/castle-winter.json?v=20261025", sha256: "93ee024e1cec02b56cf7ce064763a20a47f963f03c3f9050c21daa925320aa92" },
  "castle": { url: "assets/maps/kch/castle.json?v=20261025", sha256: "40492a528d78e7cb01c888048a0b64381ef576b04d4ad0ffad9fa0385d6fef04" },
  "catacomb": { url: "assets/maps/kch/catacomb.json?v=20261025", sha256: "e966c785ca505171a0a3eac91a62c661961633f8e25cf34fa4c406cb4d3d9956" },
  "cathedral-winter": { url: "assets/maps/kch/cathedral-winter.json?v=20261025", sha256: "0afac9bf86cea5c960b1c8f3c07a800a602ed98ca80da62fe0fad266f8df11b8" },
  "cathedral": { url: "assets/maps/kch/cathedral.json?v=20261025", sha256: "fc2279a682a5626294e436385e5d789a2d076553a67e5656c68c774fc05b4709" },
  "cave": { url: "assets/maps/kch/cave.json?v=20261025", sha256: "bf6ddbd54901c7c4b5f00d4552c467e9aa85c94dbc20412368f632472fc9ceea" },
  "ceres": { url: "assets/maps/kch/ceres.json?v=20261025", sha256: "16c3c4147d148b8463add1f4ec28d48cd4345b782d9e7103c64ebc0db72899e2" },
  "clash": { url: "assets/maps/kch/clash.json?v=20261025", sha256: "234b16451bd0857e52917ad0b8149d1fa3a9e77bec45c8cbf5c6f37775d3c989" },
  "cleft": { url: "assets/maps/kch/cleft.json?v=20261025", sha256: "0f5dd93896cb2d8f312473b31dce7c6b51ec02afb44350da252802ebe86036a6" },
  "co2": { url: "assets/maps/kch/co2.json?v=20261025", sha256: "ae92b42653d88c9d05a0d27f4c957206df0fbb5e72b73a46a13743496c00f1d0" },
  "collision": { url: "assets/maps/kch/collision.json?v=20261025", sha256: "ad01a4facba83836190d4f776572ae1e7b22d4c3697cbb860d00042efa85a2fb" },
  "colyseum": { url: "assets/maps/kch/colyseum.json?v=20261025", sha256: "b05a01da8bd2fb23cb4e9200b6a1e39db54ddb6e582ec70094c895d331deff39" },
  "cove": { url: "assets/maps/kch/cove.json?v=20261025", sha256: "ec261b33099e26001fafe3a2e7e452bf48cbb8fdb0d3f6dcfbd54e6f1a18be92" },
  "deathrow": { url: "assets/maps/kch/deathrow.json?v=20261025", sha256: "95b682cbe32858a1830f570cb69a2020559f6bc5b06fd4b025dcf0fe94e19cf1" },
  "defi": { url: "assets/maps/kch/defi.json?v=20261025", sha256: "19e8ed413be2d18422e916d1a9f8f2cc3f288cc51d23258de61a07b1a426f7d9" },
  "der": { url: "assets/maps/kch/der.json?v=20261025", sha256: "afb88fd5c5eb5723b7583ffcfa69e0fc12e1c9b4b507b9bba55e25e0627eba5b" },
  "derelict": { url: "assets/maps/kch/derelict.json?v=20261025", sha256: "cc5ca49d695d5ffbdaf7960e89a182ac1962ae3076d4275ce342e48a96b63150" },
  "desty": { url: "assets/maps/kch/desty.json?v=20261025", sha256: "0aa712ef7c875ccf9fbc1ac9cfa0795641986396a14abc03c0d01682bf0b90a0" },
  "dethroned": { url: "assets/maps/kch/dethroned.json?v=20261025", sha256: "c5c82834c6e6ce2495339e50010617829b6dd58b9edf8b5b2ebbea90f7546af5" },
  "diablo": { url: "assets/maps/kch/diablo.json?v=20261025", sha256: "952fbb4b58488050367709443415ba1dc7abf9356da1ef10868936dd731c16b8" },
  "digsite": { url: "assets/maps/kch/digsite.json?v=20261025", sha256: "7ecd5ba81dc77c74fedfe9c2da2ec92b6e0a365dafc580d9162c884067216b1f" },
  "dreams": { url: "assets/maps/kch/dreams.json?v=20261025", sha256: "564ce09a7f2cf659177b84c19563f2f202e6dbd5ffd4602b48928fb4506c1dd2" },
  "dune": { url: "assets/maps/kch/dune.json?v=20261025", sha256: "dc309e9c4da2a92e028a8c7ab37563b763b9726fea496da85e33604cbcc45aa8" },
  "dunes": { url: "assets/maps/kch/dunes.json?v=20261025", sha256: "2035377a27b4853639d49bc0f8f9f1539a6ad822126386b68726fc9faf727625" },
  "dust": { url: "assets/maps/kch/dust.json?v=20261025", sha256: "0a93009886c229c3ebc305288f9dd1ac3c8f85ffe902c334a82b379ce0374fe8" },
  "eruption": { url: "assets/maps/kch/eruption.json?v=20261025", sha256: "51e4d866bcb47157ecba0d07e4a0cf8cc0c0412782058fb2c6da788fbfdc356c" },
  "favela": { url: "assets/maps/kch/favela.json?v=20261025", sha256: "0ce67cebc1ba8676f5bf264cc08790ba4936015ad42218f7da65c03bab4dfb9b" },
  "festivus": { url: "assets/maps/kch/festivus.json?v=20261025", sha256: "e944c5afd2ab139e4bb1b95303d783f4ada24b30ee3416545359b282170ced26" },
  "flooded": { url: "assets/maps/kch/flooded.json?v=20261025", sha256: "3b8254ea34e44f352e82e3b31d526902cd746eaf3df16a161328333597b20fe5" },
  "flora": { url: "assets/maps/kch/flora.json?v=20261025", sha256: "2868b14aed2a9b088e6ca97bcd4a6c5d4b34c3a49b6b27f1f284bd15a65f3565" },
  "fortress": { url: "assets/maps/kch/fortress.json?v=20261025", sha256: "d6e6c4f2d2803f42b22b43aefddf539254e9d0e544ba6d7faaa81bdb73d278ab" },
  "foundry": { url: "assets/maps/kch/foundry.json?v=20261025", sha256: "c29eb9e8553d5febd5e4f124f231f7273f3e37ba21c67cf58d2af3ee02ad3f97" },
  "frontier": { url: "assets/maps/kch/frontier.json?v=20261025", sha256: "dc60a8592ae41b98484a7d10ea75b5d04c8b91cf9838207069deea60d7bc81a4" },
  "funeral": { url: "assets/maps/kch/funeral.json?v=20261025", sha256: "6b23719003e64d31be291b647e63d2fbae2780ff312f8c152df7c9548bd9f918" },
  "gauntlet": { url: "assets/maps/kch/gauntlet.json?v=20261025", sha256: "1f70356f88a6bc9c41e78dcdc90f4de5d8b7a12ab040d2254a3a5d59fa10e19b" },
  "grot": { url: "assets/maps/kch/grot.json?v=20261025", sha256: "c228b696a3cf1f15b2767134d69d46aa3a9690ea56069208323d364e047ad092" },
  "gulag": { url: "assets/maps/kch/gulag.json?v=20261025", sha256: "b8056a453d6c3e57241b47c93385a9c8820582ba304e669ca0e22e316251de33" },
  "gym": { url: "assets/maps/kch/gym.json?v=20261025", sha256: "49e875b2c1a4c562f7a721299390c2e83c2ff99646993bcdfa79fb53525e837e" },
  "haji": { url: "assets/maps/kch/haji.json?v=20261025", sha256: "7b777ef8ad7d989bfdba452494dd281e3e1947ba65e1a937a5c8db888b7fc27d" },
  "hallway": { url: "assets/maps/kch/hallway.json?v=20261025", sha256: "06f862da19cdb4a73608b61fae199b4821535d744c1a3eac5b5baefec53360ca" },
  "hearth": { url: "assets/maps/kch/hearth.json?v=20261025", sha256: "bd59acd853846fe024a04b7b07b585d6c50d15705f1a3475bf2fb7599da0d5b4" },
  "hell": { url: "assets/maps/kch/hell.json?v=20261025", sha256: "e8b58eec9413dbf50b709898aac5c041c13a5808a96745e5b65a09994b9f0a01" },
  "highrises": { url: "assets/maps/kch/highrises.json?v=20261025", sha256: "a33bee0396e4e80b42c84a55f02d6be5bfc3433c9dafe3b8e954f91b5890c795" },
  "inferno": { url: "assets/maps/kch/inferno.json?v=20261025", sha256: "622c63b93cd0d201cee8027f69fac41e839efc9e10d532bb51d7eb7d7ce929e1" },
  "island": { url: "assets/maps/kch/island.json?v=20261025", sha256: "261111617f816e39212c0c2c2ff79c64d4435f86927d8a8473c796e938ea6587" },
  "islands": { url: "assets/maps/kch/islands.json?v=20261025", sha256: "8f4c9d7cee85cf28f4bd69080721432f929fb8c85343acfd659849d15646f908" },
  "juxt": { url: "assets/maps/kch/juxt.json?v=20261025", sha256: "d2d154e58a25ce3c356f9b2032b6ae202b2f0123db28afb68228352419671f6d" },
  "labs": { url: "assets/maps/kch/labs.json?v=20261025", sha256: "5a903af8748bff2cd41a1874477f89327275aab1697dfc9e06193b75ff8b6a6f" },
  "lava": { url: "assets/maps/kch/lava.json?v=20261025", sha256: "96bd85c3d34c020a9edcdbeff8b6159b439edf582d405f3b22423aecf9999c85" },
  "lilnorth": { url: "assets/maps/kch/lilnorth.json?v=20261025", sha256: "874386d56538509c9d4c4bfd4379389fdcff544bea497e4f49571545da4b3bcd" },
  "lodge": { url: "assets/maps/kch/lodge.json?v=20261025", sha256: "079c3463146bf6ce33a44f39257e5ea0460311ac2f6b82ba8283590944f2779a" },
  "lost": { url: "assets/maps/kch/lost.json?v=20261025", sha256: "08b9ac4e633c64e5e3605cab4cd71d019f7ebf24f77c3d23ffb094deb05ae987" },
  "losttemple": { url: "assets/maps/kch/losttemple.json?v=20261025", sha256: "87f8343c6229cf9914f4994a37eb871e535cf120c264691f949e2a6122c14925" },
  "lotus": { url: "assets/maps/kch/lotus.json?v=20261025", sha256: "e1f62835a06d3731bb95d1576061b3ebf962a0f6173823c9bb4b62cf2cf8725d" },
  "mefitis": { url: "assets/maps/kch/mefitis.json?v=20261025", sha256: "cf4fc4a40e5a7945f2c38a0762c37886227c10abdaa22ff416b45b08ff1a95fd" },
  "metro": { url: "assets/maps/kch/metro.json?v=20261025", sha256: "6bc421b74ccb23a747bbd5446d2b555b28bd14cc0e8cc2b643c3b812256f0d73" },
  "michelin": { url: "assets/maps/kch/michelin.json?v=20261025", sha256: "44b0b22f432115825197dfd9e483853b8f406a4b7b2609e32dcaf943b23870f9" },
  "minimart": { url: "assets/maps/kch/minimart.json?v=20261025", sha256: "5825058dbd605a2a530e36b3b4e7c5a6cfdacb42d3db92ca99ac729ffa61de36" },
  "mirage": { url: "assets/maps/kch/mirage.json?v=20261025", sha256: "55d80761fb45d63e081f6da8a85a3f37e5b36e3b583a975632d65e6aca42a7a5" },
  "mothership": { url: "assets/maps/kch/mothership.json?v=20261025", sha256: "3a4e08bab5a1b5f50838401e9ca89ffe7d175fbca5b0d1b18bdafead5f70a8b8" },
  "mtboofi": { url: "assets/maps/kch/mtboofi.json?v=20261025", sha256: "8c5fceb44057f7251d6b844635bffd31c4ab885c01d265d84c2554ac2d98761c" },
  "mtwerwer": { url: "assets/maps/kch/mtwerwer.json?v=20261025", sha256: "c85f9a931626e7fc0b7c04d80e230167978774f6505631a850daaa75b60d5fc2" },
  "nebu": { url: "assets/maps/kch/nebu.json?v=20261025", sha256: "e4cc95c0b7248ff4bb88b041a7a0126d02250105b717a1442978865cbcb12633" },
  "north": { url: "assets/maps/kch/north.json?v=20261025", sha256: "9d3df7f59f9ac37250fb7c1ecb1192fffabb43cd4704c55a4ae2e26947b876df" },
  "nuke-winter": { url: "assets/maps/kch/nuke-winter.json?v=20261025", sha256: "b7db8e4ac8e131966e4de9a0bafe75407f9cabb61805bfdbe05bd82f80bd8eb0" },
  "nuke": { url: "assets/maps/kch/nuke.json?v=20261025", sha256: "e2bf1fd10aa8aff73794e565fcce08df4670aea165bacc2d647d3643bf823097" },
  "nuketown": { url: "assets/maps/kch/nuketown.json?v=20261025", sha256: "ecc62ba5166db3a67d6b4b46556e0b1f2b1b18d61e8403f8abc98765a0760f77" },
  "nuketown1847": { url: "assets/maps/kch/nuketown1847.json?v=20261025", sha256: "2c588b3f44669372e4e412d4df30feeb784b5ee6f676a40fce5f454d41fd9c1a" },
  "obstruction": { url: "assets/maps/kch/obstruction.json?v=20261025", sha256: "7141499bc59a04eeee0abe0b44cb6c24fc6636ad59cd87e42a94429f0702a407" },
  "oilrig": { url: "assets/maps/kch/oilrig.json?v=20261025", sha256: "d6e262fb14cfd5c42865f22e64d3a9faef7976052744927ff65116e71eea9b7c" },
  "oilrig-tdm": { url: "assets/maps/kch/oilrig_tdm.json?v=20261025", sha256: "1c2f502552eaffcf7b5da080fddbdb24a3b9a581e4242121c67f54b9a392c338" },
  "palace": { url: "assets/maps/kch/palace.json?v=20261025", sha256: "296b013d12e2f9ef0dc485aa94d27fbb6266849950e4a2cd217233c5049470ef" },
  "pitfall": { url: "assets/maps/kch/pitfall.json?v=20261025", sha256: "8c3d17c66ea8067151afdeec7db9cbe45f75a3b87f31622e1ca320a9cb6b4df6" },
  "plunder": { url: "assets/maps/kch/plunder.json?v=20261025", sha256: "dff27a899ccc7c7249493f0fd64df6ca3041f09f244213b6b9bcdbe238c9bdf4" },
  "pool": { url: "assets/maps/kch/pool.json?v=20261025", sha256: "5f3776739c29fad3eda613f0192e53e7b48ff61d0babb9bd24c0741345f53ba6" },
  "poussiere": { url: "assets/maps/kch/poussiere.json?v=20261025", sha256: "bddd1b5c0ffce2b3bde5b8da63862792deccd47d32a2cb6af7635259c7d28f52" },
  "prison": { url: "assets/maps/kch/prison.json?v=20261025", sha256: "5cf0ed54620077d8ac4dbdd2be09e532e4b21f431338b967ff1fbd9934b33fb3" },
  "race": { url: "assets/maps/kch/race.json?v=20261025", sha256: "d43abd5e0b1f00f1633cac685dd4dbcc03d38f37a14a9f911df82d1fbae341e4" },
  "racetrack": { url: "assets/maps/kch/racetrack.json?v=20261025", sha256: "d1966fb6cddbc31d2882dac67051819e7d6ba87bba98708b62fd7130ade93cff" },
  "redemption": { url: "assets/maps/kch/redemption.json?v=20261025", sha256: "1c63d1d47ac3ee3c9132b0b4d9618cfc48870ab76c2b71e00e823a04c93b14e2" },
  "rialto": { url: "assets/maps/kch/rialto.json?v=20261025", sha256: "e28372975f29c9b1b1d3fac91483ded0a1dc45fa0f4d6e4b30c565a6707ab99e" },
  "rift": { url: "assets/maps/kch/rift.json?v=20261025", sha256: "cff322cbe4e4b20e0b629e10aa8c63194f3600268dec675ba373da4c3fcd50ab" },
  "rig": { url: "assets/maps/kch/rig.json?v=20261025", sha256: "89d0a51ff00a6e1ebabbf71d63aa6d85b111b5baac0e51fc3e4e5d6a9bd7da99" },
  "royale": { url: "assets/maps/kch/royale.json?v=20261025", sha256: "b4bb79c5e0426ed08a6a8d8f7e9827c9ec00350eb677037c7e31f2f3045b4399" },
  "ruins": { url: "assets/maps/kch/ruins.json?v=20261025", sha256: "3b21869a8395e23a73a7ba9770fdb41fc5a0a37c4578948553f7fb1fde2325de" },
  "rust-summer": { url: "assets/maps/kch/rust-summer.json?v=20261025", sha256: "704a4df412b9a2ec0407f162b688bdfc840fb4ce5b0a9e5203c77eef73520130" },
  "rust": { url: "assets/maps/kch/rust.json?v=20261025", sha256: "26e2b88ee81cf8d556539b74b2919c468f41ae041e1b66e9bbfad4ec39aad477" },
  "saintnorth-tdm": { url: "assets/maps/kch/saintnorth_tdm.json?v=20261025", sha256: "7deb6ad9e1a92099897acae3428e7178d3d3e57a71db8dc0d54a6a7c663f62c3" },
  "sanctuary": { url: "assets/maps/kch/sanctuary.json?v=20261025", sha256: "304e8c275b23bde7301ea2c5feb9893564b74c3dc753e649fdeeb0d7c9d3126d" },
  "sandstorm-winter": { url: "assets/maps/kch/sandstorm-winter.json?v=20261025", sha256: "16b6569eb21bd28b9dc8311a95f2916a5b2aecbbd509689aef1c4d2d3a2224a4" },
  "sandstorm": { url: "assets/maps/kch/sandstorm.json?v=20261025", sha256: "dda0ca6daefc2e34a8120bbfedd82c906f3086f1dda686c389c96c1b8cd315d5" },
  "sandtown": { url: "assets/maps/kch/sandtown.json?v=20261025", sha256: "006b1f9732037d4c58608689a0dca93f3e3b033200bfb6cafeb67cf0955f4c39" },
  "schism": { url: "assets/maps/kch/schism.json?v=20261025", sha256: "a2dc8f3099220581906dbfa2ec5e8ae4f6912710ced7ca1ad00cb060465a5baa" },
  "sealed": { url: "assets/maps/kch/sealed.json?v=20261025", sha256: "136cbdb29f1a2b20f72d15c71820c81271ae409719b235d4e1f170a1d4ef8d15" },
  "shipment-summer": { url: "assets/maps/kch/shipment-summer.json?v=20261025", sha256: "2e6ebb917eee4718ceecb51b4c066c787077de8880905e7b39a9c12e1de57cbe" },
  "shipment-winter-old": { url: "assets/maps/kch/shipment-winter-old.json?v=20261025", sha256: "932a78c1e3a926f6a38be8c2cae1d6b973bec7207cd18b3907f76ed1866e85a1" },
  "shipment": { url: "assets/maps/kch/shipment.json?v=20261025", sha256: "a2f161561a8343c595ae93083e74e193e0081ca90aa679ea95d191891b5ba6b1" },
  "shore-summer": { url: "assets/maps/kch/shore-summer.json?v=20261025", sha256: "f83fb9a0c0ae2ef30e080c1af335df76bd071898e255ac93f1a906c90b74dde7" },
  "shore": { url: "assets/maps/kch/shore.json?v=20261025", sha256: "7a151bf476a99103cf3c531789d5a9a538f86b72fe3b763a789b5c773a426112" },
  "sidehalls": { url: "assets/maps/kch/sidehalls.json?v=20261025", sha256: "322b97151d016b6bf96f7f574dc641c621608bf8e8d8a6aba352fdf0b4d25a53" },
  "siege": { url: "assets/maps/kch/siege.json?v=20261025", sha256: "668a30e6604dfa2d7bcb4eab1ab16a322ca3b1ac08a16a6ff74711e71e377f45" },
  "ski": { url: "assets/maps/kch/ski.json?v=20261025", sha256: "838b6393330d21b8c33cd03052df371cbf56dc5fc8aa9e12517d3806c7f6cc05" },
  "skyfel": { url: "assets/maps/kch/skyfel.json?v=20261025", sha256: "e2bab7baa74b2b61aa4d54237b6152be86cb250f89a267b332e778d06d8be995" },
  "skyhigh": { url: "assets/maps/kch/skyhigh.json?v=20261025", sha256: "ed915003db73cf4f5d97337b810f9a8715992841d8996773a449c51a0413c3c3" },
  "skytown": { url: "assets/maps/kch/skytown.json?v=20261025", sha256: "35b6c58bc167ae212bb0185dac82a9b5437b90bd6c42e31284f088582814ccb0" },
  "slate": { url: "assets/maps/kch/slate.json?v=20261025", sha256: "3dfdd8ba269817021170467edef413e5986bc32a9bfd4c1d0712473e5a917f81" },
  "snowfort": { url: "assets/maps/kch/snowfort.json?v=20261025", sha256: "99766fc1d1f8f2db207f67437980dcb74aaab314e22cd6f5ca7a06a8c7c1781c" },
  "stadium": { url: "assets/maps/kch/stadium.json?v=20261025", sha256: "1a3e1e02b3a274e318d50b0c7d30f63b91a879f653879f5a7ff47c2f7a007186" },
  "station-winter": { url: "assets/maps/kch/station-winter.json?v=20261025", sha256: "c6b8df43c657333b6e91e5f3c3b10e4303e37e463f621e98a6f7e8260343a35a" },
  "station": { url: "assets/maps/kch/station.json?v=20261025", sha256: "7e80dd1617d78d29f5989fe72d871dae0ea6b0dae7ea183d91096ec66c9142db" },
  "storage": { url: "assets/maps/kch/storage.json?v=20261025", sha256: "82a8dd0843be55b5f9fe56e1c08845fa39b232ba556fa825ba9ab0a80864562a" },
  "sundial": { url: "assets/maps/kch/sundial.json?v=20261025", sha256: "edd84d7e8e9a3dbebbf957351436b9f96398a1a2276b891a2a2f01ad30fc3021" },
  "sunken": { url: "assets/maps/kch/sunken.json?v=20261025", sha256: "7eff6c3f25d255a3188f00fb405d045368cb43f28a70089c795eb46d167d84fb" },
  "tectonic": { url: "assets/maps/kch/tectonic.json?v=20261025", sha256: "27be4dc2502c64162ce963530ca9fa3ce81f0c46edd2e295d626e33bbde796c2" },
  "temple": { url: "assets/maps/kch/temple.json?v=20261025", sha256: "5fb170e061249d61c0a63838ed875e9bfd91baf6779e8158b9b71e6c58071a74" },
  "terminal": { url: "assets/maps/kch/terminal.json?v=20261025", sha256: "4dba01efc218c7ae3435caba584793ecade7e58be3fa2833aa74247d9db4ce16" },
  "terra": { url: "assets/maps/kch/terra.json?v=20261025", sha256: "89e6a57c70896de26fd2e63e48a75d8bb04619f19a35edfb5d0d6d511e8ac94d" },
  "time": { url: "assets/maps/kch/time.json?v=20261025", sha256: "3081b1c8cc1b8db730db4d18962b410e76483d8b51d3a1641c9e31518c45e284" },
  "toilet": { url: "assets/maps/kch/toilet.json?v=20261025", sha256: "918217c8a194b0a82f7a6ad6a7fc93fae5e93b5df0de801531029812c961c590" },
  "tomesha": { url: "assets/maps/kch/tomesha.json?v=20261025", sha256: "7359ed5772b1d52b285909b036e4a7c67bd94be60dd3ed96f6cad0f8fb7cdf26" },
  "tower": { url: "assets/maps/kch/tower.json?v=20261025", sha256: "cb4d00930a22232281d34be03cff8414bfec5bd700291b155460f66115bb6557" },
  "towers": { url: "assets/maps/kch/towers.json?v=20261025", sha256: "c33b7faac42ddd044112619b343db3780e12ae8d30a7d2a5bae7d1923226f98f" },
  "town": { url: "assets/maps/kch/town.json?v=20261025", sha256: "c37814bf54dc39cfdbfd84abeae9ca0214af46293e9728a08292f4f80569dfca" },
  "train": { url: "assets/maps/kch/train.json?v=20261025", sha256: "7c38a72a34bd9154055b31bf24c92f287849a45ece76e3a81551eecf2199ba1e" },
  "tropical": { url: "assets/maps/kch/tropical.json?v=20261025", sha256: "696912b6e9d6421953c5bf785fc3fb0cb5a939de106456701d5a34f16c86d18a" },
  "tsunami": { url: "assets/maps/kch/tsunami.json?v=20261025", sha256: "028965ee69c794829e234a768aaae6cf07cf4669897616020a5aea0b2eaf36ae" },
  "tunnel": { url: "assets/maps/kch/tunnel.json?v=20261025", sha256: "0a9b96cf8ea7fc233d205e82efcd5ad39f99229426839c8494c47c451aed07dd" },
  "underwater": { url: "assets/maps/kch/underwater.json?v=20261025", sha256: "65a3d40414ec5e3806ff9762ecc98ed1ed771bfb301f56d30ec2cfe766c77feb" },
  "verdant": { url: "assets/maps/kch/verdant.json?v=20261025", sha256: "fe0fc977cd206bf52d742ed6f6796a9ebe97cba1ba2d93e3d8056819ea367971" },
  "vertigo": { url: "assets/maps/kch/vertigo.json?v=20261025", sha256: "7513ef780d4979424101a1f6b08c176b382ccc8f62285194b128034149afba19" },
  "village": { url: "assets/maps/kch/village.json?v=20261025", sha256: "11c03adf368389806b8bccca961b249d847bb30758f0e861f7f5c52229a23d47" },
  "warehouse": { url: "assets/maps/kch/warehouse.json?v=20261025", sha256: "c5e21024dd5dfdfdd63e5147067e23d2c4b6d264e6b64ac5858a03dccd86064c" },
  "western": { url: "assets/maps/kch/western.json?v=20261025", sha256: "a6df927650fe0280b9e4bbbc3293dde131087f703abc4f50c04a145f45b22fb5" },
  "windmill": { url: "assets/maps/kch/windmill.json?v=20261025", sha256: "68b26d825c75c8d8a9cd64f8500efd2d19bf2d4dbef6c4d17ced1b85095dc7e3" },
  "workshop": { url: "assets/maps/kch/workshop.json?v=20261025", sha256: "750f0b26d45aba8e9e921a5ed86337401605b7c2a600528dae2338ee6cf648a2" },
  "yggdrasil": { url: "assets/maps/kch/yggdrasil.json?v=20261025", sha256: "dbb906d8a3e9c4cf78c2b725ba521a0d2d98eb78b23f043501313a91f8039c4a" },
  "zenith": { url: "assets/maps/kch/zenith.json?v=20261025", sha256: "eafd0bdc9df787b3d31a1ba4d4c5e368b6396e55377bdd4a3f7f7d4da68f7f37" },
}

/**
 * Cached asset loading with one progress stream for the boot screen.
 *
 * The starter builds its world procedurally, so nothing is required here at boot. When adding
 * models or textures, put the files in `public/assets/` and preload them in `main.ts` with
 * `assets.gltf('assets/hero.glb')` before `game.start()` so the loading bar covers them.
 */
export class Assets {
  private readonly manager = new THREE.LoadingManager()
  private readonly gltfLoader = new GLTFLoader(this.manager)
  private readonly textureLoader = new THREE.TextureLoader(this.manager)
  private readonly cache = new Map<string, Promise<unknown>>()
  private listeners = new Set<(progress: number) => void>()

  constructor() {
    this.manager.onProgress = (_url, loaded, total) => {
      const progress = total > 0 ? loaded / total : 1
      for (const fn of this.listeners) fn(progress)
    }
  }

  onProgress(fn: (progress: number) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  gltf(url: string): Promise<GLTF> {
    return this.memo(url, () => this.gltfLoader.loadAsync(url))
  }

  /** Verify shipped model bytes before parsing; a mismatch rejects so gameplay can use its procedural fallback. */
  gltfVerified(url: string, expectedSha256: string, dependencies: readonly { url: string; sha256: string }[] = []): Promise<GLTF> {
    return this.memo(`${url}#sha256=${expectedSha256}`, async () => {
      await Promise.all(dependencies.map(asset => this.verifyBytes(asset.url, asset.sha256)))
      const { absoluteUrl, bytes } = await this.verifyBytes(url, expectedSha256)
      return this.gltfLoader.parseAsync(bytes, new URL('./', absoluteUrl).href)
    })
  }

  private async verifyBytes(url: string, expectedSha256: string): Promise<{ absoluteUrl: URL; bytes: ArrayBuffer }> {
    if (!globalThis.crypto?.subtle) throw new Error('SHA-256 verification is unavailable in this browser')
    const absoluteUrl = new URL(url, document.baseURI)
    const response = await fetch(absoluteUrl, { cache: 'force-cache' })
    if (!response.ok) throw new Error(`Asset request failed (${response.status}): ${url}`)
    const bytes = await response.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    if (actual !== expectedSha256.toLowerCase()) throw new Error(`SHA-256 mismatch for ${url}`)
    return { absoluteUrl, bytes }
  }

  /** Verify and parse a small JSON asset before exposing it to gameplay. */
  jsonVerified<T>(url: string, expectedSha256: string): Promise<T> {
    return this.memo(`${url}#sha256=${expectedSha256}`, async () => {
      const { bytes } = await this.verifyBytes(url, expectedSha256)
      return JSON.parse(new TextDecoder().decode(bytes)) as T
    })
  }

  /** Color textures are tagged sRGB; pass `color: false` for normal/roughness maps. */
  textureVerified(url: string, expectedSha256: string, { color = true, flipY = false }: { color?: boolean; flipY?: boolean } = {}): Promise<THREE.Texture> {
    return this.memo(`${url}#sha256=${expectedSha256}#texture#${color}#${flipY}`, async () => {
      const { bytes } = await this.verifyBytes(url, expectedSha256)
      const image = await createImageBitmap(new Blob([bytes]))
      const texture = new THREE.Texture(image)
      texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.flipY = flipY
      texture.needsUpdate = true
      return texture
    })
  }

  texture(url: string, { color = true, repeat }: { color?: boolean; repeat?: number } = {}): Promise<THREE.Texture> {
    return this.memo(`${url}#${color}#${repeat ?? 1}`, async () => {
      const tex = await this.textureLoader.loadAsync(url)
      if (color) tex.colorSpace = THREE.SRGBColorSpace
      if (repeat) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(repeat, repeat)
      }
      return tex
    })
  }

  private memo<T>(key: string, load: () => Promise<T>): Promise<T> {
    let pending = this.cache.get(key) as Promise<T> | undefined
    if (!pending) {
      pending = load()
      this.cache.set(key, pending)
      pending.catch(() => this.cache.delete(key))
    }
    return pending
  }
}

export const KCH_GAME_TEXTURES = {
  mapAtlas: { url: 'assets/models/kch/textures/default.png?v=20261025', sha256: 'd4e1975c843ef4774da7129f02b502be8b341736cd178e4778c5d503ce4a8e82' },
  killIcon: 'assets/ui/kch/kill-icons/kill_icon1.webp',
} as const
