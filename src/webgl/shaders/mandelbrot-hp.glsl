#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform vec2 u_resolution;
// High-precision bounds using double-single representation (high + low)
uniform vec2 u_boundsMinHi;  // High part of boundsMin
uniform vec2 u_boundsMinLo;  // Low part of boundsMin
uniform vec2 u_boundsMaxHi;  // High part of boundsMax
uniform vec2 u_boundsMaxLo;  // Low part of boundsMax
uniform int u_maxIterations;
uniform float u_colorOffset;
uniform vec3 u_palette[64];
uniform int u_paletteSize;
uniform int u_antiAlias;
uniform int u_debugMode; // 0 = normal, 1 = show lo component variation

// Double-single arithmetic operations
// A double-single number is represented as (hi, lo) where value = hi + lo

// Two-sum: computes s and error e such that a + b = s + e exactly
vec2 twoSum(float a, float b) {
    float s = a + b;
    float a1 = s - b;
    float b1 = s - a1;
    float da = a - a1;
    float db = b - b1;
    return vec2(s, da + db);
}

// Quick two-sum when |a| >= |b|
vec2 quickTwoSum(float a, float b) {
    float s = a + b;
    float e = b - (s - a);
    return vec2(s, e);
}

// Split a float into high and low parts for Dekker multiplication
void split(float a, out float hi, out float lo) {
    const float SPLIT_FACTOR = 4097.0; // 2^12 + 1
    float t = SPLIT_FACTOR * a;
    hi = t - (t - a);
    lo = a - hi;
}

// Two-product: computes p and error e such that a * b = p + e exactly
vec2 twoProduct(float a, float b) {
    float p = a * b;
    float a_hi, a_lo, b_hi, b_lo;
    split(a, a_hi, a_lo);
    split(b, b_hi, b_lo);
    float e = ((a_hi * b_hi - p) + a_hi * b_lo + a_lo * b_hi) + a_lo * b_lo;
    return vec2(p, e);
}

// Double-single addition
vec2 dsAdd(vec2 a, vec2 b) {
    vec2 s = twoSum(a.x, b.x);
    float t = a.y + b.y;
    t = t + s.y;
    s = quickTwoSum(s.x, t);
    return s;
}

// Double-single subtraction
vec2 dsSub(vec2 a, vec2 b) {
    return dsAdd(a, vec2(-b.x, -b.y));
}

// Double-single multiplication
vec2 dsMul(vec2 a, vec2 b) {
    vec2 p = twoProduct(a.x, b.x);
    float t = a.x * b.y + a.y * b.x;
    t = t + p.y;
    return quickTwoSum(p.x, t);
}

// Double-single squaring
vec2 dsSqr(vec2 a) {
    vec2 p = twoProduct(a.x, a.x);
    float t = 2.0 * a.x * a.y + p.y;
    return quickTwoSum(p.x, t);
}

// Create double-single from float
vec2 dsFromFloat(float a) {
    return vec2(a, 0.0);
}

// Convert double-single to float
float dsToFloat(vec2 a) {
    return a.x + a.y;
}

// Compare double-single with float
bool dsGreaterThan(vec2 a, float b) {
    return a.x > b || (a.x == b && a.y > 0.0);
}

vec3 getColor(float t) {
    if (t >= 1.0) {
        return vec3(0.0);
    }

    float palettePos = fract(t * 3.0 + u_colorOffset) * float(u_paletteSize - 1);
    int index = int(palettePos);
    float blend = fract(palettePos);

    vec3 color1 = u_palette[index];
    vec3 color2 = u_palette[min(index + 1, u_paletteSize - 1)];

    return mix(color1, color2, blend);
}

