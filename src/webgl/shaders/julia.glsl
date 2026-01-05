#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform vec2 u_boundsMin;
uniform vec2 u_boundsMax;
uniform int u_maxIterations;
uniform float u_colorOffset;
uniform vec2 u_juliaC;
uniform int u_equation;
uniform vec3 u_palette[64];
uniform int u_paletteSize;
uniform int u_antiAlias;  // AA samples per axis (1=off, 2=4x, 3=9x, 4=16x)

// Complex number operations
vec2 cMul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cDiv(vec2 a, vec2 b) {
    float denom = b.x * b.x + b.y * b.y;
    return vec2(
        (a.x * b.x + a.y * b.y) / denom,
        (a.y * b.x - a.x * b.y) / denom
    );
}

vec2 cExp(vec2 z) {
    float er = exp(z.x);
    return vec2(er * cos(z.y), er * sin(z.y));
}

vec2 cLog(vec2 z) {
    return vec2(log(length(z)), atan(z.y, z.x));
}

vec2 cPow(vec2 z, float n) {
    float r = length(z);
    float theta = atan(z.y, z.x);
    float rn = pow(r, n);
    return vec2(rn * cos(n * theta), rn * sin(n * theta));
}

vec2 cPowC(vec2 z, vec2 n) {
    // z^n = exp(n * log(z))
    return cExp(cMul(n, cLog(z)));
}

vec2 cSqrt(vec2 z) {
    float r = length(z);
    float theta = atan(z.y, z.x);
    float sr = sqrt(r);
    return vec2(sr * cos(theta * 0.5), sr * sin(theta * 0.5));
}

float cosh_f(float x) {
    return (exp(x) + exp(-x)) * 0.5;
}

float sinh_f(float x) {
    return (exp(x) - exp(-x)) * 0.5;
}

vec2 cSin(vec2 z) {
    return vec2(sin(z.x) * cosh_f(z.y), cos(z.x) * sinh_f(z.y));
}

vec2 cCos(vec2 z) {
    return vec2(cos(z.x) * cosh_f(z.y), -sin(z.x) * sinh_f(z.y));
}

vec2 cTan(vec2 z) {
    return cDiv(cSin(z), cCos(z));
}

