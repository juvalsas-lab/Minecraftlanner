// Zuordnung der alten numerischen Block-IDs (Legacy-Format, Minecraft < 1.13)
// zu modernen Blocknamen. Wird vom Viewer benoetigt, um klassische
// .schematic-Dateien (MCEdit/WorldEdit) zu laden.
//
// window.LEGACY_BLOCKS        : Zahl (ID)  -> Basis-Blockname "minecraft:..."
// window.LEGACY_BLOCK_DATA    : Zahl (ID)  -> { Metadata-Wert -> Blockname }
//
// Bei Blocknamen ohne Varianten genuegt der Basis-Eintrag in LEGACY_BLOCKS.
window.LEGACY_BLOCKS = {
  0: 'minecraft:air',
  1: 'minecraft:stone',
  2: 'minecraft:grass_block',
  3: 'minecraft:dirt',
  4: 'minecraft:cobblestone',
  5: 'minecraft:oak_planks',
  6: 'minecraft:oak_sapling',
  7: 'minecraft:bedrock',
  8: 'minecraft:water',
  9: 'minecraft:water',
  10: 'minecraft:lava',
  11: 'minecraft:lava',
  12: 'minecraft:sand',
  13: 'minecraft:gravel',
  14: 'minecraft:gold_ore',
  15: 'minecraft:iron_ore',
  16: 'minecraft:coal_ore',
  17: 'minecraft:oak_log',
  18: 'minecraft:oak_leaves',
  19: 'minecraft:sponge',
  20: 'minecraft:glass',
  21: 'minecraft:lapis_ore',
  22: 'minecraft:lapis_block',
  23: 'minecraft:dispenser',
  24: 'minecraft:sandstone',
  25: 'minecraft:note_block',
  26: 'minecraft:red_bed',
  27: 'minecraft:powered_rail',
  28: 'minecraft:detector_rail',
  29: 'minecraft:sticky_piston',
  30: 'minecraft:cobweb',
  31: 'minecraft:short_grass',
  32: 'minecraft:dead_bush',
  33: 'minecraft:piston',
  34: 'minecraft:piston_head',
  35: 'minecraft:white_wool',
  36: 'minecraft:moving_piston',
  37: 'minecraft:dandelion',
  38: 'minecraft:poppy',
  39: 'minecraft:brown_mushroom',
  40: 'minecraft:red_mushroom',
  41: 'minecraft:gold_block',
  42: 'minecraft:iron_block',
  43: 'minecraft:smooth_stone',
  44: 'minecraft:smooth_stone_slab',
  45: 'minecraft:bricks',
  46: 'minecraft:tnt',
  47: 'minecraft:bookshelf',
  48: 'minecraft:mossy_cobblestone',
  49: 'minecraft:obsidian',
  50: 'minecraft:torch',
  51: 'minecraft:fire',
  52: 'minecraft:spawner',
  53: 'minecraft:oak_stairs',
  54: 'minecraft:chest',
  55: 'minecraft:redstone_wire',
  56: 'minecraft:diamond_ore',
  57: 'minecraft:diamond_block',
  58: 'minecraft:crafting_table',
  59: 'minecraft:wheat',
  60: 'minecraft:farmland',
  61: 'minecraft:furnace',
  62: 'minecraft:furnace',
  63: 'minecraft:oak_sign',
  64: 'minecraft:oak_door',
  65: 'minecraft:ladder',
  66: 'minecraft:rail',
  67: 'minecraft:cobblestone_stairs',
  68: 'minecraft:oak_wall_sign',
  69: 'minecraft:lever',
  70: 'minecraft:stone_pressure_plate',
  71: 'minecraft:iron_door',
  72: 'minecraft:oak_pressure_plate',
  73: 'minecraft:redstone_ore',
  74: 'minecraft:redstone_ore',
  75: 'minecraft:redstone_torch',
  76: 'minecraft:redstone_torch',
  77: 'minecraft:stone_button',
  78: 'minecraft:snow',
  79: 'minecraft:ice',
  80: 'minecraft:snow_block',
  81: 'minecraft:cactus',
  82: 'minecraft:clay',
  83: 'minecraft:sugar_cane',
  84: 'minecraft:jukebox',
  85: 'minecraft:oak_fence',
  86: 'minecraft:pumpkin',
  87: 'minecraft:netherrack',
  88: 'minecraft:soul_sand',
  89: 'minecraft:glowstone',
  90: 'minecraft:nether_portal',
  91: 'minecraft:jack_o_lantern',
  92: 'minecraft:cake',
  93: 'minecraft:repeater',
  94: 'minecraft:repeater',
  95: 'minecraft:white_stained_glass',
  96: 'minecraft:oak_trapdoor',
  97: 'minecraft:infested_stone',
  98: 'minecraft:stone_bricks',
  99: 'minecraft:brown_mushroom_block',
  100: 'minecraft:red_mushroom_block',
  101: 'minecraft:iron_bars',
  102: 'minecraft:glass_pane',
  103: 'minecraft:melon',
  104: 'minecraft:pumpkin_stem',
  105: 'minecraft:melon_stem',
  106: 'minecraft:vine',
  107: 'minecraft:oak_fence_gate',
  108: 'minecraft:brick_stairs',
  109: 'minecraft:stone_brick_stairs',
  110: 'minecraft:mycelium',
  111: 'minecraft:lily_pad',
  112: 'minecraft:nether_bricks',
  113: 'minecraft:nether_brick_fence',
  114: 'minecraft:nether_brick_stairs',
  115: 'minecraft:nether_wart',
  116: 'minecraft:enchanting_table',
  117: 'minecraft:brewing_stand',
  118: 'minecraft:cauldron',
  119: 'minecraft:end_portal',
  120: 'minecraft:end_portal_frame',
  121: 'minecraft:end_stone',
  122: 'minecraft:dragon_egg',
  123: 'minecraft:redstone_lamp',
  124: 'minecraft:redstone_lamp',
  125: 'minecraft:oak_slab',
  126: 'minecraft:oak_slab',
  127: 'minecraft:cocoa',
  128: 'minecraft:sandstone_stairs',
  129: 'minecraft:emerald_ore',
  130: 'minecraft:ender_chest',
  131: 'minecraft:tripwire_hook',
  132: 'minecraft:tripwire',
  133: 'minecraft:emerald_block',
  134: 'minecraft:spruce_stairs',
  135: 'minecraft:birch_stairs',
  136: 'minecraft:jungle_stairs',
  137: 'minecraft:command_block',
  138: 'minecraft:beacon',
  139: 'minecraft:cobblestone_wall',
  140: 'minecraft:flower_pot',
  141: 'minecraft:carrots',
  142: 'minecraft:potatoes',
  143: 'minecraft:oak_button',
  144: 'minecraft:skeleton_skull',
  145: 'minecraft:anvil',
  146: 'minecraft:trapped_chest',
  147: 'minecraft:light_weighted_pressure_plate',
  148: 'minecraft:heavy_weighted_pressure_plate',
  149: 'minecraft:comparator',
  150: 'minecraft:comparator',
  151: 'minecraft:daylight_detector',
  152: 'minecraft:redstone_block',
  153: 'minecraft:nether_quartz_ore',
  154: 'minecraft:hopper',
  155: 'minecraft:quartz_block',
  156: 'minecraft:quartz_stairs',
  157: 'minecraft:activator_rail',
  158: 'minecraft:dropper',
  159: 'minecraft:white_terracotta',
  160: 'minecraft:white_stained_glass_pane',
  161: 'minecraft:acacia_leaves',
  162: 'minecraft:acacia_log',
  163: 'minecraft:acacia_stairs',
  164: 'minecraft:dark_oak_stairs',
  165: 'minecraft:slime_block',
  166: 'minecraft:barrier',
  167: 'minecraft:iron_trapdoor',
  168: 'minecraft:prismarine',
  169: 'minecraft:sea_lantern',
  170: 'minecraft:hay_block',
  171: 'minecraft:white_carpet',
  172: 'minecraft:terracotta',
  173: 'minecraft:coal_block',
  174: 'minecraft:packed_ice',
  175: 'minecraft:sunflower',
  176: 'minecraft:white_banner',
  177: 'minecraft:white_wall_banner',
  178: 'minecraft:daylight_detector',
  179: 'minecraft:red_sandstone',
  180: 'minecraft:red_sandstone_stairs',
  181: 'minecraft:red_sandstone_slab',
  182: 'minecraft:red_sandstone_slab',
  183: 'minecraft:spruce_fence_gate',
  184: 'minecraft:birch_fence_gate',
  185: 'minecraft:jungle_fence_gate',
  186: 'minecraft:dark_oak_fence_gate',
  187: 'minecraft:acacia_fence_gate',
  188: 'minecraft:spruce_fence',
  189: 'minecraft:birch_fence',
  190: 'minecraft:jungle_fence',
  191: 'minecraft:dark_oak_fence',
  192: 'minecraft:acacia_fence',
  193: 'minecraft:spruce_door',
  194: 'minecraft:birch_door',
  195: 'minecraft:jungle_door',
  196: 'minecraft:acacia_door',
  197: 'minecraft:dark_oak_door',
  198: 'minecraft:end_rod',
  199: 'minecraft:chorus_plant',
  200: 'minecraft:chorus_flower',
  201: 'minecraft:purpur_block',
  202: 'minecraft:purpur_pillar',
  203: 'minecraft:purpur_stairs',
  204: 'minecraft:purpur_slab',
  205: 'minecraft:purpur_slab',
  206: 'minecraft:end_stone_bricks',
  207: 'minecraft:beetroots',
  208: 'minecraft:dirt_path',
  209: 'minecraft:end_gateway',
  210: 'minecraft:repeating_command_block',
  211: 'minecraft:chain_command_block',
  212: 'minecraft:frosted_ice',
  213: 'minecraft:magma_block',
  214: 'minecraft:nether_wart_block',
  215: 'minecraft:red_nether_bricks',
  216: 'minecraft:bone_block',
  217: 'minecraft:structure_void',
  218: 'minecraft:observer',
  255: 'minecraft:structure_block'
};

