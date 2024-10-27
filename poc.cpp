#pragma leco app
#pragma leco add_shader "poc.frag"
#pragma leco add_shader "poc.vert"

import casein;
import vee;
import voo;

struct thread : voo::casein_thread {
  void run() override {
    voo::device_and_queue dq { "poc" };

    auto pl = vee::create_pipeline_layout();
    voo::one_quad_render oqr { "poc", &dq, *pl };

    while (!interrupted()) {
      voo::swapchain_and_stuff sw { dq };

      ots_loop(dq, sw, [&](auto cb) {
        oqr.run(cb, sw.extent());
      });
    }
  }
} t;

struct init {
  init() {
  }
} i;
