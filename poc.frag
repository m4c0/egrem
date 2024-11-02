#version 450
#extension GL_GOOGLE_include_directive : require
#include "../glslinc/inigo.glsl"

layout(push_constant) uniform upc {
  vec2 drag_origin;
  vec2 drag_pos;
  vec2 selection;
  float aspect;
} pc;

layout(set = 0, binding = 0) uniform usampler2D u_map;

layout(location = 0) in vec2 frag_pos;
layout(location = 1) in vec2 mouse_pos;

layout(location = 0) out vec4 frag_colour;
layout(location = 1) out vec4 frag_id;

vec4 op_rep(vec2 p) {
  const float count = 9; // number of squares
  const float s = 1.0; // size of each square

  p = p * 5.0 + (count - 1) / 2.0;

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

vec4 grid(vec4 pp) {
  float r = eq(pp.zw, pc.drag_origin) ? 0.2 : 0.3;
  float d = sd_rnd_box(pp.xy, vec2(r), 0.1);

  uvec4 map = texture(u_map, pp.zw);

  bool sel = d < 0 && eq(pp.zw, pc.selection);
  vec3 c = sel ? vec3(1) : inigo_debug(d);
  return vec4(c, d < 0);
}

void main() {
  vec4 pp = op_rep(frag_pos);

  vec4 c = grid(pp);
  c.rgb = drag_cursor(c.rgb);

  frag_colour = vec4(c.rgb, 1.0);
  frag_id = vec4(pp.zw / 256.0, 0, c.a);
}
