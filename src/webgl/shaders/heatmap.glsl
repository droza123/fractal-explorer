#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform vec4 u_bounds; // minReal, maxReal, minImag, maxImag
uniform int u_maxIterations;
uniform float u_colorOffset;
uniform int u_equation;
uniform vec3 u_palette[64];
uniform int u_paletteSize;
uniform int u_antiAlias;  // AA samples per axis (1=off, 2=4x, 3=9x, 4=16x)

out vec4 fragColor;

// Sample points for Julia set evaluation (reduced for performance)
const int NUM_SAMPLES = 6;
const float SAMPLE_RADIUS = 1.5;

vec3 hsv2rgb(float h, float s, float v) {
    vec3 c = vec3(h, s, v);
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
}

// Complex number operations
vec2 cMul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cDiv(vec2 a, vec2 b) {
    float denom = dot(b, b);
    return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / denom;
}

float cosh_f(float x) {
    return (exp(x) + exp(-x)) * 0.5;
}

float sinh_f(float x) {
    return (exp(x) - exp(-x)) * 0.5;
}

vec2 cExp(vec2 z) {
    // Aggressively clamp to prevent GPU issues (exp(20) ≈ 485 million)
    float ex = exp(clamp(z.x, -20.0, 20.0));
    return ex * vec2(cos(z.y), sin(z.y));
}

vec2 cPow(vec2 z, float n) {
    float r = length(z);
    float theta = atan(z.y, z.x);
    float rn = pow(r, n);
    return vec2(rn * cos(n * theta), rn * sin(n * theta));
}

