#pragma leco app
#pragma leco add_shader "poc.frag"
#pragma leco add_shader "poc.vert"
#pragma leco portrait
#pragma leco landscape

import audio;
import casein;
import dotz;
import game;
import hai;
import traits;
import vapp;
import vee;
import voo;
import wagen;

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

struct thread : vapp {
  void run() override;
} t;

void thread::run() {
  main_loop("poc", [this](auto & dq) {
    auto pd = dq.physical_device();
    auto s = dq.surface();

    constexpr const auto fmt = VK_FORMAT_R8G8B8A8_UNORM;

    while (!interrupted()) {
      auto rp = vee::create_render_pass({
        .attachments {{
          vee::create_colour_attachment(pd, s),
          vee::create_colour_attachment(fmt, vee::image_layout_color_attachment_optimal),
          vee::create_depth_attachment(),
        }},
        .subpasses {{
          vee::create_subpass({
            .colours {{
              vee::create_attachment_ref(0, vee::image_layout_color_attachment_optimal),
              vee::create_attachment_ref(1, vee::image_layout_color_attachment_optimal),
            }},
            .depth_stencil = create_attachment_ref(2, vee::image_layout_depth_stencil_attachment_optimal),
          }),
        }},
        .dependencies {{
          vee::create_colour_dependency(),
          vee::create_depth_dependency(),
        }},
      });
      voo::offscreen::colour_buffer cbuf { pd, voo::extent_of(pd, s), fmt, VK_BUFFER_USAGE_TRANSFER_SRC_BIT };
      voo::offscreen::host_buffer hbuf { pd, { 1, 1 } };

      voo::updater<voo::h2l_image> grid { dq.queue(), update_grid, pd, 16U, 16U, VK_FORMAT_R8G8B8A8_UINT };
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
          voo::cmd_render_pass::build(vee::render_pass_begin {
            .command_buffer = *pcb,
            .render_pass = *rp,
            .framebuffer = sw.framebuffer(),
            .extent = sw.extent(),
            .clear_colours {
              vee::clear_colour(0, 0, 0, 0),
              vee::clear_colour(0, 0, 0, 0),
            },
          }, [&](auto cb) {;
            vee::cmd_push_vert_frag_constants(cb, *pl, &g_pc);
            vee::cmd_bind_descriptor_set(cb, *pl, 0, dset);
            vee::cmd_set_scissor(cb, sw.extent());
            vee::cmd_set_viewport(cb, sw.extent());
            oqr.run(cb);
          });

          vee::cmd_pipeline_barrier(*pcb, VK_PIPELINE_STAGE_BOTTOM_OF_PIPE_BIT, VK_PIPELINE_STAGE_HOST_BIT, {
            .srcAccessMask = VK_ACCESS_MEMORY_WRITE_BIT,
            .dstAccessMask = VK_ACCESS_HOST_READ_BIT,
            .oldLayout = VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL,
            .newLayout = VK_IMAGE_LAYOUT_TRANSFER_SRC_OPTIMAL,
            .image = cbuf.image(),
          });

          int mx = casein::mouse_pos.x * casein::screen_scale_factor;
          int my = casein::mouse_pos.y * casein::screen_scale_factor;
          cbuf.cmd_copy_to_host(*pcb, { mx, my }, { 1, 1 }, hbuf.buffer());
        });

        auto mem = hbuf.map();
        auto pick = static_cast<unsigned char *>(*mem);
        if (pick[3]) g_pc.selection = { pick[0], pick[1] };
        else g_pc.selection = nil;
      });
    }
  });
}

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
  // TODO: identify if that was a merge or a "cancel"
  // audio::merge();
  audio::drop();
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
      audio::take();
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
        audio::take();
      }
      drag_move();
    });
    handle(TOUCH_UP, drag_end);
    handle(TOUCH_CANCEL, drag_end);
#endif
  }
} i;
