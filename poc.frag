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

float smin(float a, float b, float k) {
  return -k * log2(exp2(-a / k) + exp2(-b / k));
}

vec3 c_border(vec2 p, vec3 c, float d) {
  return mix(vec3(0), c, smoothstep(0, 0.02, abs(d)));
}

float hash(vec2 p) {
  return fract(cos(dot(p, vec2(91.52, -74.27))) * 939.24);
}
float noise_plane(vec2 p) {
  vec2 f = floor(p);
  vec2 s = p - f;
  vec4 m = (s * s * (3.0 - s - s)).xyxy;
  m = m * vec4(-1, -1, 1, 1) + vec4(1, 1, 0, 0);
  return 
    (hash(f + vec2(0, 0)) * m.x + hash(f + vec2(1, 0)) * m.z) * m.y +
    (hash(f + vec2(0, 1)) * m.x + hash(f + vec2(1, 1)) * m.z) * m.w;
}
float noise(vec2 p) {
  return
    0.6 * noise_plane(p *  8.0) +
    0.4 * noise_plane(p * 16.0) +
    0.3 * noise_plane(p * 32.0) +
    0.2 * noise_plane(p * 64.0);
}

vec3 sheep_body(vec2 p, vec3 c) {
  p.y *= -1;
  p.y += 0.05;
  float d = sd_cut_disk(p, 0.25, -0.15);
  c = mix(vec3(0.8, 0.7, 0.6), c, step(0, d));
  c = c_border(p, c, d);
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
  c = c_border(p, c, d);
  return c;
}

vec3 thr(vec2 p, vec3 c) {
  float d = sd_box(p, vec2(0.15, 0.25));
  c = mix(vec3(0.4, 0.3, 0.1), c, step(0, d));
  c = c_border(p, c, d);

  vec3 cc = vec3(1.0, 0.9, 0.8);
  float ss = sin(p.y * 314) * 0.3 + 0.7;
  d = sd_box(p, vec2(0.20, 0.13)) - 0.06;
  c = mix(cc * ss, c, step(0, d));
  c = c_border(p, c, d);
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
  c = c_border(p, c, d);
  return c;
}

vec3 outfit(vec2 p, vec3 c) {
  vec2 sp = p;
  sp.y -= 0.15;
  sp *= 1.4;
  float d = sd_shorts(sp);
  c = mix(vec3(0.1, 0.1, 0.3), c, step(0, d));
  c = c_border(p, c, d);

  d = sd_box(p + vec2(0, 0.1), vec2(0.15, 0.15));
  d = min(d, sd_box(p + vec2(0, 0.16), vec2(0.22, 0.09)));
  d = max(d, -sd_circle(p + vec2(0, 0.24), 0.07));
  c = mix(vec3(0.2, 0.6, 0.3), c, step(0, d));
  c = c_border(p, c, d);

  return c;
}

vec3 store(vec2 p, vec3 c) {
  float d;

  d = sd_box(p - vec2(0, 0.10), vec2(0.24, 0.15));
  c = mix(vec3(0.5, 0.3, 0.0), c, step(0, d));
  c = c_border(p, c, d);

  d = sd_box(p + vec2(0, 0.15), vec2(0.26, 0.1));
  float shd = sin(p.x * 200) * 0.3 + 0.7;
  c = mix(vec3(0.0, 0.05, 0.3) * shd, c, step(0, d));
  c = c_border(p, c, d);

  d = sd_box(p - vec2(-0.06, 0.13), vec2(0.1, 0.12));
  c = mix(vec3(0.3, 0.1, 0.0), c, step(0, d));
  c = c_border(p, c, d);

  return c;
}

vec3 piggy(vec2 p, vec3 c) {
  p.x = abs(p.x);
  p.y -= 0.04;

  float d;
  d = sd_rnd_box(p - vec2(0.15, -0.15), vec2(0.13, 0.1), vec4(0.1, 0.02, 0.1, 0.1));
  c = mix(vec3(0.9, 0.3, 0.2), c, step(0, d));
  c = c_border(p, c, d);

  d = sd_circle(p * vec2(1.0, 1.3), 0.25);
  c = mix(vec3(0.9, 0.3, 0.2), c, step(0, d));
  c = c_border(p, c, d);

  d = sd_circle(p * vec2(1.0, 1.3), 0.13);
  c = c_border(p, c, d);

  d = sd_box(p - vec2(0.05, 0.0), vec2(0.01, 0.0)) - 0.02;
  c = mix(vec3(0), c, step(0, d));
  return c;
}

