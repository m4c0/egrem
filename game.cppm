export module game;
import dotz;
import traits;

using namespace traits::ints;

export namespace game {
  enum block : uint8_t {
    b_empty     =  0,
    b_sheep     =  1,
    b_locked    =  2,
    b_wool      =  3,
    b_thread    =  4,
    b_hat       =  5,
    b_shorts    =  6,
    b_pig       =  7,
    b_shroom    =  8,
    b_soup      =  9,
    b_outfit    = 10,
    b_store     = 11,
    b_easteregg = 12,
    b_straw     = 13,
    b_stick     = 14,
    b_brick     = 15,
    b_fan       = 16,
    b_trash     = 17,
    b_fire      = 18,
    b_wall      = 19,
    b_music     = 20,
    b_garbage   = 21,
    b_compost   = 22,
    b_wheat     = 23,
    b_can       = 24,
    b_metal     = 25,
    b_tool      = 26,
    b_berlin    = 27,
    b_computer  = 28,
    b_phone     = 29,
    b_iphone    = 30,
    b_world     = 31,
    b_chicken   = 32,
    b_egg       = 33,
    b_basket    = 34,
    b_eggplant  = 35,
    b_beer      = 36,
    b_cow       = 37,
    b_milk      = 38,
    b_cheese    = 39,
    b_ball      = 40,
    b_car       = 41,
    b_senna     = 42,
    b_brazil    = 43,
    b_last
  };
}

using namespace game;

// TODO: reduce map to 9x9
static block g_map[16][16];
static block g_unlocks[16][16];
static block g_prizes[256] {};

using mover_t = void (*)(block & from, block & to);
template<block b>
static constexpr auto spawn = [](auto & f, auto & t) { t = f; f = b; };
template<block b>
static constexpr auto merge = [](auto & f, auto & t) { t = b; f = b_empty; };

static constexpr auto ignore = [](auto, auto) {};
static constexpr auto move = [](auto & f, auto & t) { t = f; f = b_empty; };
static constexpr auto unlock = [](auto & f, auto & t) { t = g_prizes[f]; f = b_empty; };
static constexpr auto trash = [](auto & f, auto & t) { f = b_empty; };

static constexpr auto g_domain = [] {
  struct {
    mover_t movers[256][256];
  } res;
  for (auto & row : res.movers) {
    for (auto & m : row) m = ignore;

    row[b_empty] = move;
    row[b_locked] = unlock;
  }
  for (auto i = 0; i < 256; i++) {
    if (i == b_pig)     continue;
    if (i == b_sheep)   continue;
    if (i == b_chicken) continue;
    if (i == b_cow)     continue;
    if (i == b_trash)   continue;
    res.movers[i][b_trash] = trash;
  }

  // TODO/Thoughts:
  // - outfit + hat = scarecrow or one-piece ref?
  // - outfit + tool? = some minecraft ref? tnt?
  // - foo + fan = fan of foo?
  // - root beer?

  res.movers[b_sheep ][b_empty ] = spawn<b_wool>;
  res.movers[b_wool  ][b_wool  ] = merge<b_thread>;
  res.movers[b_thread][b_thread] = merge<b_shorts>;
  res.movers[b_shorts][b_shorts] = merge<b_outfit>;
  res.movers[b_outfit][b_outfit] = merge<b_store>;

  res.movers[b_trash  ][b_empty  ] = spawn<b_garbage>;
  res.movers[b_garbage][b_garbage] = merge<b_compost>;
  res.movers[b_compost][b_compost] = merge<b_wheat>;
  res.movers[b_wheat  ][b_wheat  ] = merge<b_straw>;
  res.movers[b_straw  ][b_straw  ] = merge<b_hat>;
  res.movers[b_hat    ][b_hat    ] = merge<b_fan>;

  res.movers[b_chicken][b_empty] = spawn<b_egg>;
  res.movers[b_egg    ][b_egg  ] = spawn<b_basket>;

  res.movers[b_cow ][b_empty] = spawn<b_milk>;
  res.movers[b_milk][b_milk ] = merge<b_cheese>;

  // Three little pigs
  res.movers[b_fan  ][b_straw] = spawn<b_stick>; // TODO: spawn or merge?
  res.movers[b_stick][b_stick] = merge<b_fire>;
  res.movers[b_fire ][b_stick] = spawn<b_brick>; // TODO: spawn or merge?
  res.movers[b_brick][b_brick] = merge<b_wall>;

  res.movers[b_pig   ][b_empty ] = spawn<b_shroom>;
  res.movers[b_shroom][b_shroom] = merge<b_soup>;
  res.movers[b_soup  ][b_soup  ] = merge<b_can>;
  res.movers[b_can   ][b_can   ] = merge<b_metal>;
  res.movers[b_metal ][b_stick ] = merge<b_tool>;

  res.movers[b_fire    ][b_wall ] = merge<b_computer>;
  res.movers[b_thread  ][b_can  ] = merge<b_phone>;
  res.movers[b_computer][b_phone] = merge<b_iphone>;

  res.movers[b_computer][b_computer] = merge<b_world>;

  res.movers[b_egg][b_wheat] = merge<b_eggplant>;

  res.movers[b_wheat][b_shroom] = merge<b_beer>;

  res.movers[b_berlin][b_metal ] = merge<b_car>;    // TODO: makes sense?
  res.movers[b_ball  ][b_outfit] = merge<b_brazil>;
  res.movers[b_car   ][b_brazil] = merge<b_senna>;

  // Easter Eggs
  res.movers[b_shorts][b_soup] = merge<b_easteregg>; // Stardew Valley
  res.movers[b_brick ][b_wall] = merge<b_music>;     // Pink Floyd
  res.movers[b_tool  ][b_wall] = merge<b_berlin>;    // Fall of Berlin Wall

  // TODO: static assertions
  // - exactly one rule resulting in a object
  // - never consume animals
  return res;
}();

