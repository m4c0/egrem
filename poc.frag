#version 450

layout(push_constant) uniform upc {
  vec2 drag_origin;
  vec2 drag_pos;
  vec2 selection;
  float aspect;
} pc;

layout(location = 0) in vec2 frag_pos;

layout(location = 0) out vec4 frag_colour;
layout(location = 1) out vec4 frag_id;

float sd_box(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sd_rnd_box(vec2 p, vec2 b, float r) {
  return sd_box(p, b) - r;
}

vec4 op_rep(vec2 p) {
  const float count = 9; // number of squares
  const float s = 1.0; // size of each square

  p = p * 5.0 + (count - 1) / 2.0;

  vec2 id = round(p / s);
  id = clamp(id, 0, count - 1);

  vec2 r = p - s * id;
  return vec4(r, id);
}

vec3 inigo_debug(float d) {
  // this is 2.0 / resolution.y in Shader Toy. Impacts line thickness.
  const float px = 2.0 / 600.0;

  vec3 col = (d>0.0) ? vec3(0.9,0.6,0.3) : vec3(0.65,0.85,1.0);
  col *= 1.0 - exp2(-24.0*abs(d));
  col *= 0.8 + 0.2*cos(120.0*d);
  col = mix( col, vec3(1.0), 1.0-smoothstep(-px,px,abs(d)-0.005) );
  return pow(col, vec3(2.2));
}

bool eq(vec2 a, vec2 b) { return length(abs(a - b)) < 0.01; }

void main() {
  vec2 aspect = vec2(pc.aspect, 1);
  vec2 p = frag_pos * aspect;
  vec2 mp = (frag_pos - pc.drag_pos) * aspect;

  vec4 pp = op_rep(p);
  float r = eq(pp.zw, pc.drag_origin) ? 0.2 : 0.3;
  float d = sd_rnd_box(pp.xy, vec2(r), 0.1);

  bool sel = d < 0 && eq(pp.zw, pc.selection);

  vec3 c = sel ? vec3(1) : inigo_debug(d);
  
  float dd = sd_rnd_box(mp, vec2(0.05), 0.025);
  c = mix(c, vec3(1, 0, 0), 1.0 - step(0, dd));

  frag_colour = vec4(c, 1.0);
  frag_id = vec4(pp.zw / 256.0, 0, d < 0);
}