vec2 cSqrt(vec2 z) {
    return cPow(z, 0.5);
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

vec2 applyEquation(vec2 z, vec2 c, int eq) {
    vec2 one = vec2(1.0, 0.0);
    vec2 half_ = vec2(0.5, 0.0);
    vec2 two = vec2(2.0, 0.0);

    vec2 z2 = cMul(z, z);
    vec2 z3 = cMul(z2, z);
    vec2 z4 = cMul(z3, z);
    vec2 z5 = cMul(z4, z);

    if (eq == 1) return z2 + c;
    if (eq == 2) return z3 + c;
    if (eq == 3) return z4 + c;
    if (eq == 4) return z5 + c;
    if (eq == 5) return cDiv(z2 + c, z - c);
    if (eq == 6) return z2 - z - c;
    if (eq == 7) return z3 - z2 + z + c;
    if (eq == 8) return cMul(one + c, z) - cMul(c, z2);
    if (eq == 9) return cDiv(z3, one + cMul(c, z2));
    if (eq == 10) return cMul(cMul(z - one, z + half_), z2 - one) + c;
    if (eq == 11) return cDiv(z2 + one + c, z2 - one - c);
    if (eq == 12) return cPow(z, 1.5) + c;
    if (eq == 13) return cExp(z) - c;
    if (eq == 14) return cPow(z, 3.0) - half_ + cMul(c, cExp(-z));
    if (eq == 15) return cMul(c, z) - one + cMul(c, cExp(-z));
    if (eq == 16) return cDiv(4.0 * z5 + c, 5.0 * z4);
    if (eq == 17) return z5 - z3 + z + c;
    if (eq == 18) return z3 + z + c;
    if (eq == 19) return 2.0 * sin(z.x) * z + cos(z.y) * cMul(c, z) + c;
    if (eq == 20) return cMul(z, cExp(-z)) + c;
    if (eq == 21) return cMul(c, cExp(-z)) + z2;
    if (eq == 22) { vec2 t = z2 + c; return cMul(t, t) + z + c; }
    if (eq == 23) { vec2 t = z + cSin(z); return cMul(t, t) + c; }
    if (eq == 24) return z2 + cMul(cMul(c, c), c);
    if (eq == 25) return cDiv(z2 + c, z2 - one - c);
    if (eq == 26) return cos(z.y) * z2 + sin(z.x) * cMul(c, z) + c;
    if (eq == 27) return cos(z.x) * z2 + sin(z.y) * cMul(c, z) + c;
    if (eq == 28) { float m = length(z); return cos(m) * z2 + sin(m) * cMul(c, z) + c; }
    if (eq == 29) return cMul(cSin(z2), cTan(z2)) + c;
    if (eq == 30) return cMul(c, z2) + cMul(z, cMul(c, c));
    if (eq == 31) return cExp(cSin(cMul(c, z)));
    if (eq == 32) return cMul(c, cSin(z) + cCos(z));
    if (eq == 33) { vec2 t = z2 + c; return cDiv(cMul(t, t), z - c); }
    if (eq == 34) return cMul(cMul(c, cSin(z) + cCos(z)), z3 + z + c);
    if (eq == 35) return cMul(cMul(c, cExp(z)), cCos(cMul(c, z)));
    if (eq == 36) return cMul(cMul(z3 + z + c, c), cSin(z) + cCos(z));
    if (eq == 37) return one - z2 + cDiv(z4, two + 4.0 * z) + c;
    if (eq == 38) return z2 + cPow(z, 1.5) + c;
    if (eq == 39) return one - z2 + cDiv(z5, two + 4.0 * z) + c;
    if (eq == 40) return cMul(z3, cExp(z)) + c;
    if (eq == 41) { vec2 t = z + cSin(z); return cMul(t, t) + cMul(c, cExp(-z)) + z2 + c; }
    if (eq == 42) return cDiv(z3, one + cMul(c, z2)) + cExp(z) - c;
    if (eq == 43) { vec2 t = z + cSin(z); return cMul(t, t) + cMul(c, cExp(z)) + c; }
    if (eq == 44) return cDiv(z3 + c, z2);
    if (eq == 45) return cDiv(z3 + c, z);
    if (eq == 46) { vec2 t = z - cSqrt(z); return cMul(t, t) + c; }
    if (eq == 47) { vec2 t = z + c; return cMul(t, t) + t; }
    if (eq == 48) { vec2 t = z + c; return cPow(t, 3.0) - cMul(t, t); }
    if (eq == 49) { vec2 t = z3 - z2; return cMul(t, t) + c; }
    if (eq == 50) { vec2 t = z2 - z; return cMul(t, t) + c; }
    if (eq == 51) { vec2 t = z - cSqrt(z); return cMul(t, t) + c; }
    if (eq == 52) { vec2 t = z2 + cSqrt(z); return cMul(t, t) + c; }
    if (eq == 53) { vec2 ez = cExp(z); return cMul(z2, ez) - cMul(z, ez) + c; }
    if (eq == 54) { vec2 t = cExp(cMul(c, z)) + c; return cMul(t, t); }
    if (eq == 55) return z5 + cMul(c, z3) + c;
    if (eq == 56) return cExp(z2 + c);
    if (eq == 57) return cPow(z, 8.0) + c;

    return z2 + c;
}

// Compute escape time for Julia set at point z with constant c
int juliaEscapeTime(vec2 z, vec2 c, int maxIter) {
    for (int i = 0; i < 1000; i++) {
        if (i >= maxIter) break;
        float mag2 = dot(z, z);
        // Early bailout for large values (prevents GPU overflow)
        // Use larger threshold for exponential equations that grow fast
        if (mag2 > 1e6 || mag2 != mag2) return i; // NaN check: x != x is true for NaN
        if (mag2 > 4.0) return i;
        z = applyEquation(z, c, u_equation);
        // Check for overflow/NaN after equation application
        if (z.x != z.x || z.y != z.y || abs(z.x) > 1e10 || abs(z.y) > 1e10) return i;
    }
    return maxIter;
}

// Compute Mandelbrot escape time (for boundary detection)
int mandelbrotEscapeTime(vec2 c, int maxIter) {
    vec2 z = vec2(0.0);
    for (int i = 0; i < 1000; i++) {
        if (i >= maxIter) break;
        if (dot(z, z) > 4.0) return i;
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    }
    return maxIter;
}

// Check if equation uses exp() directly - very expensive
bool isExpBasedEquation() {
    return u_equation == 13 || u_equation == 14 || u_equation == 15 ||
           u_equation == 20 || u_equation == 21 || u_equation == 31 ||
           u_equation == 35 || u_equation == 40 || u_equation == 41 ||
           u_equation == 42 || u_equation == 43 || u_equation == 53 ||
           u_equation == 54 || u_equation == 56;
}

// Check if equation uses complex trig (cSin, cCos, cTan) which use exp internally
bool isComplexTrigEquation() {
    return u_equation == 23 || u_equation == 29 || u_equation == 32 ||
           u_equation == 34 || u_equation == 36;
}

// Check if equation uses scalar trig (cos, sin) - moderately expensive
bool isScalarTrigEquation() {
    return u_equation == 19 || u_equation == 26 || u_equation == 27 ||
           u_equation == 28;
}

// Get appropriate iteration limit based on equation complexity
int getMaxIterForEquation() {
    if (isExpBasedEquation() || isComplexTrigEquation()) {
        return min(u_maxIterations, 32);
    }
    if (isScalarTrigEquation()) {
        return min(u_maxIterations, 64);
    }
    return u_maxIterations;
}

// Compute "interestingness" of Julia set at point c
float computeJuliaInterestingness(vec2 c) {
    // Reduce iterations for expensive equations to prevent GPU context loss
    int maxIter = getMaxIterForEquation();
    int sampleIter = maxIter / 2;

    // First check if c is in/near the Mandelbrot set
    int mandelbrotIter = mandelbrotEscapeTime(c, maxIter);

    // Points deep inside or far outside the Mandelbrot set are less interesting
    float mandelbrotT = float(mandelbrotIter) / float(maxIter);

    // Sample multiple points in the Julia set
    float totalVariance = 0.0;
    float meanEscape = 0.0;
    float escapes[6]; // NUM_SAMPLES

    // Sample points in a circle
    for (int i = 0; i < NUM_SAMPLES; i++) {
        float angle = float(i) * 6.28318530718 / float(NUM_SAMPLES);
        vec2 samplePoint = vec2(cos(angle), sin(angle)) * SAMPLE_RADIUS;

        int escapeTime = juliaEscapeTime(samplePoint, c, sampleIter);
        float normalizedEscape = float(escapeTime) / float(sampleIter);
        escapes[i] = normalizedEscape;
        meanEscape += normalizedEscape;
    }
    meanEscape /= float(NUM_SAMPLES);

    // Compute variance of escape times
    for (int i = 0; i < NUM_SAMPLES; i++) {
        float diff = escapes[i] - meanEscape;
        totalVariance += diff * diff;
    }
    totalVariance /= float(NUM_SAMPLES);

    // Combine metrics:
    // - High variance = interesting (complex boundary)
    // - Near Mandelbrot boundary = interesting
    // - Mix of escaped and trapped points = interesting

    float boundaryProximity = 4.0 * mandelbrotT * (1.0 - mandelbrotT); // peaks at 0.5
    float complexity = sqrt(totalVariance) * 2.0;
    float mixedness = 4.0 * meanEscape * (1.0 - meanEscape); // peaks when half escape

    // Weight the factors
    float interestingness = boundaryProximity * 0.4 + complexity * 0.4 + mixedness * 0.2;

    return clamp(interestingness, 0.0, 1.0);
}

vec3 calculatePixel(vec2 c) {
    float interestingness = computeJuliaInterestingness(c);

    // Color mapping: use a heat map palette
    // Low interestingness = dark blue/purple
    // High interestingness = bright yellow/white

    float hue = 0.7 - interestingness * 0.7; // blue to red
    float saturation = 0.8 - interestingness * 0.3;
    float value = 0.2 + interestingness * 0.8;

    // Add color offset for variety
    hue = mod(hue + u_colorOffset, 1.0);

    vec3 color = hsv2rgb(hue, saturation, value);

    // Boost bright areas
    if (interestingness > 0.7) {
        color = mix(color, vec3(1.0, 1.0, 0.8), (interestingness - 0.7) / 0.3 * 0.5);
    }

    return color;
}

void main() {
    vec3 color = vec3(0.0);

    // Anti-aliasing via supersampling
    float aa = float(u_antiAlias);
    vec2 boundsSize = vec2(u_bounds.y - u_bounds.x, u_bounds.w - u_bounds.z);
    vec2 pixelSize = boundsSize / u_resolution;

    for (int j = 0; j < 4; j++) {
        if (j >= u_antiAlias) break;
        for (int i = 0; i < 4; i++) {
            if (i >= u_antiAlias) break;

            // Offset within pixel for this sample
            vec2 offset = (vec2(float(i), float(j)) + 0.5) / aa - 0.5;
            vec2 sampleUV = gl_FragCoord.xy / u_resolution + offset * pixelSize / boundsSize;

            float real = u_bounds.x + sampleUV.x * (u_bounds.y - u_bounds.x);
            float imag = u_bounds.z + sampleUV.y * (u_bounds.w - u_bounds.z);
            vec2 c = vec2(real, imag);

            color += calculatePixel(c);
        }
    }

    color /= aa * aa;
    fragColor = vec4(color, 1.0);
}
