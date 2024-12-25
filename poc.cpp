#pragma leco app
#pragma leco add_shader "poc.frag"
#pragma leco add_shader "poc.vert"
#pragma leco portrait
#pragma leco landscape

import casein;
import dotz;
import hai;
import traits;
import vee;
import voo;

// TODO: check if player is out of moves

using namespace traits::ints;

static constexpr const dotz::ivec2 nil { 10000 };

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
  b_cow       = 37, // TODO
  b_milk      = 38, // TODO
  b_cheese    = 39, // TODO
};

struct upc {
  dotz::ivec2 selection = nil;
  dotz::ivec2 sel_idx {};
  dotz::ivec2 drag_origin = nil;
  dotz::vec2 drag_pos = nil;
  dotz::vec2 grid_scale {};
  dotz::vec2 grid_center {};
  float aspect;
} g_pc;

// TODO: reduce map to 9x9
static block g_map[16][16];
static block g_unlocks[16][16];
static block g_prizes[256] {};
static hai::fn<void> g_redraw_map;

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
  // - add ref to Ayrton Senna (car + brazil?)
  // - berin + ? = car?
  // - ball? (brazil = ball + outfit?)
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
  res.movers[b_fan  ][b_straw] = spawn<b_stick>;
  res.movers[b_stick][b_stick] = merge<b_fire>;
  res.movers[b_fire ][b_stick] = spawn<b_brick>;
  res.movers[b_brick][b_brick] = merge<b_wall>;

  res.movers[b_pig   ][b_empty ] = spawn<b_shroom>;
  res.movers[b_shroom][b_shroom] = merge<b_soup>;
  res.movers[b_soup  ][b_soup  ] = merge<b_can>;
  res.movers[b_can   ][b_can   ] = spawn<b_metal>;
  res.movers[b_metal ][b_stick ] = merge<b_tool>;

  res.movers[b_fire    ][b_wall ] = merge<b_computer>;
  res.movers[b_thread  ][b_can  ] = merge<b_phone>;
  res.movers[b_computer][b_phone] = merge<b_iphone>;

  res.movers[b_computer][b_computer] = merge<b_world>;

  res.movers[b_egg][b_wheat] = merge<b_eggplant>;

  res.movers[b_wheat][b_shroom] = merge<b_beer>;

  // Easter Eggs
  res.movers[b_shorts][b_soup] = merge<b_easteregg>; // Stardew Valley
  res.movers[b_brick ][b_wall] = merge<b_music>;     // Pink Floyd
  res.movers[b_tool  ][b_wall] = merge<b_berlin>;    // Fall of Berlin Wall

  // TODO: static assertions
  // - exactly one rule resulting in a object
  // - never consume animals
  return res;
}();

