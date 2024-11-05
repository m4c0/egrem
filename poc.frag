#version 450
#extension GL_GOOGLE_include_directive : require
#include "poc.glsl"
#include "../glslinc/hsv2rgb.glsl"
#include "../glslinc/inigo.glsl"

layout(set = 0, binding = 0) uniform usampler2D u_map;

layout(location = 0) in vec2 frag_pos;
layout(location = 1) in vec2 mouse_pos;

layout(location = 0) out vec4 frag_colour;
layout(location = 1) out vec4 frag_id;

vec4 op_rep(vec2 p) {
  const float count = 9; // number of squares
  const float s = 1.0; // size of each square

  p = p * pc.scale + (count - 1) / 2.0;

  vec2 id = round(p / s);
  id = clamp(id, 0, count - 1);

  vec2 r = p - s * id;
  return vec4(r, id);
}

bool eq(vec2 a, vec2 b) { return length(abs(a - b)) < 0.01; }

vec3 drag_cursor(vec3 c) {
  float dd = sd_rnd_box(mouse_pos, vec2(0.05), 0.025);
  c = mix(c, vec3(1, 0, 0), 1.0 - step(0, dd));
  return c;
}

vec3 sheep_body(vec2 p, vec3 c) {
  p.y *= -1;
  p.y += 0.05;
  float d = sd_cut_disk(p, 0.25, -0.15);
  c = mix(vec3(0.8, 0.7, 0.6), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
  return c;
}
vec3 sheep_feet(vec2 p, vec3 c) {
  p.x = abs(p.x);
  p.x -= 0.15;
  p.y -= 0.22;
  float d = sd_circle(p, 0.06);
  return mix(vec3(0), c, step(0, d));
}
vec3 sheep_head(vec2 p, vec3 c) {
  float d = sd_tunnel(p, vec2(0.1, 0.1));
  return mix(vec3(0), c, step(0, d));
}
vec3 sheep_ears(vec2 p, vec3 c) {
  p.x = abs(p.x) - 0.14;
  p.y += 0.02;
  float d = sd_tunnel(p, vec2(0.03, 0.05));
  return mix(vec3(0), c, step(0, d));
}
vec3 sheep(vec2 p, vec3 c) {
  p.y += 0.03;
  c = sheep_feet(p, c);
  c = sheep_body(p, c);
  c = sheep_head(p, c);
  c = sheep_ears(p, c);
  return c;
}

vec3 cell_sprite(vec2 p, vec3 c, vec4 map) {
  if (map.r == 0) { // b_empty
  } else if (map.r == 1) { // b_sheep
    c = sheep(p, c);
  } else if (map.r == 2) { // b_lock
    float d = sd_rnd_x(p, 1.0, 0.05);
    // TODO: make this more colour-blindness-friendly
    c = mix(vec3(1, 0, 0), c, step(0, d) * 0.3 + 0.7);
  } else if (map.r == 3) { // b_square
    float d = sd_rnd_box(p, vec2(0.2), 0.05);
    c = mix(vec3(1, 0, 0), c, step(0, d));
  } else {
    c = vec3(1, 0, 1); // Should not happen
  }
  return c;
}

vec4 cell_box(vec2 p, bool sel, bool drag_o, uvec4 map) {
  float sat = map.g == 0 ? 0.6 : 1.0;
  //map.g == 0 ? vec3(0.2, 0.2, 0.4) : vec3(0.15, 0.25, 0.4);
  vec3 inside = hsv2rgb(vec3(0.6, sat, 0.4));
  vec3 outside = vec3(0.1, 0.1, 0.3);  
  vec3 border = sel ? vec3(1) : vec3(0.7);
  float border_w = map.g == 0 ? 0.02 : 0.03;

  float d = sd_rnd_box(p, vec2(0.3), 0.1);

  vec3 c = cell_sprite(p, inside, map);
  c = mix(c, inside, drag_o ? 0.7 : 0.0);
  c = mix(c, outside, step(0, d));
  c = c * (1.0 - exp2(-50.0 * abs(d)));
  c = mix(border, c, smoothstep(0, border_w, abs(d)));

  return vec4(c, d < 0 && map.g != 0);
}

vec4 grid(vec4 pp) {
  bool sel = eq(pp.zw, pc.selection);
  bool drag_origin = eq(pp.zw, pc.drag_origin);

  float scale = sel ? 0.9 : drag_origin ? 1.2 : 1.0;

  uvec4 map = texture(u_map, pp.zw / 16.0);

  vec4 c = cell_box(scale * pp.xy, sel, drag_origin, map);
  return c;
}

void main() {
  vec4 pp = op_rep(frag_pos);

  vec4 c = grid(pp);
  c.rgb = drag_cursor(c.rgb);

  frag_colour = vec4(c.rgb, 1.0);
  frag_id = vec4(pp.zw / 256.0, 0, c.a);
}