// Metadata-abhaengige Varianten (Farbe, Holzart, Steinart ...)
window.LEGACY_BLOCK_DATA = {
  5: {
    0: 'minecraft:oak_planks', 1: 'minecraft:spruce_planks', 2: 'minecraft:birch_planks',
    3: 'minecraft:jungle_planks', 4: 'minecraft:acacia_planks', 5: 'minecraft:dark_oak_planks'
  },
  6: {
    0: 'minecraft:oak_sapling', 1: 'minecraft:spruce_sapling', 2: 'minecraft:birch_sapling',
    3: 'minecraft:jungle_sapling', 4: 'minecraft:acacia_sapling', 5: 'minecraft:dark_oak_sapling'
  },
  12: { 0: 'minecraft:sand', 1: 'minecraft:red_sand' },
  17: {
    0: 'minecraft:oak_log', 1: 'minecraft:spruce_log', 2: 'minecraft:birch_log', 3: 'minecraft:jungle_log'
  },
  18: {
    0: 'minecraft:oak_leaves', 1: 'minecraft:spruce_leaves', 2: 'minecraft:birch_leaves',
    3: 'minecraft:jungle_leaves'
  },
  19: { 0: 'minecraft:sponge', 1: 'minecraft:wet_sponge' },
  24: { 0: 'minecraft:sandstone', 1: 'minecraft:chiseled_sandstone', 2: 'minecraft:cut_sandstone' },
  35: {
    0: 'minecraft:white_wool', 1: 'minecraft:orange_wool', 2: 'minecraft:magenta_wool',
    3: 'minecraft:light_blue_wool', 4: 'minecraft:yellow_wool', 5: 'minecraft:lime_wool',
    6: 'minecraft:pink_wool', 7: 'minecraft:gray_wool', 8: 'minecraft:light_gray_wool',
    9: 'minecraft:cyan_wool', 10: 'minecraft:purple_wool', 11: 'minecraft:blue_wool',
    12: 'minecraft:brown_wool', 13: 'minecraft:green_wool', 14: 'minecraft:red_wool',
    15: 'minecraft:black_wool'
  },
  43: { 0: 'minecraft:smooth_stone', 8: 'minecraft:smooth_stone' },
  44: {
    0: 'minecraft:smooth_stone_slab', 1: 'minecraft:sandstone_slab', 2: 'minecraft:petrified_oak_slab',
    3: 'minecraft:cobblestone_slab', 4: 'minecraft:brick_slab', 5: 'minecraft:stone_brick_slab',
    6: 'minecraft:nether_brick_slab', 7: 'minecraft:quartz_slab'
  },
  95: {
    0: 'minecraft:white_stained_glass', 1: 'minecraft:orange_stained_glass', 2: 'minecraft:magenta_stained_glass',
    3: 'minecraft:light_blue_stained_glass', 4: 'minecraft:yellow_stained_glass', 5: 'minecraft:lime_stained_glass',
    6: 'minecraft:pink_stained_glass', 7: 'minecraft:gray_stained_glass', 8: 'minecraft:light_gray_stained_glass',
    9: 'minecraft:cyan_stained_glass', 10: 'minecraft:purple_stained_glass', 11: 'minecraft:blue_stained_glass',
    12: 'minecraft:brown_stained_glass', 13: 'minecraft:green_stained_glass', 14: 'minecraft:red_stained_glass',
    15: 'minecraft:black_stained_glass'
  },
  97: { 0: 'minecraft:infested_stone', 1: 'minecraft:infested_cobblestone', 2: 'minecraft:infested_stone_bricks' },
  98: {
    0: 'minecraft:stone_bricks', 1: 'minecraft:mossy_stone_bricks',
    2: 'minecraft:cracked_stone_bricks', 3: 'minecraft:chiseled_stone_bricks'
  },
  125: {
    0: 'minecraft:oak_planks', 1: 'minecraft:spruce_planks', 2: 'minecraft:birch_planks',
    3: 'minecraft:jungle_planks', 4: 'minecraft:acacia_planks', 5: 'minecraft:dark_oak_planks'
  },
  126: {
    0: 'minecraft:oak_slab', 1: 'minecraft:spruce_slab', 2: 'minecraft:birch_slab',
    3: 'minecraft:jungle_slab', 4: 'minecraft:acacia_slab', 5: 'minecraft:dark_oak_slab'
  },
  139: { 0: 'minecraft:cobblestone_wall', 1: 'minecraft:mossy_cobblestone_wall' },
  145: { 0: 'minecraft:anvil', 1: 'minecraft:chipped_anvil', 2: 'minecraft:damaged_anvil' },
  155: { 0: 'minecraft:quartz_block', 1: 'minecraft:chiseled_quartz_block', 2: 'minecraft:quartz_pillar' },
  159: {
    0: 'minecraft:white_terracotta', 1: 'minecraft:orange_terracotta', 2: 'minecraft:magenta_terracotta',
    3: 'minecraft:light_blue_terracotta', 4: 'minecraft:yellow_terracotta', 5: 'minecraft:lime_terracotta',
    6: 'minecraft:pink_terracotta', 7: 'minecraft:gray_terracotta', 8: 'minecraft:light_gray_terracotta',
    9: 'minecraft:cyan_terracotta', 10: 'minecraft:purple_terracotta', 11: 'minecraft:blue_terracotta',
    12: 'minecraft:brown_terracotta', 13: 'minecraft:green_terracotta', 14: 'minecraft:red_terracotta',
    15: 'minecraft:black_terracotta'
  },
  160: {
    0: 'minecraft:white_stained_glass_pane', 1: 'minecraft:orange_stained_glass_pane', 2: 'minecraft:magenta_stained_glass_pane',
    3: 'minecraft:light_blue_stained_glass_pane', 4: 'minecraft:yellow_stained_glass_pane', 5: 'minecraft:lime_stained_glass_pane',
    6: 'minecraft:pink_stained_glass_pane', 7: 'minecraft:gray_stained_glass_pane', 8: 'minecraft:light_gray_stained_glass_pane',
    9: 'minecraft:cyan_stained_glass_pane', 10: 'minecraft:purple_stained_glass_pane', 11: 'minecraft:blue_stained_glass_pane',
    12: 'minecraft:brown_stained_glass_pane', 13: 'minecraft:green_stained_glass_pane', 14: 'minecraft:red_stained_glass_pane',
    15: 'minecraft:black_stained_glass_pane'
  },
  161: { 0: 'minecraft:acacia_leaves', 1: 'minecraft:dark_oak_leaves' },
  162: { 0: 'minecraft:acacia_log', 1: 'minecraft:dark_oak_log' },
  168: { 0: 'minecraft:prismarine', 1: 'minecraft:prismarine_bricks', 2: 'minecraft:dark_prismarine' },
  171: {
    0: 'minecraft:white_carpet', 1: 'minecraft:orange_carpet', 2: 'minecraft:magenta_carpet',
    3: 'minecraft:light_blue_carpet', 4: 'minecraft:yellow_carpet', 5: 'minecraft:lime_carpet',
    6: 'minecraft:pink_carpet', 7: 'minecraft:gray_carpet', 8: 'minecraft:light_gray_carpet',
    9: 'minecraft:cyan_carpet', 10: 'minecraft:purple_carpet', 11: 'minecraft:blue_carpet',
    12: 'minecraft:brown_carpet', 13: 'minecraft:green_carpet', 14: 'minecraft:red_carpet',
    15: 'minecraft:black_carpet'
  },
  175: {
    0: 'minecraft:sunflower', 1: 'minecraft:lilac', 2: 'minecraft:tall_grass',
    3: 'minecraft:large_fern', 4: 'minecraft:rose_bush', 5: 'minecraft:peony'
  },
  179: { 0: 'minecraft:red_sandstone', 1: 'minecraft:chiseled_red_sandstone', 2: 'minecraft:cut_red_sandstone' },
  181: { 0: 'minecraft:red_sandstone', 8: 'minecraft:red_sandstone' }
};

