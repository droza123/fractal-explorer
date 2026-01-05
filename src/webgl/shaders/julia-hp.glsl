#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform vec2 u_resolution;
// High-precision bounds using double-single representation (high + low)
uniform vec2 u_boundsMinHi;
uniform vec2 u_boundsMinLo;
uniform vec2 u_boundsMaxHi;
uniform vec2 u_boundsMaxLo;
uniform int u_maxIterations;
uniform float u_colorOffset;
uniform vec2 u_juliaC;  // Julia constant
uniform vec3 u_palette[64];
uniform int u_paletteSize;
uniform int u_antiAlias;

// Double-single arithmetic operations

vec2 twoSum(float a, float b) {
    float s = a + b;
    float a1 = s - b;
    float b1 = s - a1;
    float da = a - a1;
    float db = b - b1;
    return vec2(s, da + db);
}

vec2 quickTwoSum(float a, float b) {
    float s = a + b;
    float e = b - (s - a);
    return vec2(s, e);
}

void split(float a, out float hi, out float lo) {
    const float SPLIT_FACTOR = 4097.0;
    float t = SPLIT_FACTOR * a;
    hi = t - (t - a);
    lo = a - hi;
}

vec2 twoProduct(float a, float b) {
    float p = a * b;
    float a_hi, a_lo, b_hi, b_lo;
    split(a, a_hi, a_lo);
    split(b, b_hi, b_lo);
    float e = ((a_hi * b_hi - p) + a_hi * b_lo + a_lo * b_hi) + a_lo * b_lo;
    return vec2(p, e);
}

vec2 dsAdd(vec2 a, vec2 b) {
    vec2 s = twoSum(a.x, b.x);
    float t = a.y + b.y;
    t = t + s.y;
    s = quickTwoSum(s.x, t);
    return s;
}

vec2 dsSub(vec2 a, vec2 b) {
    return dsAdd(a, vec2(-b.x, -b.y));
}

vec2 dsMul(vec2 a, vec2 b) {
    vec2 p = twoProduct(a.x, b.x);
    float t = a.x * b.y + a.y * b.x;
    t = t + p.y;
    return quickTwoSum(p.x, t);
}

vec2 dsSqr(vec2 a) {
    vec2 p = twoProduct(a.x, a.x);
    float t = 2.0 * a.x * a.y + p.y;
    return quickTwoSum(p.x, t);
}

vec2 dsFromFloat(float a) {
    return vec2(a, 0.0);
}

float dsToFloat(vec2 a) {
    return a.x + a.y;
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

vec3 calculatePixel(vec2 zrDS, vec2 ziDS) {
    // Julia constant as double-single
    vec2 crDS = dsFromFloat(u_juliaC.x);
    vec2 ciDS = dsFromFloat(u_juliaC.y);

    int iterations = 0;

    for (int i = 0; i < 10000; i++) {
        if (i >= u_maxIterations) break;

        vec2 zr2 = dsSqr(zrDS);
        vec2 zi2 = dsSqr(ziDS);

        vec2 mag2 = dsAdd(zr2, zi2);
        if (dsToFloat(mag2) > 4.0) break;

        vec2 zr_new = dsAdd(dsSub(zr2, zi2), crDS);

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

    // Compute per-pixel delta
    vec2 deltaR = dsMul(rangeR, dsFromFloat(1.0 / u_resolution.x));
    vec2 deltaI = dsMul(rangeI, dsFromFloat(1.0 / u_resolution.y));

    float aa = float(u_antiAlias);
    vec2 pixelCoord = gl_FragCoord.xy;

    for (int j = 0; j < 4; j++) {
        if (j >= u_antiAlias) break;
        for (int i = 0; i < 4; i++) {
            if (i >= u_antiAlias) break;

            vec2 subOffset = (vec2(float(i), float(j)) + 0.5) / aa;
            float px = pixelCoord.x - 0.5 + subOffset.x;
            float py = pixelCoord.y - 0.5 + subOffset.y;

            vec2 offsetR = dsMul(deltaR, dsFromFloat(px));
            vec2 zR = dsAdd(vec2(u_boundsMinHi.x, u_boundsMinLo.x), offsetR);

            vec2 offsetI = dsMul(deltaI, dsFromFloat(py));
            vec2 zI = dsSub(vec2(u_boundsMaxHi.y, u_boundsMaxLo.y), offsetI);

            color += calculatePixel(zR, zI);
        }
    }

    color /= aa * aa;
    fragColor = vec4(color, 1.0);
}