// Equation functions
vec2 eq1(vec2 z, vec2 c) { return cMul(z, z) + c; }
vec2 eq2(vec2 z, vec2 c) { return cMul(cMul(z, z), z) + c; }
vec2 eq3(vec2 z, vec2 c) { return cMul(cMul(cMul(z, z), z), z) + c; }
vec2 eq4(vec2 z, vec2 c) { return cMul(cMul(cMul(cMul(z, z), z), z), z) + c; }
vec2 eq5(vec2 z, vec2 c) { return cDiv(cMul(z, z) + c, z - c); }
vec2 eq6(vec2 z, vec2 c) { return cMul(z, z) - (z + c); }
vec2 eq7(vec2 z, vec2 c) { return cMul(cMul(z, z), z) - cMul(z, z) + z + c; }
vec2 eq8(vec2 z, vec2 c) { return cMul(vec2(1.0, 0.0) + c, z) - cMul(c, cMul(z, z)); }
vec2 eq9(vec2 z, vec2 c) { return cDiv(cMul(cMul(z, z), z), vec2(1.0, 0.0) + cMul(c, cMul(z, z))); }
vec2 eq10(vec2 z, vec2 c) { return cMul(cMul(z - vec2(1.0, 0.0), z + vec2(0.5, 0.0)), cMul(z, z) - vec2(1.0, 0.0)) + c; }
vec2 eq11(vec2 z, vec2 c) { return cDiv(cMul(z, z) + vec2(1.0, 0.0) + c, cMul(z, z) - vec2(1.0, 0.0) - c); }
vec2 eq12(vec2 z, vec2 c) { return cPow(z, 1.5) + c; }
vec2 eq13(vec2 z, vec2 c) { return cExp(z) - c; }
vec2 eq14(vec2 z, vec2 c) { return cPow(z, 3.0) - vec2(0.5, 0.0) + cMul(c, cExp(-z)); }
vec2 eq15(vec2 z, vec2 c) { return cMul(c, z) - vec2(1.0, 0.0) + cMul(c, cExp(-z)); }
vec2 eq16(vec2 z, vec2 c) { return cDiv(4.0 * cPow(z, 5.0) + c, 5.0 * cPow(z, 4.0)); }
vec2 eq17(vec2 z, vec2 c) { return cPow(z, 5.0) - cMul(cMul(z, z), z) + z + c; }
vec2 eq18(vec2 z, vec2 c) { return cMul(cMul(z, z), z) + z + c; }
vec2 eq19(vec2 z, vec2 c) { return z * 2.0 * sin(z.x) + cMul(c, z) * cos(z.y) + c; }
vec2 eq20(vec2 z, vec2 c) { return cMul(z, cExp(-z)) + c; }
vec2 eq21(vec2 z, vec2 c) { return cMul(c, cExp(-z)) + cMul(z, z); }
vec2 eq22(vec2 z, vec2 c) { vec2 t = cMul(z, z) + c; return cMul(t, t) + z + c; }
vec2 eq23(vec2 z, vec2 c) { vec2 t = z + cSin(z); return cMul(t, t) + c; }
vec2 eq24(vec2 z, vec2 c) { return cMul(z, z) + cMul(cMul(c, c), c); }
vec2 eq25(vec2 z, vec2 c) { return cDiv(cMul(z, z) + c, cMul(z, z) - vec2(1.0, 0.0) - c); }
vec2 eq26(vec2 z, vec2 c) { return cMul(z, z) * cos(z.y) + cMul(c, z) * sin(z.x) + c; }
vec2 eq27(vec2 z, vec2 c) { return cMul(z, z) * cos(z.x) + cMul(c, z) * sin(z.y) + c; }
vec2 eq28(vec2 z, vec2 c) { float m = length(z); return cMul(z, z) * cos(m) + cMul(c, z) * sin(m) + c; }
vec2 eq29(vec2 z, vec2 c) { vec2 z2 = cMul(z, z); return cMul(cSin(z2), cTan(z2)) + c; }
vec2 eq30(vec2 z, vec2 c) { return cMul(c, cMul(z, z)) + cMul(z, cMul(c, c)); }
vec2 eq31(vec2 z, vec2 c) { return cExp(cSin(cMul(c, z))); }
vec2 eq32(vec2 z, vec2 c) { return cMul(c, cSin(z) + cCos(z)); }
vec2 eq33(vec2 z, vec2 c) { vec2 t = cMul(z, z) + c; return cDiv(cMul(t, t), z - c); }
vec2 eq34(vec2 z, vec2 c) { return cMul(cMul(c, cSin(z) + cCos(z)), cPow(z, 3.0) + z + c); }
vec2 eq35(vec2 z, vec2 c) { return cMul(cMul(c, cExp(z)), cCos(cMul(c, z))); }
vec2 eq36(vec2 z, vec2 c) { return cMul(cMul(cMul(cMul(z, z), z) + z + c, c), cSin(z) + cCos(z)); }
vec2 eq37(vec2 z, vec2 c) { return vec2(1.0, 0.0) - cMul(z, z) + cDiv(cPow(z, 4.0), vec2(2.0, 0.0) + 4.0 * z) + c; }
vec2 eq38(vec2 z, vec2 c) { return cMul(z, z) + cPow(z, 1.5) + c; }
vec2 eq39(vec2 z, vec2 c) { return vec2(1.0, 0.0) - cMul(z, z) + cDiv(cPow(z, 5.0), vec2(2.0, 0.0) + 4.0 * z) + c; }
vec2 eq40(vec2 z, vec2 c) { return cMul(cMul(cMul(z, z), z), cExp(z)) + c; }
vec2 eq41(vec2 z, vec2 c) { vec2 t = z + cSin(z); return cMul(t, t) + cMul(c, cExp(-z)) + cMul(z, z) + c; }
vec2 eq42(vec2 z, vec2 c) { return cDiv(cMul(cMul(z, z), z), vec2(1.0, 0.0) + cMul(c, cMul(z, z))) + cExp(z) - c; }
vec2 eq43(vec2 z, vec2 c) { vec2 t = z + cSin(z); return cMul(t, t) + cMul(c, cExp(z)) + c; }
vec2 eq44(vec2 z, vec2 c) { return cDiv(cMul(cMul(z, z), z) + c, cMul(z, z)); }
vec2 eq45(vec2 z, vec2 c) { return cDiv(cMul(cMul(z, z), z) + c, z); }
vec2 eq46(vec2 z, vec2 c) { vec2 t = z - cSqrt(z); return cMul(t, t) + c; }
vec2 eq47(vec2 z, vec2 c) { vec2 t = z + c; return cMul(t, t) + t; }
vec2 eq48(vec2 z, vec2 c) { vec2 t = z + c; return cPow(t, 3.0) - cMul(t, t); }
vec2 eq49(vec2 z, vec2 c) { vec2 t = cMul(cMul(z, z), z) - cMul(z, z); return cMul(t, t) + c; }
vec2 eq50(vec2 z, vec2 c) { vec2 t = cMul(z, z) - z; return cMul(t, t) + c; }
vec2 eq51(vec2 z, vec2 c) { vec2 t = z - cSqrt(z); return cMul(t, t) + c; }
vec2 eq52(vec2 z, vec2 c) { vec2 t = cMul(z, z) + cSqrt(z); return cMul(t, t) + c; }
vec2 eq53(vec2 z, vec2 c) { vec2 ez = cExp(z); return cMul(cMul(z, z), ez) - cMul(z, ez) + c; }
vec2 eq54(vec2 z, vec2 c) { vec2 t = cExp(cMul(c, z)) + c; return cMul(t, t); }
vec2 eq55(vec2 z, vec2 c) { return cPow(z, 5.0) + cMul(c, cPow(z, 3.0)) + c; }
vec2 eq56(vec2 z, vec2 c) { return cExp(cMul(z, z) + c); }
vec2 eq57(vec2 z, vec2 c) { return cPow(z, 8.0) + c; }

