#pragma leco tool
import dotz;
import game;
import print;

using namespace game;

// TODO: report terminals
// TODO: validate animals dont die
// TODO: check if two rules unlock the same item
int main() {
  init_meta();

  bool reachable[b_last] {};
  for (unsigned char y = 0; y < 16; y++) {
    for (unsigned char x = 0; x < 16; x++) {
      dotz::ivec2 p { x, y };
      reachable[map(p)] = true;
    }
  }

  // Brute-forcing just works
  putln("solve path:");
  for (auto k = 0; k < 1024; k++) {
    for (auto i = 0; i < b_last; i++) {
      if (!reachable[i]) continue;

      for (auto j = 0; j < b_last; j++) {
        if (!reachable[j]) continue;

        block a = static_cast<block>(i);
        block b = static_cast<block>(j);
        if (!can_drag(a)) continue;
        apply(a, b);
        if (!reachable[a]) {
          putln(i, '+', j, " ==> ", (int)a);
          reachable[a] = true;
        }
        if (!reachable[b]) {
          putln(i, '+', j, " ==> ", (int)b);
          reachable[b] = true;
        }
      }
    }
  }

  put("unreachable: ");
  for (auto i = 0; i < b_last; i++) {
    if (!reachable[i]) put(i, " ");
  }
  putln();
}