static bool valid_pos(dotz::ivec2 p) {
  return p.x >= 0 && p.y >= 0 && p.x <= 15 && p.y <= 15;
}
static auto & arr(auto & arr, dotz::ivec2 p) { return arr[p.y][p.x]; }
static auto get_or(auto & arr, dotz::ivec2 p) {
  return valid_pos(p) ? ::arr(arr, p) : b_locked;
}

export namespace game {
  void init_meta() {
    for (auto & row : g_map)
      for (auto & col : row)
        col = b_locked;
  
    for (auto y = 3; y < 6; y++)
      for (auto x = 3; x < 6; x++)
        g_map[y][x] = b_empty;
  
    g_map[4][4] = b_sheep;
  
    g_unlocks[3][2] = b_straw;
    g_unlocks[4][2] = b_stick;
    g_unlocks[5][2] = b_brick;
  
    g_unlocks[3][6] = b_fan; // Aligned with "straw" as a "hint"
    g_unlocks[4][6] = b_wheat;
    g_unlocks[5][6] = b_garbage;
  
    g_unlocks[6][3] = b_thread;
    g_unlocks[6][4] = b_wool;
    g_unlocks[6][5] = b_store;
  
    g_unlocks[6][2] = b_music;
    g_unlocks[6][6] = b_easteregg;
  
    g_prizes[b_store]     = b_trash;
    g_prizes[b_brick]     = b_pig;
    g_prizes[b_easteregg] = b_chicken;
  }
  
  auto map(dotz::ivec2 p)    { return get_or(g_map,     p); }
  auto unlock(dotz::ivec2 p) { return get_or(g_unlocks, p); }
  
  void apply(block & f, block & t) {
    g_domain.movers[f][t](f, t);
  }
  void drop(dotz::ivec2 from, dotz::ivec2 to) {
    if (from == to) return;
    if (!valid_pos(from)) return;
    if (!valid_pos(to)) return;

    auto & f = arr(g_map, from);
    auto & t = arr(g_map, to);
    apply(f, t);
  }
  bool can_drag(block b) {
    switch (b) {
      case b_locked: return false;
      case b_empty:  return false;
      default:       return true;
    }
  }
  bool can_drop(dotz::ivec2 f, dotz::ivec2 p) {
    block from = map(f);
    block to = map(p);
    switch (to) {
      case b_locked: return g_unlocks[p.y][p.x] == from;
      case b_empty:  return true;
      default:       return g_domain.movers[from][to] != ignore;
    }
  }
}
