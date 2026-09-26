import { glslPalette } from './palette'

/**
 * Covers the screen with one triangle, so no vertex buffers are needed:
 * vertices 0, 1, 2 land at (-1,-1), (3,-1) and (-1,3).
 */
export const vertexShader = `#version 300 es
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`

const common = `precision highp float;
precision highp int;

uniform uint uSeed;

const float TAU = 6.28318530718;

// ---- Randomness -----------------------------------------------------------

uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

uint cellHash(ivec2 cell, uint layer) {
  return pcg(uint(cell.x) ^ pcg(uint(cell.y) ^ pcg(layer ^ uSeed)));
}

// Four independent numbers in [0, 1) for one grid cell of one layer.
vec4 cellRandom(ivec2 cell, uint layer) {
  uint a = cellHash(cell, layer);
  uint b = pcg(a);
  uint c = pcg(b);
  uint d = pcg(c);
  return vec4(uvec4(a, b, c, d)) / 4294967296.0;
}

// ---- Noise ----------------------------------------------------------------

vec2 gradient(ivec2 cell) {
  float angle = float(cellHash(cell, 0u)) / 4294967296.0 * TAU;
  return vec2(cos(angle), sin(angle));
}

// Gradient noise, roughly in [-0.7, 0.7].
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 c = ivec2(i);
  float a = dot(gradient(c), f);
  float b = dot(gradient(c + ivec2(1, 0)), f - vec2(1.0, 0.0));
  float d = dot(gradient(c + ivec2(0, 1)), f - vec2(0.0, 1.0));
  float e = dot(gradient(c + ivec2(1, 1)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(d, e, u.x), u.y);
}

// Each octave is turned and doubled, so the layers don't line up.
const mat2 OCTAVE = mat2(1.6, 1.2, -1.2, 1.6);

float fbm(vec2 p, int octaves) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    if (i == octaves) break;
    sum += amplitude * noise(p);
    p = OCTAVE * p + vec2(17.3, 9.1);
    amplitude *= 0.5;
  }
  return sum;
}

vec3 toSrgb(vec3 linear) {
  return mix(linear * 12.92, 1.055 * pow(linear, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, linear));
}
`

/**
 * Paints one tile of the background. Each pixel comes from nothing but where
 * it is on the page, so the tiles meet without seams. How it's built is in
 * docs/background.md § "How it's drawn".
 */
