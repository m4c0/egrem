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

void main() {
  vec2 p = frag_pos;

  p = p * 5.0;
  p = p - round(p);
  float d = sd_rnd_box(p, vec2(0.3), 0.1);
  d = 1 - step(0, d);
  
  frag_colour = vec4(d, 0.2, 0.3, 1.0);
}
