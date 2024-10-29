#pragma leco app
#pragma leco add_shader "poc.frag"
#pragma leco add_shader "poc.vert"

import casein;
import dotz;
import vee;
import voo;

struct upc {
  dotz::vec2 drag_origin { 255, 255 };
  dotz::vec2 selection { 255, 255 };
  float aspect;
};

struct thread : voo::casein_thread {
  void run() override {
    voo::device_and_queue dq { "poc" };
    auto pd = dq.physical_device();
    auto s = dq.surface();

    constexpr const auto fmt = vee::image_format_rgba_unorm;

    upc pc {};

    while (!interrupted()) {
      auto rp = vee::create_render_pass({{
        vee::create_colour_attachment(pd, s),
        vee::create_colour_attachment(fmt),
      }});
      voo::offscreen::colour_buffer cbuf { pd, voo::extent_of(pd, s), fmt };
      voo::offscreen::host_buffer hbuf { pd, { 1, 1 } };

      auto pl = vee::create_pipeline_layout({
        vee::vert_frag_push_constant_range<upc>()
      });
      voo::one_quad_render oqr { "poc", pd, *rp, *pl, {
        vee::colour_blend_classic(), vee::colour_blend_none()
      }};

      voo::swapchain_and_stuff sw { dq, *rp, {{ cbuf.image_view() }} };
      pc.aspect = sw.aspect();

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
          vee::cmd_push_vert_frag_constants(*scb, *pl, &pc);
          oqr.run(*scb, sw.extent());

          int mx = casein::mouse_pos.x * casein::screen_scale_factor;
          int my = casein::mouse_pos.y * casein::screen_scale_factor;
          cbuf.cmd_copy_to_host(*scb, { mx, my }, { 1, 1 }, hbuf.buffer());
        });

        auto mem = hbuf.map();
        auto pick = static_cast<unsigned char *>(*mem);
        if (pick[3]) pc.selection = { pick[0], pick[1] };
        else pc.selection = { 255, 255 };
      });
    }
  }
} t;

struct init {
  init() {
  }
} i;
