#pragma leco app

import casein;
import voo;

struct thread : voo::casein_thread {
  void run() override {
    voo::device_and_queue dq { "poc" };

    while (!interrupted()) {
      voo::swapchain_and_stuff sw { dq };

      extent_loop(dq.queue(), sw, [&] {
        sw.queue_one_time_submit(dq.queue(), [&](auto pcb) {
        });
      });
    }
  }
} t;

struct init {
  init() {
  }
} i;
