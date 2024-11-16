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
  const float map_size = 16;
  const float s = 1.0; // size of each square

  p = p * pc.grid_scale + pc.grid_center;

  vec2 id = round(p / s);
  id = clamp(id, 0, map_size - 1);

  vec2 r = p - s * id;
  return vec4(r, id);
}

bool eq(vec2 a, vec2 b) { return length(abs(a - b)) < 0.01; }

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

float wool_circle(vec2 p) {
  p.x -= 0.1;
  return sd_circle(p, 0.18);
}
vec3 wool(vec2 p, vec3 c) {
  const float sp = 3.1415926535 * 2.0 / 3.0;
  float an = atan(p.y, p.x);
  float id = floor(an / sp);
  float a1 = sp * (id + 0.0);
  float a2 = sp * (id + 1.0);
  vec2 r1 = mat2(cos(a1), -sin(a1), sin(a1), cos(a1)) * p;
  vec2 r2 = mat2(cos(a2), -sin(a2), sin(a2), cos(a2)) * p;

  float d = min(wool_circle(r1), wool_circle(r2));
  c = mix(vec3(1.0, 0.9, 0.8), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
  return c;
}

vec3 thr(vec2 p, vec3 c) {
  float d = sd_box(p, vec2(0.15, 0.25));
  c = mix(vec3(0.4, 0.3, 0.1), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  vec3 cc = vec3(1.0, 0.9, 0.8);
  float ss = sin(p.y * 314) * 0.3 + 0.7;
  d = sd_box(p, vec2(0.20, 0.13)) - 0.06;
  c = mix(cc * ss, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
  return c;
}

float sd_shorts(vec2 p) {
  p.x = -abs(p.x);
  p.y += 0.02;
  float d = sd_oriented_box(p, vec2(-0.15, 0.20), vec2(-0.05, -0.15), 0.25);
  d = min(d, sd_oriented_box(p, vec2(-0.17, -0.15), vec2(0.1, -0.15), 0.12));
  return d;
}

vec3 shorts(vec2 p, vec3 c) {
  float d = sd_shorts(p);

  float s = 0.1;
  vec2 r = p - s * round(p / s);
  float dd = sd_circle(r, 0.03);
  const vec3 bc = vec3(0.3, 0.1, 0.4);
  vec3 cc = mix(bc * 1.3, bc, step(0, dd));

  c = mix(cc, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
  return c;
}

vec3 outfit(vec2 p, vec3 c) {
  vec2 sp = p;
  sp.y -= 0.15;
  sp *= 1.4;
  float d = sd_shorts(sp);
  c = mix(vec3(0.1, 0.1, 0.3), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_box(p + vec2(0, 0.1), vec2(0.15, 0.15));
  d = min(d, sd_box(p + vec2(0, 0.16), vec2(0.22, 0.09)));
  d = max(d, -sd_circle(p + vec2(0, 0.24), 0.07));
  c = mix(vec3(0.2, 0.6, 0.3), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  return c;
}

vec3 store(vec2 p, vec3 c) {
  float d;

  d = sd_box(p - vec2(0, 0.10), vec2(0.24, 0.15));
  c = mix(vec3(0.5, 0.3, 0.0), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_box(p + vec2(0, 0.15), vec2(0.26, 0.1));
  float shd = sin(p.x * 200) * 0.3 + 0.7;
  c = mix(vec3(0.0, 0.05, 0.3) * shd, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_box(p - vec2(-0.06, 0.13), vec2(0.1, 0.12));
  c = mix(vec3(0.3, 0.1, 0.0), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  return c;
}

vec3 piggy(vec2 p, vec3 c) {
  p.x = abs(p.x);
  p.y -= 0.04;

  float d;
  d = sd_rnd_box(p - vec2(0.15, -0.15), vec2(0.13, 0.1), vec4(0.1, 0.02, 0.1, 0.1));
  c = mix(vec3(0.9, 0.3, 0.2), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_circle(p * vec2(1.0, 1.3), 0.25);
  c = mix(vec3(0.9, 0.3, 0.2), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_circle(p * vec2(1.0, 1.3), 0.13);
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_box(p - vec2(0.05, 0.0), vec2(0.01, 0.0)) - 0.02;
  c = mix(vec3(0), c, step(0, d));
  return c;
}

vec3 shroom(vec2 p, vec3 c) {
  float d;
  d = sd_uneven_capsule(p + vec2(0.0, 0.05), 0.05, 0.10, 0.2);
  c = mix(vec3(0.9, 0.6, 0.4), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  p.x *= 0.5;
  d = sd_uneven_capsule(p + vec2(0.0, 0.2), 0.05, 0.10, 0.1);
  c = mix(vec3(0.5, 0.2, 0.1), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.01, abs(d)));
  return c;
}

vec3 soup(vec2 p, vec3 c) {
  p.y += 0.07;

  float d;
  d = sd_cut_disk(p, 0.3, 0.0);
  c = mix(vec3(0.6, 0.8, 0.9), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_circle(p * vec2(1.0, 2.0), 0.3);
  c = mix(vec3(0.6, 0.8, 0.9), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_circle(p * vec2(1.0, 2.0), 0.25);
  vec3 cc = vec3(0.7, 0.5, 0.3) * (sin(d * 60) * 0.1 + 0.9);
  c = mix(cc, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
  return c;
}

const vec3 straw_colour = vec3(0.6, 0.4, 0.1);

vec3 straw(vec2 p, vec3 c) {
  float d;
  p.y += 0.1;
  d = sd_iso_triangle(p, vec2(0.25, 0.3));
  p *= -1.0;
  p.y += 0.1;
  d = min(d, sd_iso_triangle(p, vec2(0.2, 0.2)));

  c = mix(straw_colour, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_box(p - vec2(0, 0.05), vec2(0.1, 0.05));
  c = mix(vec3(0.7, 0.05, 0.0), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  return c;
}

vec3 stick(vec2 p, vec3 c) {
  float d = sd_segment(p, vec2(0.2, -0.2), vec2(-0.2, 0.2)) - 0.02;
  c = mix(vec3(0.5, 0.15, 0.0), c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
  return c;
}

vec3 hat(vec2 p, vec3 c) {
  float d;
  d = sd_circle(p * vec2(1.0, 2.0), 0.3);
  c = mix(straw_colour, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  float d1 = sd_circle(p * vec2(1.0, 0.8), 0.15);
  p.y += 0.15;
  float d2 = sd_circle(p * vec2(1.0, 1.5), 0.3);
  d = max(d1, d2);
  
  vec3 cc = mix(straw_colour, vec3(0.5, 0.05, 0.0), step(-0.1, d2));
  c = mix(cc, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
  return c;
}

vec3 egg(vec2 p, vec3 c) {
  float h = round(0.2 * sin(20 * p.x) + 6.0 + p.y * 9.0) / 9.0;
  vec3 cc = hsv2rgb(vec3(h, 0.9, 0.6));

  p.y *= -1;
  p.y += 0.03;

  float d = sd_egg(p, 0.2, 0.1);
  c = mix(cc, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
  return c;
}

vec3 trash(vec2 p, vec3 c) {
  vec3 cc = vec3(0.3, 0.35, 0.4);
  float d = sd_box(p, vec2(0.2, 0.2)) - 0.05;
  c = mix(cc, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_box(p + vec2(0.0, 0.2), vec2(0.24, 0.02)) - 0.05;
  c = mix(cc, c, step(0, d));
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  d = sd_box(p - vec2(0.0, 0.05), vec2(0.01, 0.12)) - 0.03;
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));

  p.x = abs(p.x);
  d = sd_box(p - vec2(0.15, 0.05), vec2(0.01, 0.12)) - 0.03;
  c = mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
  return c;
}

vec3 locked(vec2 p, vec3 c) {
  float d = sd_rnd_x(p, 1.0, 0.05);
  vec3 xc = vec3(1, 0, 0) * smoothstep(0, 0.03, abs(d));
  c = mix(xc, c, step(0, d) * 0.3 + 0.7);
  return c;
}

vec3 non_locked_sprite(vec2 p, vec3 c, uint spr) {
  if (spr == 0) return c; // b_empty
  else if (spr == 1) return sheep(p, c);
  else if (spr == 2) return c; // b_locked
  else if (spr == 3) return wool(p, c);
  else if (spr == 4) return thr(p, c);
  else if (spr == 5) return hat(p, c);
  else if (spr == 6) return shorts(p, c);
  else if (spr == 7) return piggy(p, c);
  else if (spr == 8) return shroom(p, c);
  else if (spr == 9) return soup(p, c);
  else if (spr == 10) return outfit(p, c);
  else if (spr == 11) return store(p, c);
  else if (spr == 12) return egg(p, c);
  else if (spr == 13) return straw(p, c);
  else if (spr == 14) return stick(p, c);
  else if (spr == 17) return trash(p, c);
  else return vec3(1, 0, 1); // Should not happen
}

vec3 cell_sprite(vec2 p, vec3 c, uvec4 map) {
  if (map.r == 2) {
    c = mix(c, non_locked_sprite(p, c, map.b), 0.3);
    return locked(p, c);
  } else {
    return non_locked_sprite(p, c, map.r);
  }
}

vec3 drag_cursor(vec3 c) {
  uvec4 map = uvec4(pc.selection.z, 0, 0, 0);
  return cell_sprite(mouse_pos * 2.5, c, map);
}

vec4 cell_box(vec2 p, bool sel, bool drag_o, uvec4 map) {
  float sat = map.g == 0 ? 0.6 : 1.0;
  //map.g == 0 ? vec3(0.2, 0.2, 0.4) : vec3(0.15, 0.25, 0.4);
  vec3 inside = hsv2rgb(vec3(0.6, sat, 0.4));
  vec3 outside = vec3(0.1, 0.1, 0.3);  
  vec3 border = sel ? vec3(1) : vec3(0.7);
  float border_w = map.g == 0 ? 0.02 : 0.03;

  float d = sd_box(p, vec2(0.3)) - 0.1;

  vec3 c = cell_sprite(p, inside, map);
  c = mix(c, inside, drag_o ? 0.7 : 0.0);
  c = mix(c, outside, step(0, d));
  c = c * (1.0 - exp2(-50.0 * abs(d)));
  c = mix(border, c, smoothstep(0, border_w, abs(d)));
  c = mix(outside, c, map.a / 256.0);

  return vec4(c, d < 0 && map.g != 0);
}

vec4 grid(vec4 pp) {
  bool sel = eq(pp.zw, pc.selection.xy);
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
