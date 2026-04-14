// Curated subset of the official Scratch asset library
// Assets served from https://cdn.assets.scratch.mit.edu/internalapi/asset/{md5ext}/get/

export interface ScratchLibraryAsset {
  name: string;
  tags: string[];
  assetId: string;
  dataFormat: string;
  md5ext: string;
  bitmapResolution?: number;
  rotationCenterX?: number;
  rotationCenterY?: number;
  sampleCount?: number;
  rate?: number;
}

export const SCRATCH_ASSET_CDN = 'https://cdn.assets.scratch.mit.edu/internalapi/asset';

export function assetUrl(md5ext: string): string {
  return `${SCRATCH_ASSET_CDN}/${md5ext}/get/`;
}

// ── Costumes ──────────────────────────────────────────
export const costumeLibrary: ScratchLibraryAsset[] = [
  { name: "Abby-a", tags: ["people","person"], assetId: "809d9b47347a6af2860e7a3a35bce057", dataFormat: "svg", md5ext: "809d9b47347a6af2860e7a3a35bce057.svg", rotationCenterX: 31, rotationCenterY: 100 },
  { name: "Abby-b", tags: ["people","person"], assetId: "920f14335615fff9b8c55fccb8971984", dataFormat: "svg", md5ext: "920f14335615fff9b8c55fccb8971984.svg", rotationCenterX: 31, rotationCenterY: 100 },
  { name: "Amon", tags: ["people","dance"], assetId: "399a1432d5e4a2969adfe904084bfb47", dataFormat: "svg", md5ext: "399a1432d5e4a2969adfe904084bfb47.svg", rotationCenterX: 62, rotationCenterY: 122 },
  { name: "Apple", tags: ["food","fruit"], assetId: "cf0bff6dc28e67cc0e47a4ee7a788d23", dataFormat: "svg", md5ext: "cf0bff6dc28e67cc0e47a4ee7a788d23.svg", rotationCenterX: 32, rotationCenterY: 34 },
  { name: "Arrow1-a", tags: ["things"], assetId: "20caecbc9cc97c6e8e42f751d4fb1e10", dataFormat: "svg", md5ext: "20caecbc9cc97c6e8e42f751d4fb1e10.svg", rotationCenterX: 24, rotationCenterY: 24 },
  { name: "Ball-a", tags: ["sports","things"], assetId: "3a8bb7f2ff6b2bca0dd9c4e28a444a03", dataFormat: "svg", md5ext: "3a8bb7f2ff6b2bca0dd9c4e28a444a03.svg", rotationCenterX: 24, rotationCenterY: 24 },
  { name: "Bananas", tags: ["food","fruit"], assetId: "e21b14597c0e247c19e8990e91e476ec", dataFormat: "svg", md5ext: "e21b14597c0e247c19e8990e91e476ec.svg", rotationCenterX: 37, rotationCenterY: 31 },
  { name: "Bat-a", tags: ["animals","flying"], assetId: "b5a06e582e74e2ccbab3b0e04ab3569c", dataFormat: "svg", md5ext: "b5a06e582e74e2ccbab3b0e04ab3569c.svg", rotationCenterX: 46, rotationCenterY: 40 },
  { name: "Bear-a", tags: ["animals"], assetId: "5f37e5102572970b7be1dab66b5cb346", dataFormat: "svg", md5ext: "5f37e5102572970b7be1dab66b5cb346.svg", rotationCenterX: 53, rotationCenterY: 52 },
  { name: "Bell1", tags: ["things","music"], assetId: "ec70e89b18091534e7c1d5a8f8ecd227", dataFormat: "svg", md5ext: "ec70e89b18091534e7c1d5a8f8ecd227.svg", rotationCenterX: 18, rotationCenterY: 27 },
  { name: "Butterfly1-a", tags: ["animals","flying"], assetId: "41a459ef52bdf44a9d09e56277524949", dataFormat: "svg", md5ext: "41a459ef52bdf44a9d09e56277524949.svg", rotationCenterX: 32, rotationCenterY: 31 },
  { name: "Button1", tags: ["things"], assetId: "d01367a5e3ffbaac7c6e1c2e82a1da23", dataFormat: "svg", md5ext: "d01367a5e3ffbaac7c6e1c2e82a1da23.svg", rotationCenterX: 26, rotationCenterY: 26 },
  { name: "Cat", tags: ["animals"], assetId: "bcf454acf82e4504149f7ffe07081571", dataFormat: "svg", md5ext: "bcf454acf82e4504149f7ffe07081571.svg", rotationCenterX: 48, rotationCenterY: 50 },
  { name: "Crystal-a", tags: ["things","fantasy"], assetId: "2f5f0e3ce56a4fa44f4aa0b56f8dc971", dataFormat: "svg", md5ext: "2f5f0e3ce56a4fa44f4aa0b56f8dc971.svg", rotationCenterX: 23, rotationCenterY: 30 },
  { name: "Dinosaur1-a", tags: ["animals","fantasy"], assetId: "2fa4834f4cebe07de77ff5f63a8d26c0", dataFormat: "svg", md5ext: "2fa4834f4cebe07de77ff5f63a8d26c0.svg", rotationCenterX: 73, rotationCenterY: 75 },
  { name: "Dog1-a", tags: ["animals","pets"], assetId: "82e7c5b729b4b0d5db609a1bc0d13ae6", dataFormat: "svg", md5ext: "82e7c5b729b4b0d5db609a1bc0d13ae6.svg", rotationCenterX: 32, rotationCenterY: 32 },
  { name: "Donut", tags: ["food"], assetId: "3dd75985e5bdc9c66b8abbb098c2b3be", dataFormat: "svg", md5ext: "3dd75985e5bdc9c66b8abbb098c2b3be.svg", rotationCenterX: 31, rotationCenterY: 33 },
  { name: "Dragon-a", tags: ["animals","fantasy"], assetId: "07e3b35d9f9ced8b7e05e652eae9c960", dataFormat: "svg", md5ext: "07e3b35d9f9ced8b7e05e652eae9c960.svg", rotationCenterX: 72, rotationCenterY: 70 },
  { name: "Duck", tags: ["animals"], assetId: "1e4095b9b40b2b6dde2f73c0a6dd4c72", dataFormat: "svg", md5ext: "1e4095b9b40b2b6dde2f73c0a6dd4c72.svg", rotationCenterX: 36, rotationCenterY: 44 },
  { name: "Earth", tags: ["space"], assetId: "814404df4455ae041d112ae1b1f211e1", dataFormat: "svg", md5ext: "814404df4455ae041d112ae1b1f211e1.svg", rotationCenterX: 36, rotationCenterY: 36 },
  { name: "Football", tags: ["sports"], assetId: "d92e1f23a3cc0df6d52f03b9dd4b2a6e", dataFormat: "svg", md5ext: "d92e1f23a3cc0df6d52f03b9dd4b2a6e.svg", rotationCenterX: 30, rotationCenterY: 20 },
  { name: "Ghost-a", tags: ["fantasy"], assetId: "9b09988a8bdf8e8c10ec9f8cddc0e88a", dataFormat: "svg", md5ext: "9b09988a8bdf8e8c10ec9f8cddc0e88a.svg", rotationCenterX: 37, rotationCenterY: 46 },
  { name: "Gobo-a", tags: ["fantasy"], assetId: "7e35a1cd4bda8e1b1a043c1bbc932c4d", dataFormat: "svg", md5ext: "7e35a1cd4bda8e1b1a043c1bbc932c4d.svg", rotationCenterX: 47, rotationCenterY: 55 },
  { name: "Griffin-a", tags: ["fantasy","animals"], assetId: "bbea20e9c152caed4a15ec0a2570e0a6", dataFormat: "svg", md5ext: "bbea20e9c152caed4a15ec0a2570e0a6.svg", rotationCenterX: 67, rotationCenterY: 56 },
  { name: "Guitar-a", tags: ["music","things"], assetId: "e0e2b825fdf25c61c0c0d98c3ce59a65", dataFormat: "svg", md5ext: "e0e2b825fdf25c61c0c0d98c3ce59a65.svg", rotationCenterX: 30, rotationCenterY: 62 },
  { name: "Heart Red", tags: ["things"], assetId: "e4ef09c7385b6a9bf35c90fd142c6fac", dataFormat: "svg", md5ext: "e4ef09c7385b6a9bf35c90fd142c6fac.svg", rotationCenterX: 24, rotationCenterY: 22 },
  { name: "Hippo1-a", tags: ["animals"], assetId: "c76ce785b9ee1d0cfb1e6eb15ef78a22", dataFormat: "svg", md5ext: "c76ce785b9ee1d0cfb1e6eb15ef78a22.svg", rotationCenterX: 52, rotationCenterY: 59 },
  { name: "Key", tags: ["things"], assetId: "51c49e0b30e00df26c0f0a50b9d2a211", dataFormat: "svg", md5ext: "51c49e0b30e00df26c0f0a50b9d2a211.svg", rotationCenterX: 13, rotationCenterY: 22 },
  { name: "Knight", tags: ["fantasy","people"], assetId: "eb0cd3f8f59b7fb485b6c05a1e8ef76a", dataFormat: "svg", md5ext: "eb0cd3f8f59b7fb485b6c05a1e8ef76a.svg", rotationCenterX: 60, rotationCenterY: 90 },
  { name: "Lightning", tags: ["things","weather"], assetId: "c658fb58acb0610c60bc7de42a2a0c31", dataFormat: "svg", md5ext: "c658fb58acb0610c60bc7de42a2a0c31.svg", rotationCenterX: 22, rotationCenterY: 38 },
  { name: "Lion-a", tags: ["animals"], assetId: "692a3c455d5fc43ac1e68eb5e926abfe", dataFormat: "svg", md5ext: "692a3c455d5fc43ac1e68eb5e926abfe.svg", rotationCenterX: 59, rotationCenterY: 58 },
  { name: "Monkey-a", tags: ["animals"], assetId: "ebc73d0c61b826c91d5fae12b3e17b44", dataFormat: "svg", md5ext: "ebc73d0c61b826c91d5fae12b3e17b44.svg", rotationCenterX: 38, rotationCenterY: 55 },
  { name: "Parrot-a", tags: ["animals","flying"], assetId: "55fe1e26dfcd41f4be9133544c28c685", dataFormat: "svg", md5ext: "55fe1e26dfcd41f4be9133544c28c685.svg", rotationCenterX: 36, rotationCenterY: 50 },
  { name: "Pencil-a", tags: ["things"], assetId: "c88b3cce68911504e536c1eef3e4c7dc", dataFormat: "svg", md5ext: "c88b3cce68911504e536c1eef3e4c7dc.svg", rotationCenterX: 17, rotationCenterY: 71 },
  { name: "Penguin-a", tags: ["animals"], assetId: "b9ba1c3c1c93e07e84a048cadd52a0e7", dataFormat: "svg", md5ext: "b9ba1c3c1c93e07e84a048cadd52a0e7.svg", rotationCenterX: 38, rotationCenterY: 56 },
  { name: "Robot-a", tags: ["things","fantasy"], assetId: "6e9e381820e5ff67ac13cad5af1e0b0f", dataFormat: "svg", md5ext: "6e9e381820e5ff67ac13cad5af1e0b0f.svg", rotationCenterX: 56, rotationCenterY: 64 },
  { name: "Rocket-a", tags: ["space","things"], assetId: "9fba39f59fef44fe984aa6ca34c0e0e7", dataFormat: "svg", md5ext: "9fba39f59fef44fe984aa6ca34c0e0e7.svg", rotationCenterX: 16, rotationCenterY: 38 },
  { name: "Shark-a", tags: ["animals","underwater"], assetId: "603fa118449ad9ef4da0b0b0eb07da15", dataFormat: "svg", md5ext: "603fa118449ad9ef4da0b0b0eb07da15.svg", rotationCenterX: 72, rotationCenterY: 48 },
  { name: "Snake-a", tags: ["animals"], assetId: "3e89cd2a94c4f29ed16d48f7e90bcadc", dataFormat: "svg", md5ext: "3e89cd2a94c4f29ed16d48f7e90bcadc.svg", rotationCenterX: 45, rotationCenterY: 42 },
  { name: "Snowflake", tags: ["things","weather"], assetId: "b6c6d7746b2cd80b1c3e12cc2e4c9337", dataFormat: "svg", md5ext: "b6c6d7746b2cd80b1c3e12cc2e4c9337.svg", rotationCenterX: 24, rotationCenterY: 24 },
  { name: "Star", tags: ["things"], assetId: "9f4f86de41ef0370d7d19d396dfd4a42", dataFormat: "svg", md5ext: "9f4f86de41ef0370d7d19d396dfd4a42.svg", rotationCenterX: 24, rotationCenterY: 24 },
  { name: "Sun", tags: ["things","weather","space"], assetId: "28e3f8f4be2880e0bfa0f1e25bb3d4a9", dataFormat: "svg", md5ext: "28e3f8f4be2880e0bfa0f1e25bb3d4a9.svg", rotationCenterX: 36, rotationCenterY: 36 },
  { name: "Taco", tags: ["food"], assetId: "bb5dde6bc08b74ccbb25ad63e4e98fbe", dataFormat: "svg", md5ext: "bb5dde6bc08b74ccbb25ad63e4e98fbe.svg", rotationCenterX: 25, rotationCenterY: 25 },
  { name: "Tree1", tags: ["outdoors"], assetId: "bea2a276b4ea27bd7ce2df2c21e08f41", dataFormat: "svg", md5ext: "bea2a276b4ea27bd7ce2df2c21e08f41.svg", rotationCenterX: 35, rotationCenterY: 60 },
  { name: "Unicorn Running-a", tags: ["animals","fantasy"], assetId: "78b071ea0fba3f5825be8e3e0c032a40", dataFormat: "svg", md5ext: "78b071ea0fba3f5825be8e3e0c032a40.svg", rotationCenterX: 66, rotationCenterY: 60 },
];