// Farbserien: gleich aufgebaute Bloecke, nur je ID/Farbe unterschiedlich
(function () {
  const COLORS = [
    'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
    'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'
  ];

  // Shulker-Boxen (219-234), Glaeserne Ziegel (235-250): eigene ID je Farbe
  COLORS.forEach((color, i) => {
    window.LEGACY_BLOCKS[219 + i] = `minecraft:${color}_shulker_box`;
    window.LEGACY_BLOCKS[235 + i] = `minecraft:${color}_glazed_terracotta`;
  });

  // Beton (251) und Betonpulver (252): Farbe ueber die Metadata
  const concrete = {};
  const concretePowder = {};
  COLORS.forEach((color, i) => {
    concrete[i] = `minecraft:${color}_concrete`;
    concretePowder[i] = `minecraft:${color}_concrete_powder`;
  });
  window.LEGACY_BLOCK_DATA[251] = concrete;
  window.LEGACY_BLOCK_DATA[252] = concretePowder;

  // Banner-Boden/Wand (176/177): Farbe ueber Metadata
  const banner = {};
  const wallBanner = {};
  COLORS.forEach((color, i) => {
    banner[i] = `minecraft:${color}_banner`;
    wallBanner[i] = `minecraft:${color}_wall_banner`;
  });
  window.LEGACY_BLOCK_DATA[176] = banner;
  window.LEGACY_BLOCK_DATA[177] = wallBanner;
})();

// Loest eine Legacy-ID samt Metadata in einen modernen Blocknamen auf.
window.resolveLegacyBlock = function (id, meta) {
  const base = window.LEGACY_BLOCKS[id] || 'minecraft:stone';
  const variants = window.LEGACY_BLOCK_DATA[id];
  if (!variants) return base;
  // Manche Bloecke kodieren Flags in den oberen Bits (z. B. "kein Verfall" bei
  // Blaettern), daher zusaetzlich mit maske suchen.
  return variants[meta] || variants[meta & 7] || variants[meta & 3] || variants[meta & 1] || base;
};