static void init_meta() {
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

static auto map(dotz::ivec2 p) { 
  if (p.x < 0 || p.y < 0 || p.x > 15 || p.y > 15) return b_locked;
  return g_map[p.y][p.x];
}

static void drop(block & from, block & to) {
  g_domain.movers[from][to](from, to);
}
static bool can_drag(block b) {
  switch (b) {
    case b_locked: return false;
    case b_empty:  return false;
    default:       return true;
  }
}
static bool can_drop(dotz::ivec2 p) {
  block from = map(g_pc.drag_origin);
  block to = map(p);
  switch (to) {
    case b_locked: return g_unlocks[p.y][p.x] == from;
    case b_empty:  return true;
    default:       return g_domain.movers[from][to] != ignore;
  }
}

static void update_grid(voo::h2l_image * img) {
  struct pix { unsigned char r, g, b, a; };

  dotz::ivec2 left { 16 };
  dotz::ivec2 right {};

  voo::mapmem mem { img->host_memory() };
  auto ptr = static_cast<pix *>(*mem);
  for (unsigned char y = 0; y < 16; y++) {
    for (unsigned char x = 0; x < 16; x++, ptr++) {
      dotz::ivec2 p { x, y };
      auto blk = g_map[y][x];

      auto valid_target = g_pc.drag_origin == nil
        ? can_drag(blk)
        : (g_pc.drag_origin != p) && can_drop(p);

      ptr->r = blk;
      ptr->g = valid_target;
      ptr->b = g_unlocks[y][x];
      if (blk != b_locked) {
        ptr->a = 255;
        continue;
      }
      auto a = 0;
      if (x > 0 && g_map[y][x - 1] != b_locked) a++;
      if (y > 0 && g_map[y - 1][x] != b_locked) a++;
      if (x < 15 && g_map[y][x + 1] != b_locked) a++;
      if (y < 15 && g_map[y + 1][x] != b_locked) a++;
      ptr->a = a > 0 ? 255 : 0;

      if (ptr->a > 0) {
        left = dotz::min(left, p);
        right = dotz::max(right, p + 1);
      }
    }
  }

  auto scale = (right - left + 1) / 2.0f;
  g_pc.grid_scale = dotz::vec2 { dotz::max(scale.x, scale.y) };
  g_pc.grid_center = (right + left) / 2.0f - 0.5f;
}

struct thread : voo::casein_thread {
  void run() override {
    voo::device_and_queue dq { "poc" };
    auto pd = dq.physical_device();
    auto s = dq.surface();

    constexpr const auto fmt = vee::image_format_rgba_unorm;

    while (!interrupted()) {
      auto rp = vee::create_render_pass({{
        vee::create_colour_attachment(pd, s),
        vee::create_colour_attachment(fmt),
      }});
      voo::offscreen::colour_buffer cbuf { pd, voo::extent_of(pd, s), fmt };
      voo::offscreen::host_buffer hbuf { pd, { 1, 1 } };

      voo::updater<voo::h2l_image> grid { dq.queue(), update_grid, pd, 16U, 16U, vee::image_format_rgba_uint };
      grid.run_once();
      g_redraw_map = [&] { grid.run_once(); };

      auto dsl = vee::create_descriptor_set_layout({ vee::dsl_fragment_sampler() });
      auto dp = vee::create_descriptor_pool(1, { vee::combined_image_sampler() });
      auto dset = vee::allocate_descriptor_set(*dp, *dsl);
      auto smp = vee::create_sampler(vee::nearest_sampler);
      vee::update_descriptor_set(dset, 0, grid.data().iv(), *smp);

      auto pl = vee::create_pipeline_layout(
        *dsl,
        vee::vert_frag_push_constant_range<upc>()
      );
      voo::one_quad_render oqr { "poc", pd, *rp, *pl, {
        vee::colour_blend_classic(), vee::colour_blend_none()
      }};

      voo::swapchain_and_stuff sw { dq, *rp, {{ cbuf.image_view() }} };
      g_pc.aspect = sw.aspect();

      extent_loop(dq.queue(), sw, [&] {
        sw.queue_one_time_submit(dq.queue(), [&](auto pcb) {
          voo::cmd_render_pass scb {vee::render_pass_begin {
            .command_buffer = *pcb,
            .render_pass = *rp,
            .framebuffer = sw.framebuffer(),
            .extent = sw.extent(),
            .clear_colours {
              vee::clear_colour(0, 0, 0, 0),
              vee::clear_colour(0, 0, 0, 0),
            },
          }};
          vee::cmd_push_vert_frag_constants(*scb, *pl, &g_pc);
          vee::cmd_bind_descriptor_set(*scb, *pl, 0, dset);
          oqr.run(*scb, sw.extent());

          int mx = casein::mouse_pos.x * casein::screen_scale_factor;
          int my = casein::mouse_pos.y * casein::screen_scale_factor;
          cbuf.cmd_copy_to_host(*scb, { mx, my }, { 1, 1 }, hbuf.buffer());
        });

        auto mem = hbuf.map();
        auto pick = static_cast<unsigned char *>(*mem);
        if (pick[3]) g_pc.selection = { pick[0], pick[1] };
        else g_pc.selection = nil;
      });
    }
  }
} t;

static void drag_move() {
  if (g_pc.drag_origin == nil) {
    g_pc.drag_pos = nil;
    return;
  }
  g_pc.drag_pos = (casein::mouse_pos / casein::window_size) * 2.0 - 1.0;
  g_pc.sel_idx.x = g_map[g_pc.drag_origin.y][g_pc.drag_origin.x];
}
static void drag_end() {
  if (g_pc.drag_origin != nil && g_pc.selection != nil && g_pc.drag_origin != g_pc.selection) {
    auto & o = g_map[g_pc.drag_origin.y][g_pc.drag_origin.x];
    auto & t = g_map[g_pc.selection.y][g_pc.selection.x];
    drop(o, t);
  }
  g_pc.drag_origin = nil;
  g_pc.drag_pos = nil;
  g_redraw_map();
}

struct init {
  init() {
    using namespace casein;

    init_meta();

#ifndef LECO_TARGET_IOS
    handle(MOUSE_DOWN, [] {
      g_pc.drag_origin = g_pc.selection;
      drag_move();
      g_redraw_map();
    });
    handle(MOUSE_MOVE, drag_move);
    handle(MOUSE_UP, drag_end);
#else
    static bool touch_started {};
    handle(TOUCH_DOWN, [] { touch_started = true; });
    handle(TOUCH_MOVE, [] {
      if (touch_started) {
        g_pc.drag_origin = g_pc.selection;
        touch_started = false;
        g_redraw_map();
      }
      drag_move();
    });
    handle(TOUCH_UP, drag_end);
    handle(TOUCH_CANCEL, drag_end);
#endif
  }
} i;