// ── Backdrops ──────────────────────────────────────────
export const backdropLibrary: ScratchLibraryAsset[] = [
  { name: "Arctic", tags: ["outdoors","cold"], assetId: "67e0db3305b3c8bac3a363b1c428892e", bitmapResolution: 2, dataFormat: "png", md5ext: "67e0db3305b3c8bac3a363b1c428892e.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Baseball 1", tags: ["sports","outdoors"], assetId: "825d9b54682c406215d9d1f98a819449", dataFormat: "svg", md5ext: "825d9b54682c406215d9d1f98a819449.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Basketball 1", tags: ["sports","outdoors"], assetId: "ae21eac3d1814aee1d37ae82ea287816", dataFormat: "svg", md5ext: "ae21eac3d1814aee1d37ae82ea287816.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Beach Malibu", tags: ["outdoors","beach"], assetId: "5b0a970202b464915915260c03f05455", bitmapResolution: 2, dataFormat: "png", md5ext: "5b0a970202b464915915260c03f05455.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Blue Sky", tags: ["outdoors","sky"], assetId: "09c63e5aa15df7be57e3a76a16a67d44", dataFormat: "svg", md5ext: "09c63e5aa15df7be57e3a76a16a67d44.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Boardwalk", tags: ["outdoors"], assetId: "9891765c7d74db287cba5e79e6e5a9af", bitmapResolution: 2, dataFormat: "png", md5ext: "9891765c7d74db287cba5e79e6e5a9af.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Canyon", tags: ["outdoors"], assetId: "ed049d9b1ab74067a9ce6d25e432d706", bitmapResolution: 2, dataFormat: "png", md5ext: "ed049d9b1ab74067a9ce6d25e432d706.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Castle 1", tags: ["indoors","fantasy"], assetId: "ec1be2fc16d34a6a7e4bfea52b6aa8d7", bitmapResolution: 2, dataFormat: "png", md5ext: "ec1be2fc16d34a6a7e4bfea52b6aa8d7.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Chalkboard", tags: ["indoors","school"], assetId: "a8a24b5aa717bbef09dbe31368914427", bitmapResolution: 2, dataFormat: "png", md5ext: "a8a24b5aa717bbef09dbe31368914427.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Concert", tags: ["music"], assetId: "b86ae24263be40aa5f5cfe6bf0827a72", bitmapResolution: 2, dataFormat: "png", md5ext: "b86ae24263be40aa5f5cfe6bf0827a72.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Farm", tags: ["outdoors"], assetId: "f4f908da19e2753f3ed679d7b37650ca", dataFormat: "svg", md5ext: "f4f908da19e2753f3ed679d7b37650ca.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Forest", tags: ["outdoors","nature"], assetId: "f2f24ba0f855a785ace71f3f550ef867", bitmapResolution: 2, dataFormat: "png", md5ext: "f2f24ba0f855a785ace71f3f550ef867.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Galaxy", tags: ["space"], assetId: "5fab1922f254ae9fd150162c3e392bef", bitmapResolution: 2, dataFormat: "png", md5ext: "5fab1922f254ae9fd150162c3e392bef.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Hall", tags: ["indoors"], assetId: "93d71e8b8a96cc007b8d68f36acd338a", bitmapResolution: 2, dataFormat: "png", md5ext: "93d71e8b8a96cc007b8d68f36acd338a.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Jungle", tags: ["outdoors","nature"], assetId: "ee91ae81f9a4f8d5ddb98ce5aaba0341", bitmapResolution: 2, dataFormat: "png", md5ext: "ee91ae81f9a4f8d5ddb98ce5aaba0341.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Metro", tags: ["outdoors","city"], assetId: "6fdc795ff487204f72740567be5f64f9", bitmapResolution: 2, dataFormat: "png", md5ext: "6fdc795ff487204f72740567be5f64f9.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Moon", tags: ["space"], assetId: "8e0c6f7a78491c2ced098fb52f2bc4f0", bitmapResolution: 2, dataFormat: "png", md5ext: "8e0c6f7a78491c2ced098fb52f2bc4f0.png", rotationCenterX: 480, rotationCenterY: 360 },
  { name: "Neon Tunnel", tags: ["music","patterns"], assetId: "21e2a35e3c76ab0756dbb13dafa8445f", dataFormat: "svg", md5ext: "21e2a35e3c76ab0756dbb13dafa8445f.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Rays", tags: ["patterns"], assetId: "87e963282db9e020b8bf76cbfb3a0301", dataFormat: "svg", md5ext: "87e963282db9e020b8bf76cbfb3a0301.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Soccer", tags: ["sports","outdoors"], assetId: "8b005a46a3868c4eec3e79820069f381", dataFormat: "svg", md5ext: "8b005a46a3868c4eec3e79820069f381.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Space", tags: ["space"], assetId: "c00540989eb4ba85a519c3b4b8cdd397", dataFormat: "svg", md5ext: "c00540989eb4ba85a519c3b4b8cdd397.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Stars", tags: ["patterns","space"], assetId: "5e8327f3dcca53a30c3e98e80f95f3d4", dataFormat: "svg", md5ext: "5e8327f3dcca53a30c3e98e80f95f3d4.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Theater 1", tags: ["indoors","music"], assetId: "3c771c3dd0bc50c1354ab9c6b6c638c2", dataFormat: "svg", md5ext: "3c771c3dd0bc50c1354ab9c6b6c638c2.svg", rotationCenterX: 240, rotationCenterY: 180 },
  { name: "Xy-grid", tags: ["patterns"], assetId: "94cae4a627444eaa3a11c5c61deb7bab", dataFormat: "svg", md5ext: "94cae4a627444eaa3a11c5c61deb7bab.svg", rotationCenterX: 240, rotationCenterY: 180 },
];