export const fragmentShader = `#version 300 es
${common}
uniform float uHeight; // The tile, in device pixels.
uniform float uRatio;  // Device pixels per pixel of the photo.
uniform vec2 uOrigin;  // The tile's top left on the page, in pixels of the photo.

out vec4 fragColor;

${glslPalette()}

// The streaks run from bottom left to top right, 38 degrees above level.
const vec2 ALONG = vec2(0.78801, -0.61566);
const vec2 ACROSS = vec2(0.61566, 0.78801);
// The size of the swirls. Sizes are in pixels of the photo, which
// featureScale() in render.ts turns into CSS pixels.
const float STREAK_LENGTH = 820.0;
const float STREAK_WIDTH = 300.0;
const float BAND_SPACING = 270.0;
// How far the warp bends the bands, in bands.
const float BEND = 1.6;
const float WARP = 1.8;
// Where the light comes from (top left), for the ridges' relief.
const vec2 LIGHT = vec2(-0.70711, -0.70711);

// ---- The swirls -----------------------------------------------------------

struct Swirl {
  float height; // 0 in a trough, 1 on the top of a ridge.
  float ridge;  // How near the spine of a band this is.
  float gold;   // How thick the gold is here.
};

Swirl swirl(vec2 m) {
  vec2 s = vec2(dot(m, ALONG), dot(m, ACROSS));
  vec2 f = s / vec2(STREAK_LENGTH, STREAK_WIDTH);
  // The warp is kept smooth; fine detail in it reads as marble, not paint.
  vec2 w1 = vec2(fbm(f, 3), fbm(f + vec2(5.2, 1.3), 3));
  vec2 w2 = vec2(fbm(f + WARP * w1 + vec2(1.7, 9.2), 3), fbm(f + WARP * w1 + vec2(8.3, 2.8), 3));

  // Parallel bands, bent by the warp into S-curves...
  float band = 0.5 + 0.5 * cos(TAU * (s.y / BAND_SPACING + BEND * w2.x));
  float ridge = pow(band, 2.2);
  // ...that come and go along their length.
  float presence = smoothstep(-0.22, 0.28, fbm(f * 0.7 + w2 + vec2(3.1, 7.7), 4));
  float lumps = 0.5 + fbm(f * 2.0 + 2.0 * w2, 5);
  float height = clamp(ridge * presence * 0.85 + 0.18 * lumps, 0.0, 1.0);

  // Gold only runs along the spines of some of the bands.
  float vein = smoothstep(-0.1, 0.25, fbm(f * 0.55 + 0.8 * w1 + vec2(11.0, 4.0), 3));
  float gold = smoothstep(0.15, 0.85, ridge) * presence * vein;
  return Swirl(height, ridge * presence, gold);
}

vec3 ground(float height) {
  vec3 colour = mix(TROUGH, BODY, smoothstep(0.0, 0.25, height));
  colour = mix(colour, LIT, smoothstep(0.4, 0.85, height) * 0.8);
  return mix(colour, RAISED, smoothstep(0.75, 1.0, height) * 0.7);
}

// ---- Stars ----------------------------------------------------------------

struct Star {
  float cover;      // How much of this pixel the star covers.
  float brightness; // 0 to 1, picked at random per star.
  float distance;   // From this pixel to the nearest star's centre.
};

// One star per grid cell, kept at random with probability 'keep'. Stars
// smaller than a pixel dim rather than shrink, so they don't shimmer.
Star stars(vec2 m, float cellSize, uint layer, float keep, float minRadius, float maxRadius, float pixel) {
  Star best = Star(0.0, 0.0, 1e6);
  ivec2 home = ivec2(floor(m / cellSize));
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      ivec2 cell = home + ivec2(x, y);
      vec4 random = cellRandom(cell, layer);
      if (random.x >= keep) continue;
      vec2 centre = (vec2(cell) + 0.5 + (random.yz - 0.5) * 0.9) * cellSize;
      float radius = mix(minRadius, maxRadius, random.w * random.w);
      float drawn = max(radius, 0.5 * pixel);
      float energy = min(1.0, (radius * radius) / (drawn * drawn));
      float d = distance(m, centre);
      float cover = clamp((drawn - d) / pixel + 0.5, 0.0, 1.0) * energy;
      best.distance = min(best.distance, d);
      if (cover > best.cover) {
        best.cover = cover;
        best.brightness = fract(random.y * 7.31 + random.z * 3.17);
      }
    }
  }
  return best;
}

void main() {
  // Where this is on the page, in pixels of the photo.
  vec2 m = uOrigin + vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y) / uRatio;
  // One device pixel, in the same units.
  float pixel = 1.0 / uRatio;

  Swirl here = swirl(m);
  vec3 colour = ground(here.height);

  // Relief: the side of a ridge facing the light catches a sheen and the
  // other side falls into shadow.
  float slope = (here.height - swirl(m + LIGHT * 8.0).height) * 3.5;
  colour = mix(colour, SHEEN, clamp(slope, 0.0, 1.0) * 0.4);
  colour = mix(colour, TROUGH, clamp(-slope, 0.0, 1.0) * 0.6);

  // A mottle on each CSS pixel under the dust, some lighter and more
  // saturated, some darker.
  float mottle = float(cellHash(ivec2(floor(m)), 7u)) / 4294967296.0 * 2.0 - 1.0;
  colour = mix(colour, GRAIN, max(mottle, 0.0) * (0.35 + 0.4 * here.height));
  colour = mix(colour, TROUGH, max(-mottle, 0.0) * 0.45);

  // Blue dust, thickest on the ridges.
  float dustKeep = mix(0.2, 0.9, here.height);
  Star fine = stars(m, 2.5, 1u, dustKeep, 0.35, 0.8, pixel);
  colour = mix(colour, mix(DUST_DIM, DUST_BRIGHT, fine.brightness * fine.brightness), fine.cover * (0.4 + 0.5 * here.height));
  Star coarse = stars(m + 1.5, 4.0, 2u, dustKeep * 0.7, 0.5, 1.1, pixel);
  colour = mix(colour, mix(DUST, DUST_BRIGHT, sqrt(coarse.brightness)), coarse.cover * (0.7 + 0.3 * here.height));

  // Gold: thicker, bigger and brighter towards the spine of a vein.
  float grow = 0.5 + 0.8 * here.gold;
  Star flakes = stars(m, 4.0, 3u, here.gold * 0.75, 0.6, 1.6 * grow, pixel);
  vec3 gold = mix(GOLD_DIM, mix(GOLD, GOLD_PALE, step(0.75, flakes.brightness)), sqrt(flakes.brightness));
  colour = mix(colour, gold, flakes.cover * (0.75 + 0.25 * here.gold));
  Star clumps = stars(m + 2.5, 7.0, 4u, here.gold * 0.55, 0.9, 2.6 * grow, pixel);
  colour = mix(colour, mix(GOLD_DIM, GOLD, sqrt(clumps.brightness)), clumps.cover * (0.8 + 0.2 * here.gold));

  // A few bright stars, each with a faint glow.
  Star bright = stars(m, 150.0, 5u, 0.12, 0.6, 1.3, pixel);
  colour = mix(colour, STAR, bright.cover);
  colour += STAR * 0.05 * exp(-bright.distance * bright.distance / 50.0);

  // A little noise stops the dark gradients banding.
  float dither = (float(cellHash(ivec2(gl_FragCoord.xy), 6u)) / 4294967296.0 - 0.5) / 255.0;
  fragColor = vec4(toSrgb(colour) + dither, 1.0);
}
`
