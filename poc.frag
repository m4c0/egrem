#version 450

layout(location = 0) in vec2 frag_pos;

layout(location = 0) out vec4 frag_colour;

float sd_box(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sd_rnd_box(vec2 p, vec2 b, float r) {
  return sd_box(p, b) - r;
}

vec2 op_rep(vec2 p) {
  const float count = 9; // number of squares
  const float s = 1.0; // size of each square

  p = p * 5.0 + (count - 1) / 2.0;

  vec2 id = round(p / s);
  id = clamp(id, 0, count - 1);

  vec2 r = p - s * id;
  return r;
}

vec3 inigo_debug(float d) {
  // this is 2.0 / resolution.y in Shader Toy. Impacts wave length.
  const float px = 2.0 / 600.0;

  vec3 col = (d>0.0) ? vec3(0.9,0.6,0.3) : vec3(0.65,0.85,1.0);
  col *= 1.0 - exp2(-24.0*abs(d));
  col *= 0.8 + 0.2*cos(120.0*d);
  col = mix( col, vec3(1.0), 1.0-smoothstep(-px,px,abs(d)-0.005) );
  return pow(col, vec3(2.2));
}

void main() {
  vec2 p = frag_pos;

  float d = sd_rnd_box(op_rep(p), vec2(0.3), 0.1);

  vec3 c = inigo_debug(d);

  frag_colour = vec4(c, 1.0);
}