vec3 calculatePixel(vec2 crDS, vec2 ciDS) {
    // z = 0, c = input coordinate
    vec2 zrDS = vec2(0.0, 0.0);
    vec2 ziDS = vec2(0.0, 0.0);

    int iterations = 0;

    for (int i = 0; i < 10000; i++) {
        if (i >= u_maxIterations) break;

        // Compute z^2 components
        vec2 zr2 = dsSqr(zrDS);
        vec2 zi2 = dsSqr(ziDS);

        // Check escape: |z|^2 > 4
        vec2 mag2 = dsAdd(zr2, zi2);
        if (dsToFloat(mag2) > 4.0) break;

        // z = z^2 + c
        // zr_new = zr^2 - zi^2 + cr
        vec2 zr_new = dsAdd(dsSub(zr2, zi2), crDS);

        // zi_new = 2*zr*zi + ci
        vec2 zrzi = dsMul(zrDS, ziDS);
        vec2 two_zrzi = dsAdd(zrzi, zrzi);
        vec2 zi_new = dsAdd(two_zrzi, ciDS);

        zrDS = zr_new;
        ziDS = zi_new;
        iterations++;
    }

    if (iterations >= u_maxIterations) {
        return vec3(0.0);
    } else {
        // Smooth iteration count
        float zr = dsToFloat(zrDS);
        float zi = dsToFloat(ziDS);
        float mag2 = zr * zr + zi * zi;
        float smoothIter = float(iterations) + 1.0 - log(log(mag2) / 2.0) / log(2.0);
        float t = smoothIter / float(u_maxIterations);
        return getColor(t);
    }
}

void main() {
    vec3 color = vec3(0.0);

    // Compute range as double-single
    vec2 rangeR = dsSub(vec2(u_boundsMaxHi.x, u_boundsMaxLo.x), vec2(u_boundsMinHi.x, u_boundsMinLo.x));
    vec2 rangeI = dsSub(vec2(u_boundsMaxHi.y, u_boundsMaxLo.y), vec2(u_boundsMinHi.y, u_boundsMinLo.y));

    // Compute per-pixel delta (range / resolution)
    vec2 deltaR = dsMul(rangeR, dsFromFloat(1.0 / u_resolution.x));
    vec2 deltaI = dsMul(rangeI, dsFromFloat(1.0 / u_resolution.y));

    float aa = float(u_antiAlias);
    vec2 pixelCoord = gl_FragCoord.xy;

    // For debug mode, just compute center sample
    if (u_debugMode == 1) {
        float px = pixelCoord.x - 0.5 + 0.5;
        float py = pixelCoord.y - 0.5 + 0.5;

        vec2 offsetR = dsMul(deltaR, dsFromFloat(px));
        vec2 cR = dsAdd(vec2(u_boundsMinHi.x, u_boundsMinLo.x), offsetR);

        vec2 offsetI = dsMul(deltaI, dsFromFloat(py));
        vec2 cI = dsSub(vec2(u_boundsMaxHi.y, u_boundsMaxLo.y), offsetI);

        // Visualize the lo components - scale them up significantly
        // If working correctly, this should show smooth gradients, not solid blocks
        float loR = cR.y * 1.0e8;  // Scale up for visibility
        float loI = cI.y * 1.0e8;

        // Use fract to wrap values and create visible patterns
        float r = fract(loR * 100.0);
        float g = fract(loI * 100.0);
        float b = fract((loR + loI) * 50.0);

        fragColor = vec4(r, g, b, 1.0);
        return;
    }

    for (int j = 0; j < 4; j++) {
        if (j >= u_antiAlias) break;
        for (int i = 0; i < 4; i++) {
            if (i >= u_antiAlias) break;

            // Sub-pixel offset (0 to 1 within pixel)
            vec2 subOffset = (vec2(float(i), float(j)) + 0.5) / aa;

            // Pixel position with sub-pixel offset
            float px = pixelCoord.x - 0.5 + subOffset.x;
            float py = pixelCoord.y - 0.5 + subOffset.y;

            // Compute c = boundsMin + pixel * delta using double-single
            // This accumulates the position more accurately

            // Real: boundsMin.x + px * deltaR
            vec2 offsetR = dsMul(deltaR, dsFromFloat(px));
            vec2 cR = dsAdd(vec2(u_boundsMinHi.x, u_boundsMinLo.x), offsetR);

            // Imaginary: boundsMax.y - py * deltaI (flip Y for screen coords)
            vec2 offsetI = dsMul(deltaI, dsFromFloat(py));
            vec2 cI = dsSub(vec2(u_boundsMaxHi.y, u_boundsMaxLo.y), offsetI);

            color += calculatePixel(cR, cI);
        }
    }

    color /= aa * aa;
    fragColor = vec4(color, 1.0);
}