vec3 shroom(vec2 p, vec3 c) {
  float d;
  d = sd_uneven_capsule(p + vec2(0.0, 0.05), 0.05, 0.10, 0.2);
  c = mix(vec3(0.9, 0.6, 0.4), c, step(0, d));
  c = c_border(p, c, d);

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
  c = c_border(p, c, d);

  d = sd_circle(p * vec2(1.0, 2.0), 0.3);
  c = mix(vec3(0.6, 0.8, 0.9), c, step(0, d));
  c = c_border(p, c, d);

  d = sd_circle(p * vec2(1.0, 2.0), 0.25);
  vec3 cc = vec3(0.7, 0.5, 0.3) * (sin(d * 60) * 0.1 + 0.9);
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
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
  c = c_border(p, c, d);

  d = sd_box(p - vec2(0, 0.05), vec2(0.1, 0.05));
  c = mix(vec3(0.7, 0.05, 0.0), c, step(0, d));
  c = c_border(p, c, d);

  return c;
}

vec3 stick(vec2 p, vec3 c) {
  float d = sd_segment(p, vec2(0.2, -0.2), vec2(-0.2, 0.2)) - 0.02;
  c = mix(vec3(0.5, 0.15, 0.0), c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 hat(vec2 p, vec3 c) {
  float d;
  d = sd_circle(p * vec2(1.0, 2.0), 0.3);
  c = mix(straw_colour, c, step(0, d));
  c = c_border(p, c, d);

  float d1 = sd_circle(p * vec2(1.0, 0.8), 0.15);
  p.y += 0.15;
  float d2 = sd_circle(p * vec2(1.0, 1.5), 0.3);
  d = max(d1, d2);
  
  vec3 cc = mix(straw_colour, vec3(0.5, 0.05, 0.0), step(-0.1, d2));
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 egg(vec2 p, vec3 c) {
  p.y *= -1;
  p.y += 0.03;

  float d = sd_egg(p, 0.2, 0.1);
  c = mix(vec3(0.7, 0.6, 0.5), c, step(0, d));
  c = c_border(p, c, d);
  return c;
}
vec3 easteregg(vec2 p, vec3 c) {
  float h = round(0.2 * sin(20 * p.x) + 6.0 + p.y * 9.0) / 9.0;
  vec3 cc = hsv2rgb(vec3(h, 0.9, 0.6));

  p.y *= -1;
  p.y += 0.03;

  float d = sd_egg(p, 0.2, 0.1);
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec2 op_rot(vec2 p, float r) {
  mat2 m = mat2(cos(r), -sin(r), sin(r), cos(r));
  return m * p;
}
vec3 basket(vec2 p, vec3 c) {
  p.y *= -1;

  vec2 pp = p - vec2(0, 0.05);

  float d;
  d = sd_egg(pp + vec2(0, -0.05), 0.1, 0.05);
  c = mix(vec3(0.6, 0.5, 0.4), c, step(0, d));
  c = c_border(p, c, d);

  d = sd_egg(op_rot(pp, -0.2) + vec2(-0.1, 0), 0.1, 0.05);
  c = mix(vec3(0.7, 0.55, 0.45), c, step(0, d));
  c = c_border(p, c, d);

  d = sd_egg(op_rot(pp, 0.2) + vec2(0.1, 0), 0.1, 0.05);
  c = mix(vec3(0.7, 0.6, 0.5), c, step(0, d));
  c = c_border(p, c, d);

  d = sd_trapezoid(p + vec2(0, 0.1), 0.15, 0.2, 0.1) - 0.05;
  c = mix(vec3(0.3, 0.1, 0.01), c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 eggplant(vec2 p, vec3 c) {
  p.y *= -1;

  float d0 = sd_circle(p - vec2(0.1), 0.10);
  float d1 = sd_circle(p + vec2(0.1), 0.15);
  const float k = 0.08;
  float d = -k * log2(exp2(-d0 / k) + exp2(-d1 / k));
  c = mix(vec3(0.2, 0.03, 0.1), c, step(0, d));
  c = c_border(p, c, d);

  d = sd_circle(p - vec2(0.12), 0.13);
  c = mix(vec3(0.03, 0.2, 0.05), c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

float brick_sdf(vec3 p) {
  const float tx = 1;
  const mat3 rx = mat3(
    cos(tx),  0, -sin(tx),
    0,        1, 0,
    sin(tx),  0, cos(tx)
  );
  const float ty = 0.5;
  const mat3 ry = mat3(
    1, 0,       0,
    0, cos(ty), -sin(ty),
    0, sin(ty), cos(ty)
  );
  const float tz = 1;
  const mat3 rz = mat3(
    cos(tz), -sin(tz), 0, 
    sin(tz), cos(tz),  0, 
    0,       0,        1
  );
  const mat3 rot = rz * ry * rx;
  return sd_box_3d(rot * p, vec3(0.1, 0.2, 0.3) * 0.8, 0.02);
}
vec3 brick_fn(vec2 p, vec3 c, vec3 amb_c, vec3 dif_c) {
  // raymarch
  float t = -1.0;
  float d = 10.0;
  for (int i = 0; i < 16; i++) {
    float h = brick_sdf(vec3(p, t));
    d = min(d, h);
    if (h < 0.001 || t > 1) break;
    t += h;
  }
  // normals - https://iquilezles.org/articles/normalsSDF
  const vec2 e = vec2(1.0, -1.0) * 0.5773; // 0.5773 ~= sqrt(3)/3
  const float eps = 0.0005;
  vec3 pos = vec3(p, t);
  vec3 nor = normalize(
    e.xyy * brick_sdf(pos + e.xyy * eps) + 
    e.yyx * brick_sdf(pos + e.yyx * eps) + 
    e.yxy * brick_sdf(pos + e.yxy * eps) + 
    e.xxx * brick_sdf(pos + e.xxx * eps));

  float dif = clamp(dot(-nor, vec3(0.5773)), 0.0, 1.0);
  float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));
  vec3 cc = amb_c * amb + dif_c * dif;

  cc *= noise(p) * 0.3 + 0.7;

  c = mix(vec3(0), c, smoothstep(0, 0.03, abs(d)));
  c = mix(cc, c, step(1, t));
  return c;
}
vec3 brick(vec2 p, vec3 c) {
  return brick_fn(p, c, vec3(0.3, 0.03, 0.02), vec3(0.8, 0.1, 0.07));
}
// We can't call it "metal" without making Apple sad
vec3 metal_bar(vec2 p, vec3 c) {
  return brick_fn(p, c, vec3(0.3, 0.3, 0.3), vec3(0.3, 0.3, 0.3));
}

vec3 wall(vec2 p, vec3 c) {
  vec2 b = p * vec2(8.0, 12.0) + vec2(0.0, 0.0);
  b.x += 0.5 * step(1.0, mod(b.y, 2));

  vec2 i = floor(b);
  float h = hash(i);
  h = smoothstep(0.2, 0.8, h) * 0.3 + 0.5;
  h = h * (noise(b) * 0.3 + 0.7);

  vec2 f = fract(b) - 0.5;
  float d = sd_box(f, vec2(0.5, 0.5));
  d = 1.0 - exp(-16.0 * abs(d));

  vec3 cc = vec3(0.6, 0.3, 0.1) * h * d;

  d = sd_box(p, vec2(0.25));
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 trash(vec2 p, vec3 c) {
  vec3 cc = vec3(0.3, 0.35, 0.4);
  float d = sd_box(p, vec2(0.2, 0.2)) - 0.05;
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);

  d = sd_box(p + vec2(0.0, 0.2), vec2(0.24, 0.02)) - 0.05;
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);

  d = sd_box(p - vec2(0.0, 0.05), vec2(0.01, 0.12)) - 0.03;
  c = c_border(p, c, d);

  p.x = abs(p.x);
  d = sd_box(p - vec2(0.15, 0.05), vec2(0.01, 0.12)) - 0.03;
  c = c_border(p, c, d);
  return c;
}

vec3 fan(vec2 p, vec3 c) {
  vec3 cc = vec3(0.9, 0.5, 0.4);

  float d;
  d = sd_iso_triangle(p, vec2(0.18, 0.28)) - 0.02;
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);

  d = sd_circle(p, 0.25);
  c = mix(vec3(1), c, step(0, d) * 0.4 + 0.6);
  c = c_border(p, c, d);

  d = sd_circle(p, 0.07);
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 fire_head(vec2 p, vec3 c) {
  p.y -= 0.02;
  p.y *= -1;
  p.x += sin(13 * p.y) * 0.05 + 0.0;
  float d;
  d = sd_egg(p, 0.16, 0.0);
  vec3 cc = vec3(
    1.0,
    smoothstep(0, -0.2, d),
    smoothstep(0, -0.5, d)
  );
  c = mix(cc, c, step(0, d));
  return c;
}
vec3 fire_base(vec2 p, vec3 c) {
  p.y -= 0.15;
  p = abs(p);
  float d = sd_segment(p, vec2(0.2, 0.1), vec2(-0.2, -0.1)) - 0.02;
  c = mix(vec3(0.5, 0.15, 0.0), c, step(0, d));
  c = c_border(p, c, d);
  return c;
}
vec3 fire(vec2 p, vec3 c) {
  c = fire_base(p, c);
  c = fire_head(p, c);
  return c;
}

vec3 music(vec2 p, vec3 c) {
  p -= vec2(-0.02, 0.03);

  float d;
  d = sd_circle(p + vec2(0.15, -0.15), 0.1);
  d = min(d, sd_segment(p + vec2(0.09, -0.15), vec2(0), vec2(0, -0.3)) - 0.04);
  d = min(d, sd_circle(p + vec2(-0.15, -0.05), 0.1));
  d = min(d, sd_segment(p + vec2(-0.21, -0.05), vec2(0), vec2(0, -0.3)) - 0.04);
  d = min(d, sd_segment(p + vec2(-0.21, -0.05), vec2(-0.02, -0.3), vec2(-0.28, -0.2)) - 0.06);

  c = mix(vec3(0.1, 0.7, 0.8), c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 garbage(vec2 p, vec3 c) {
  float rd = sd_box(p + vec2(0, 0.10), vec2(0.07, 0.03));

  float d;
  d = sd_rhombus(p + vec2(0, 0.2), vec2(0.2, 0.1));
  p.y *= -1.6;
  p.y += 0.15;
  p.x *= 1.8;
  d = min(d, sd_cut_disk(p, 0.25, -0.15) - 0.1);
  c = mix(vec3(0), c, step(0, d));

  c = mix(vec3(0.7, 0.05, 0.0), c, step(0, rd));
  c = c_border(p, c, rd);
  return c;
}

vec3 compost(vec2 p, vec3 c) {
  p.y += 0.2;
  float d = sd_pie(p, 0.25, 0.4);
  vec3 cc = vec3(0.1, 0.03, 0.01);
  cc *= noise(p * 4.0) * 0.7 + 0.3;
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 wheat(vec2 p, vec3 c) {
  float d, ad;

  ad = d = sd_box(p, vec2(0.02, 0.3));
  c = mix(vec3(0, 0.3, 0.05), c, step(0, d));

  p.x = abs(p.x);
  p.x -= 0.1;
  float id = clamp(p.y / 0.15, -1, 1);
  p.y -= 0.15 * round(id);
  d = sd_rnd_box(p, vec2(0.1, 0.05), vec4(0.05, 0, 0, 0.05));
  ad = min(d, ad);
  c = mix(vec3(0, 0.3, 0.05), c, step(0, d));

  c = c_border(p, c, ad);
  return c;
}

vec3 can(vec2 p, vec3 c) {
  p.x *= 0.5;

  float d;
  float dd = 10;

  d = sd_circle(p - vec2(0, 0.15), 0.1);
  d = min(d, sd_box(p - vec2(0, 0.05), vec2(0.1)));
  c = mix(vec3(0.8), c, step(0, d));
  dd = min(d, dd);

  d = sd_circle(p, 0.1);
  d = min(d, sd_box(p + vec2(0, 0.07), vec2(0.1, 0.08)));
  c = mix(vec3(0.7, 0.05, 0.05), c, smoothstep(-0.001, 0.001, d));
  dd = min(d, dd);
  c = c_border(p, c, dd * 2);

  d = sd_circle(p + vec2(0, 0.15), 0.1);
  c = mix(vec3(0.4), c, step(0, d));
  c = c_border(p, c, d * 2);

  p.x /= 0.5;
  d = sd_circle(p - vec2(0, 0.1), 0.04);
  c = mix(vec3(0.4, 0.4, 0.1), c, smoothstep(-0.001, 0.001, d));
  return c;
}

vec3 tool(vec2 p, vec3 c) {
  float sd = sd_segment(p, vec2(0.1, -0.1), vec2(-0.2, 0.2)) - 0.02;
  c = mix(vec3(0.5, 0.15, 0.0), c, step(0, sd));

  float hd = sd_oriented_box(p - vec2(0.1, -0.1), vec2(0.1), vec2(-0.1), 0.15);
  c = mix(vec3(0.3, 0.3, 0.3), c, step(0, hd));

  float d = min(hd, sd);

  c = c_border(p, c, d);
  return c;
}

vec3 iphone(vec2 p, vec3 c) {
  float d = sd_box(p, vec2(0.15, 0.3)) - 0.03;

  vec2 id = round(p / 0.1);
  id = clamp(id, -1, 1);
  vec2 pp = p - 0.1 * id;
  float dd = sd_box(pp, vec2(0.02)) - 0.01;
  float rid = noise(id + 1) + noise(p) * 0.3;
  vec3 cc = hsv2rgb(vec3(rid, 1.0, 0.4));
  cc = mix(cc, vec3(0), smoothstep(0, 0.005, dd));

  cc = mix(cc, vec3(0.05), step(0.2, p.y));
  cc = mix(vec3(0.05), cc, step(-0.2, p.y));

  c = mix(cc, c, step(0, d));

  c = c_border(p, c, d);
  return c;
}

float phone_ear(vec2 p) {
  p.x = abs(p.x);
  p -= vec2(0.15, -0.10);
  return sd_box(p, vec2(0.04, 0.03)) - 0.02;
}
float phone_base(vec2 p) {
  p.y -= 0.08;
  return sd_trapezoid(p, 0.1, 0.2, 0.1) - 0.03;
}
vec3 phone(vec2 p, vec3 c) {
  float d = sd_arc(p * -1, 0.9, 0.2) - 0.05;
  d = min(d, phone_ear(p));

  float d0 = max(-(d - 0.05), phone_base(p));
  d = min(d, d0);

  vec3 cc = vec3(0.2, 0.4, 0.1);
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 computer(vec2 p, vec3 c) {
  p.y += 0.07;

  vec3 cc;

  // TODO: add something to the display
  float d0 = sd_box(p, vec2(0.2, 0.13)) - 0.02;
  cc = mix(vec3(0), vec3(0.4), step(-0.03, d0));

  float d1 = sd_trapezoid(p - vec2(0, 0.25), 0.15, 0.2, 0.05) - 0.02;
  cc = mix(vec3(0.1), cc, step(-0.03, d1));

  float d = min(d0, d1);
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 berlin(vec2 p, vec3 c) {
  vec3 cc = vec3(0);
  cc = mix(cc, vec3(0.6, 0.0, 0.0), step(-0.2/3.0, p.y));
  cc = mix(cc, vec3(0.5, 0.3, 0.0), step(0.2/3.0, p.y));

  float d = sd_box(p, vec2(0.3, 0.2));
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}
vec3 brazil(vec2 p, vec3 c) {
  const vec3 g = pow(vec3(0, 0.58, 0.22), vec3(2.2));
  const vec3 y = pow(vec3(0.99, 0.86, 0), vec3(2.2));
  const vec3 b = pow(vec3(0.01, 0.13, 0.41), vec3(2.2));
  const vec3 w = vec3(1);

  vec2 pp = p;
  pp /= vec2(0.3, 0.2);
  pp = abs(pp);

  float dy = pp.x + pp.y;
  dy = smoothstep(1, 1.01, dy);

  float db = sd_circle(p, 0.1);

  float dw = sd_circle(p + vec2(0.05, -0.24), 0.27);
  dw = abs(dw) - 0.005;
  vec3 c0 = mix(w, b, smoothstep(0, 0.01, dw));

  vec3 cc = mix(y, g, dy);
  cc = mix(c0, cc, smoothstep(0, 0.01, db));

  float d = sd_box(p, vec2(0.3, 0.2));
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 chicken(vec2 p, vec3 c) {
  float dbd = sd_ellipse(p + vec2(0, -0.05), vec2(0.25, 0.18));
  float dhd = sd_circle(p + vec2(0.08, 0.1), 0.13);
  
  const float k = 0.015;
  float d = -k * log2(exp2(-dbd / k) + exp2(-dhd / k));
  c = mix(vec3(0.8, 0.6, 0.3), c, step(0, d));
  c = c_border(p, c, d);

  float dpk = sd_ellipse(p + vec2(0.08, 0.1), vec2(0.05, 0.02));
  c = mix(vec3(0.4, 0.3, 0.03), c, step(0, dpk));
  c = c_border(p, c, dpk);

  float dcb = sd_circle(p + vec2(0.08, 0.23), 0.05);
  c = mix(vec3(0.4, 0.05, 0.03), c, step(0, dcb));
  c = c_border(p, c, dcb);

  return c;
}

vec3 beer(vec2 p, vec3 c) {
  p.x -= 0.05;

  float di = sd_box(p + vec2(0, 0.1), vec2(0.12, 0.25));
  vec3 cc = mix(c, vec3(0.8), 0.3);
  vec3 ccc = mix(vec3(1.0), vec3(0.7, 0.6, 0.1), smoothstep(-0.1, -0.08, p.y)); 
  cc = mix(ccc, cc, smoothstep(-0.02, 0.02, di));

  float d = abs(sd_box(p + vec2(0.17, 0), vec2(0.1))) - 0.03;
  d = min(d, sd_box(p, vec2(0.12, 0.15)) - 0.05);
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 world(vec2 p, vec3 c) {
  float de = sd_circle(p, 0.25);

  float d = de;
  d = max(d, -sd_segment(p, vec2(-1, 0), vec2(1, 0)));
  d = max(d, -sd_segment(p, vec2(0, -1), vec2(0, 1)));

  float dc = sd_circle(abs(p) + vec2(0, -0.35), 0.25);
  dc = abs(dc);
  d = max(d, -dc);

  dc = sd_circle(abs(p) + vec2(0.275, 0), 0.4);
  dc = abs(dc);
  d = max(d, -dc);

  vec3 co = vec3(0.02, 0.07, 0.3);
  vec3 cl = vec3(0.02, 0.3, 0.07);
  float np = smoothstep(0.3, 0.6, noise(p * 0.2));
  vec3 cc = mix(co, cl, np);
  c = mix(cc, c, step(0, de));
  c = c_border(p, c, d);
  return c;
}

vec3 car(vec2 p, vec3 c) {
  vec3 cb = mix(c, vec3(1), 0.3);
  p.y -= 0.15;

  const float sc = 0.26;
  vec2 pc = p + vec2(0, 0.06);
  float dc = sd_circle(pc, sc);
  dc = max(dc, sd_box(pc - vec2(sc, 0), vec2(sc)));

  float d;
  p.x = abs(p.x);
  d = sd_circle(p - vec2(0.1, 0.0), 0.2);
  d = min(d, sd_circle(p + vec2(0, 0.15), 0.17));
  d = min(d, dc);
  d = max(d, sd_box(p + vec2(0, 0.2), vec2(1.0, 0.2)));

  float dt = sd_circle(p - vec2(0.14, 0.0), 0.08);
  d = max(d, -dt);
  c = mix(vec3(0.5), c, step(0, d));
  c = c_border(p, c, d);

  c = mix(vec3(0.0), c, smoothstep(-0.02, -0.01, dt));
  c = mix(vec3(0.5), c, smoothstep(-0.05, -0.04, dt));

  float dw = max(d, sd_box(pc + vec2(0, 0.2), vec2(1, 0.12)));
  c = mix(vec3(0.0), c, smoothstep(-0.05, -0.04, dw));
  c = mix(cb, c, smoothstep(-0.07, -0.06, dw));

  return c;
}

vec3 milk(vec2 p, vec3 c) {
  p.y -= 0.10;
  float d = sd_box(p, vec2(0.10, 0.13)) - 0.05;
  d = smin(d, sd_box(p + vec2(0, 0.24), vec2(0.07, 0.1)), 0.03);
  d = min(d, sd_box(p + vec2(0, 0.34), vec2(0.1, 0.03)));

  vec3 cc = vec3(0.0, 0.1, 0.4);
  cc = mix(cc, vec3(1), step(-0.28, p.y));
  cc = mix(cc, vec3(0), smoothstep(0, -0.3, p.x));
  cc = mix(cc, vec3(1), smoothstep(0, 0.4, p.x));
  c = mix(cc, c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec4 cow_ears(vec2 p, vec3 c) {
  p.y += 0.13;
  p.x = abs(p.x) - 0.25;
  float d = sd_ellipse(p, vec2(0.1, 0.06));
  c = mix(vec3(0), c, smoothstep(0, 0.01, d));
  return vec4(c, d);
}

vec3 cow(vec2 p, vec3 c) {
  p.y -= 0.03;

  vec4 ear = cow_ears(p, c);
  c = ear.rgb;
  float d = ear.a;

  float dm = sd_circle(abs(p - vec2(0, 0.02)) - vec2(0.27, 0), 0.21);
  vec3 cm = mix(vec3(0), vec3(0.75), smoothstep(0, 0.02, dm));

  float dh = sd_circle(p + vec2(0, 0.20), 0.1);
  float df = sd_trapezoid(p, 0.15, 0.1, 0.15) - 0.05;
  d = smin(d, df, 0.007);
  d = smin(d, dh, 0.04);
  c = mix(cm, c, step(0, d));
  c = c_border(p, c, d);

  d = sd_trapezoid(p - vec2(0, 0.15), 0.05, 0.08, 0.02) - 0.05;
  c = mix(vec3(0.9, 0.3, 0.3), c, step(0, d));
  c = c_border(p, c, d);
  return c;
}

vec3 locked(vec2 p, vec3 c) {
  p.x = p.x - 0.15 * round(p.x / 0.15);
  float d = sd_segment(p, vec2(0, -1), vec2(0, 1)) - 0.03;
  vec3 xc = vec3(1, 0, 0) * smoothstep(0, 0.03, abs(d));
  c = mix(xc, c, step(0, d) * 0.3 + 0.7);
  return c;
}
vec3 tbd(vec2 p, vec3 c) {
  return mix(vec3(1, 0, 1), c, step(0, sd_circle(p, 0.5)));
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
  else if (spr == 12) return easteregg(p, c);
  else if (spr == 13) return straw(p, c);
  else if (spr == 14) return stick(p, c);
  else if (spr == 15) return brick(p, c);
  else if (spr == 16) return fan(p, c);
  else if (spr == 17) return trash(p, c);
  else if (spr == 18) return fire(p, c);
  else if (spr == 19) return wall(p, c);
  else if (spr == 20) return music(p, c);
  else if (spr == 21) return garbage(p, c);
  else if (spr == 22) return compost(p, c);
  else if (spr == 23) return wheat(p, c);
  else if (spr == 24) return can(p, c);
  else if (spr == 25) return metal_bar(p, c);
  else if (spr == 26) return tool(p, c);
  else if (spr == 27) return berlin(p, c);
  else if (spr == 28) return computer(p, c);
  else if (spr == 29) return phone(p, c);
  else if (spr == 30) return iphone(p, c);
  else if (spr == 31) return world(p, c);
  else if (spr == 32) return chicken(p, c);
  else if (spr == 33) return egg(p, c);
  else if (spr == 34) return basket(p, c);
  else if (spr == 35) return eggplant(p, c);
  else if (spr == 36) return beer(p, c);
  else if (spr == 37) return cow(p, c);
  else if (spr == 38) return milk(p, c);
  else if (spr == 41) return car(p, c);
  else if (spr == 43) return brazil(p, c);
  else return tbd(p, c); // Should not happen
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