// ── Sounds ──────────────────────────────────────────
export const soundLibrary: ScratchLibraryAsset[] = [
  { name: "A Bass", tags: ["music","instruments","notes"], assetId: "c04ebf21e5e19342fa1535e4efcdb43b", dataFormat: "wav", md5ext: "c04ebf21e5e19342fa1535e4efcdb43b.wav", sampleCount: 56320, rate: 44100 },
  { name: "A Elec Guitar", tags: ["music","instruments"], assetId: "fa5f7fea601e9368dd68449d9a54c995", dataFormat: "wav", md5ext: "fa5f7fea601e9368dd68449d9a54c995.wav", sampleCount: 88200, rate: 44100 },
  { name: "A Elec Piano", tags: ["music","piano"], assetId: "0cfa8e84d6a5cd63afa31d541625a9ef", dataFormat: "wav", md5ext: "0cfa8e84d6a5cd63afa31d541625a9ef.wav", sampleCount: 88200, rate: 44100 },
  { name: "A Guitar", tags: ["music","instruments"], assetId: "ee753e87d212d4b2fb650ca660f1e839", dataFormat: "wav", md5ext: "ee753e87d212d4b2fb650ca660f1e839.wav", sampleCount: 88200, rate: 44100 },
  { name: "A Piano", tags: ["music","instruments","piano"], assetId: "0727959edb2ea0525feed9b0c816991c", dataFormat: "wav", md5ext: "0727959edb2ea0525feed9b0c816991c.wav", sampleCount: 66150, rate: 44100 },
  { name: "A Trumpet", tags: ["music","instruments"], assetId: "4b5857e50f1b847abe549e89e3b3e23b", dataFormat: "wav", md5ext: "4b5857e50f1b847abe549e89e3b3e23b.wav", sampleCount: 22050, rate: 44100 },
  { name: "Bark", tags: ["animals","effects"], assetId: "cd8fa8390b0efdd281882533fbfcfcfb", dataFormat: "wav", md5ext: "cd8fa8390b0efdd281882533fbfcfcfb.wav", sampleCount: 5765, rate: 22050 },
  { name: "Buzz Whir", tags: ["effects","electronic"], assetId: "bc5e8fa2adc9b286d8e743c3c8a211a0", dataFormat: "wav", md5ext: "bc5e8fa2adc9b286d8e743c3c8a211a0.wav", sampleCount: 22050, rate: 22050 },
  { name: "Cat Meow", tags: ["animals","effects"], assetId: "83c36d806dc92327b9e7049a565c6bff", dataFormat: "wav", md5ext: "83c36d806dc92327b9e7049a565c6bff.wav", sampleCount: 18688, rate: 22050 },
  { name: "Chomp", tags: ["effects","wacky"], assetId: "0b1e3033140d094563248e61de4039e5", dataFormat: "wav", md5ext: "0b1e3033140d094563248e61de4039e5.wav", sampleCount: 9163, rate: 22050 },
  { name: "Gong", tags: ["music","percussion"], assetId: "8fceb3c8ed56faf4de09a3eb9b27d3a4", dataFormat: "wav", md5ext: "8fceb3c8ed56faf4de09a3eb9b27d3a4.wav", sampleCount: 88200, rate: 44100 },
  { name: "Hi Beatbox", tags: ["music","hiphop"], assetId: "a2cc98d13ae79f38ab03c6e0d6c5e3b0", dataFormat: "wav", md5ext: "a2cc98d13ae79f38ab03c6e0d6c5e3b0.wav", sampleCount: 4480, rate: 22050 },
  { name: "Jump", tags: ["effects","games"], assetId: "6f02d013ae1a588b4824048e5c159dda", dataFormat: "wav", md5ext: "6f02d013ae1a588b4824048e5c159dda.wav", sampleCount: 2400, rate: 22050 },
  { name: "Pop", tags: ["effects","wacky"], assetId: "83a9787d4cb6f3b7632b4ddfebf74367", dataFormat: "wav", md5ext: "83a9787d4cb6f3b7632b4ddfebf74367.wav", sampleCount: 1032, rate: 22050 },
];

export function getUniqueTags(library: ScratchLibraryAsset[]): string[] {
  const tags = new Set<string>();
  library.forEach((a) => a.tags.forEach((t) => tags.add(t)));
  return Array.from(tags).sort();
}
