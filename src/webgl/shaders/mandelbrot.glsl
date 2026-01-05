#version 300 es
precision highp float;

in vec2 v_texCoord;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform vec2 u_boundsMin;
uniform vec2 u_boundsMax;
uniform int u_maxIterations;
uniform float u_colorOffset;
uniform vec3 u_palette[64];
uniform int u_paletteSize;
uniform int u_antiAlias;  // AA samples per axis (1=off, 2=4x, 3=9x, 4=16x)

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

vec3 calculatePixel(vec2 c) {
    vec2 z = vec2(0.0);
    int iterations = 0;

    for (int i = 0; i < 10000; i++) {
        if (i >= u_maxIterations) break;
        if (dot(z, z) > 4.0) break;

        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
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
            vec2 c = mix(u_boundsMin, u_boundsMax, sampleCoord);

            color += calculatePixel(c);
        }
    }

    color /= aa * aa;
    fragColor = vec4(color, 1.0);
}