vec2 applyEquation(vec2 z, vec2 c, int eq) {
    if (eq == 1) return eq1(z, c);
    if (eq == 2) return eq2(z, c);
    if (eq == 3) return eq3(z, c);
    if (eq == 4) return eq4(z, c);
    if (eq == 5) return eq5(z, c);
    if (eq == 6) return eq6(z, c);
    if (eq == 7) return eq7(z, c);
    if (eq == 8) return eq8(z, c);
    if (eq == 9) return eq9(z, c);
    if (eq == 10) return eq10(z, c);
    if (eq == 11) return eq11(z, c);
    if (eq == 12) return eq12(z, c);
    if (eq == 13) return eq13(z, c);
    if (eq == 14) return eq14(z, c);
    if (eq == 15) return eq15(z, c);
    if (eq == 16) return eq16(z, c);
    if (eq == 17) return eq17(z, c);
    if (eq == 18) return eq18(z, c);
    if (eq == 19) return eq19(z, c);
    if (eq == 20) return eq20(z, c);
    if (eq == 21) return eq21(z, c);
    if (eq == 22) return eq22(z, c);
    if (eq == 23) return eq23(z, c);
    if (eq == 24) return eq24(z, c);
    if (eq == 25) return eq25(z, c);
    if (eq == 26) return eq26(z, c);
    if (eq == 27) return eq27(z, c);
    if (eq == 28) return eq28(z, c);
    if (eq == 29) return eq29(z, c);
    if (eq == 30) return eq30(z, c);
    if (eq == 31) return eq31(z, c);
    if (eq == 32) return eq32(z, c);
    if (eq == 33) return eq33(z, c);
    if (eq == 34) return eq34(z, c);
    if (eq == 35) return eq35(z, c);
    if (eq == 36) return eq36(z, c);
    if (eq == 37) return eq37(z, c);
    if (eq == 38) return eq38(z, c);
    if (eq == 39) return eq39(z, c);
    if (eq == 40) return eq40(z, c);
    if (eq == 41) return eq41(z, c);
    if (eq == 42) return eq42(z, c);
    if (eq == 43) return eq43(z, c);
    if (eq == 44) return eq44(z, c);
    if (eq == 45) return eq45(z, c);
    if (eq == 46) return eq46(z, c);
    if (eq == 47) return eq47(z, c);
    if (eq == 48) return eq48(z, c);
    if (eq == 49) return eq49(z, c);
    if (eq == 50) return eq50(z, c);
    if (eq == 51) return eq51(z, c);
    if (eq == 52) return eq52(z, c);
    if (eq == 53) return eq53(z, c);
    if (eq == 54) return eq54(z, c);
    if (eq == 55) return eq55(z, c);
    if (eq == 56) return eq56(z, c);
    if (eq == 57) return eq57(z, c);
    return eq1(z, c);
}

vec3 getColor(float t) {
    if (t >= 1.0) {
        return vec3(0.0);
    }

    // Apply color offset and cycle through palette
    float palettePos = fract(t * 3.0 + u_colorOffset) * float(u_paletteSize - 1);
    int index = int(palettePos);
    float blend = fract(palettePos);

    // Smooth interpolation between palette colors
    vec3 color1 = u_palette[index];
    vec3 color2 = u_palette[min(index + 1, u_paletteSize - 1)];

    return mix(color1, color2, blend);
}

vec3 calculatePixel(vec2 z) {
    vec2 c = u_juliaC;
    int iterations = 0;

    for (int i = 0; i < 10000; i++) {
        if (i >= u_maxIterations) break;
        if (dot(z, z) > 4.0) break;

        z = applyEquation(z, c, u_equation);
        iterations++;
    }

    if (iterations >= u_maxIterations) {
        return vec3(0.0);
    } else {
        float smoothIter = float(iterations) + 1.0 - log(log(dot(z, z)) / 2.0) / log(2.0);
        float t = smoothIter / float(u_maxIterations);
        return getColor(t);
    }
}

void main() {
    vec3 color = vec3(0.0);

    // Anti-aliasing via supersampling
    float aa = float(u_antiAlias);
    vec2 pixelSize = (u_boundsMax - u_boundsMin) / u_resolution;

    for (int j = 0; j < 4; j++) {
        if (j >= u_antiAlias) break;
        for (int i = 0; i < 4; i++) {
            if (i >= u_antiAlias) break;

            // Offset within pixel for this sample
            vec2 offset = (vec2(float(i), float(j)) + 0.5) / aa - 0.5;
            vec2 sampleCoord = v_texCoord + offset * pixelSize / (u_boundsMax - u_boundsMin);
            vec2 z = mix(u_boundsMin, u_boundsMax, sampleCoord);

            color += calculatePixel(z);
        }
    }

    color /= aa * aa;
    fragColor = vec4(color, 1.0);
}
