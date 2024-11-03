#version 450
#extension GL_GOOGLE_include_directive : require
#include "poc.glsl"

layout(location = 0) in vec2 pos;

layout(location = 0) out vec2 frag_pos;
layout(location = 1) out vec2 mouse_pos;

void main() {
  vec2 p = pos * 2.0 - 1.0;
  gl_Position = vec4(p, 0, 1);

  vec2 aspect = vec2(pc.aspect, 1);
  if (aspect.x < 1.0) aspect = vec2(1.0, 1.0 / aspect);
  frag_pos = p * aspect;
  mouse_pos = (p - pc.drag_pos) * aspect;
}
 
