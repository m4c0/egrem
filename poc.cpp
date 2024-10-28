#pragma leco app
#pragma leco add_shader "poc.frag"
#pragma leco add_shader "poc.vert"

import casein;
import vee;
import voo;

struct upc {
  float aspect;
};

struct thread : voo::casein_thread {
  void run() override {
    voo::device_and_queue dq { "poc" };

    auto pl = vee::create_pipeline_layout({
      vee::vert_frag_push_constant_range<upc>()
    });
    voo::one_quad_render oqr { "poc", &dq, *pl };

    upc pc {};

    while (!interrupted()) {
      voo::swapchain_and_stuff sw { dq };
      pc.aspect = sw.aspect();

      ots_loop(dq, sw, [&](auto cb) {
        vee::cmd_push_vert_frag_constants(cb, *pl, &pc);
        oqr.run(cb, sw.extent());
      });
    }
  }
} t;

struct init {
  init() {
  }
} i;
