#pragma leco app
#pragma leco add_shader "poc.frag"
#pragma leco add_shader "poc.vert"
#pragma leco portrait
#pragma leco landscape

import casein;
import dotz;
import game;
import hai;
import traits;
import vee;
import voo;

// TODO: check if player is out of moves

using namespace traits::ints;

static constexpr const dotz::ivec2 nil { 10000 };

static struct upc {
  dotz::ivec2 selection = nil;
  dotz::ivec2 sel_idx {};
  dotz::ivec2 drag_origin = nil;
  dotz::vec2 drag_pos = nil;
  dotz::vec2 grid_scale {};
  dotz::vec2 grid_center {};
  float aspect;
} g_pc;

static hai::fn<void> g_redraw_map;

static bool can_drop(dotz::ivec2 p) {
  return game::can_drop(g_pc.drag_origin, p);
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
      auto blk = game::map(p);

      auto valid_target = g_pc.drag_origin == nil
        ? game::can_drag(blk)
        : (g_pc.drag_origin != p) && can_drop(p);

      ptr->r = blk;
      ptr->g = valid_target;
      ptr->b = game::unlock(p);
      if (blk != game::b_locked) {
        ptr->a = 255;
        continue;
      }
      auto a = 0;
      if (game::map(p - dotz::ivec2(1, 0)) != game::b_locked) a++;
      if (game::map(p + dotz::ivec2(1, 0)) != game::b_locked) a++;
      if (game::map(p - dotz::ivec2(0, 1)) != game::b_locked) a++;
      if (game::map(p + dotz::ivec2(0, 1)) != game::b_locked) a++;
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
  g_pc.sel_idx.x = game::map(g_pc.drag_origin);
}
static void drag_end() {
  if (g_pc.drag_origin != nil && g_pc.selection != nil && g_pc.drag_origin != g_pc.selection) {
    game::drop(g_pc.drag_origin, g_pc.selection);
  }
  g_pc.drag_origin = nil;
  g_pc.drag_pos = nil;
  g_redraw_map();
}

struct init {
  init() {
    using namespace casein;

    game::init_meta();

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
