#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 u_resolution;
uniform int u_maxIterations;
uniform float u_power;
uniform float u_bailout;

// Camera uniforms
uniform vec3 u_cameraPos;
uniform mat3 u_cameraRotation;
uniform float u_fov;

// Color palette
uniform vec3 u_palette[64];
uniform int u_paletteSize;
uniform float u_colorOffset;

// Lighting
uniform vec3 u_lightDir;
uniform float u_ambient;
uniform float u_diffuse;
uniform float u_specular;
uniform float u_shininess;

// Quality settings
uniform int u_maxSteps;      // Ray march steps
uniform int u_shadowSteps;   // Shadow ray steps (0 = disabled)
uniform int u_aoSamples;     // AO samples (0 = disabled)
uniform float u_stepScale;   // Step size multiplier (lower = more detail)

const float MIN_DIST = 0.00005;
const float MAX_DIST = 10.0;
const float DIST_SCALE = 0.0005; // Distance-adaptive threshold scale

// Mandelbulb distance estimator
vec2 mandelbulbDE(vec3 pos, float power) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    int iterations = 0;

    for (int i = 0; i < 1000; i++) {
        if (i >= u_maxIterations) break;

        r = length(z);
        if (r > u_bailout) break;

        // Convert to spherical coordinates
        float theta = acos(z.z / r);
        float phi = atan(z.y, z.x);

        // Scale the derivative
        dr = pow(r, power - 1.0) * power * dr + 1.0;

        // Calculate z^power in spherical coordinates
        float zr = pow(r, power);
        theta = theta * power;
        phi = phi * power;

        // Convert back to cartesian
        z = zr * vec3(
            sin(theta) * cos(phi),
            sin(theta) * sin(phi),
            cos(theta)
        );
        z += pos;

        iterations++;
    }

    // Return distance estimate and iteration count
    float dist = 0.5 * log(r) * r / dr;
    return vec2(dist, float(iterations));
}

// Calculate normal using gradient
vec3 calcNormal(vec3 pos, float power) {
    vec2 e = vec2(0.0001, 0.0);
    return normalize(vec3(
        mandelbulbDE(pos + e.xyy, power).x - mandelbulbDE(pos - e.xyy, power).x,
        mandelbulbDE(pos + e.yxy, power).x - mandelbulbDE(pos - e.yxy, power).x,
        mandelbulbDE(pos + e.yyx, power).x - mandelbulbDE(pos - e.yyx, power).x
    ));
}

// Calculate normal with adaptive epsilon for better results at various distances
vec3 calcNormalAdaptive(vec3 pos, float power, float eps) {
    vec2 e = vec2(eps, 0.0);
    return normalize(vec3(
        mandelbulbDE(pos + e.xyy, power).x - mandelbulbDE(pos - e.xyy, power).x,
        mandelbulbDE(pos + e.yxy, power).x - mandelbulbDE(pos - e.yxy, power).x,
        mandelbulbDE(pos + e.yyx, power).x - mandelbulbDE(pos - e.yyx, power).x
    ));
}

// Soft shadow calculation
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    if (u_shadowSteps <= 0) return 1.0; // Shadows disabled
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 128; i++) {
        if (i >= u_shadowSteps || t >= maxt) break;
        float h = mandelbulbDE(ro + rd * t, u_power).x;
        if (h < 0.001) return 0.0;
        res = min(res, k * h / t);
        t += h;
    }
    return res;
}

// Ambient occlusion
float ambientOcclusion(vec3 pos, vec3 nor) {
    if (u_aoSamples <= 0) return 1.0; // AO disabled
    float occ = 0.0;
    float sca = 1.0;
    float maxSamples = float(u_aoSamples);
    for (int i = 0; i < 16; i++) {
        if (i >= u_aoSamples) break;
        float h = 0.01 + 0.12 * float(i) / (maxSamples - 1.0);
        float d = mandelbulbDE(pos + h * nor, u_power).x;
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

// Get color from palette
vec3 getColor(float t) {
    float palettePos = fract(t * 2.0 + u_colorOffset) * float(u_paletteSize - 1);
    int index = int(palettePos);
    float blend = fract(palettePos);
    vec3 color1 = u_palette[index];
    vec3 color2 = u_palette[min(index + 1, u_paletteSize - 1)];
    return mix(color1, color2, blend);
}

// Ray marching
vec4 rayMarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    float iterations = 0.0;

    for (int i = 0; i < 1024; i++) {
        if (i >= u_maxSteps) break;

        vec3 pos = ro + rd * t;
        vec2 result = mandelbulbDE(pos, u_power);
        float dist = result.x;
        iterations = result.y;

        // Distance-adaptive threshold - allows better precision at all distances
        float epsilon = max(MIN_DIST, t * DIST_SCALE);

        if (dist < epsilon) {
            // Hit the surface - use distance-scaled normal calculation
            float normalEps = max(0.00005, t * 0.0001);
            vec3 normal = calcNormalAdaptive(pos, u_power, normalEps);

            // Lighting calculation
            vec3 lightDir = normalize(u_lightDir);

            // Ambient
            float ao = ambientOcclusion(pos, normal);
            vec3 ambient = vec3(u_ambient) * ao;

            // Diffuse
            float diff = max(dot(normal, lightDir), 0.0);
            float shadow = softShadow(pos + normal * 0.01, lightDir, 0.01, 2.0, 16.0);
            vec3 diffuse = vec3(u_diffuse) * diff * shadow;

            // Specular
            vec3 viewDir = normalize(-rd);
            vec3 halfDir = normalize(lightDir + viewDir);
            float spec = pow(max(dot(normal, halfDir), 0.0), u_shininess);
            vec3 specular = vec3(u_specular) * spec * shadow;

            // Get base color from iterations - use fixed scaling to maintain color variety
            // regardless of maxIterations setting
            float colorT = fract(iterations * 0.04);
            vec3 baseColor = getColor(colorT);

            // Combine lighting with base color
            vec3 color = baseColor * (ambient + diffuse) + specular;

            // Add some rim lighting for extra depth
            float rim = 1.0 - max(dot(viewDir, normal), 0.0);
            rim = pow(rim, 3.0) * 0.3;
            color += baseColor * rim;

            return vec4(color, 1.0);
        }

        if (t > MAX_DIST) break;

        t += dist * u_stepScale;
    }

    // Background gradient
    float gradientT = 0.5 + 0.5 * rd.y;
    vec3 bgColor = mix(vec3(0.02, 0.02, 0.05), vec3(0.05, 0.05, 0.1), gradientT);
    return vec4(bgColor, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

    // Calculate ray direction based on FOV
    float fovRad = radians(u_fov);
    float tanHalfFov = tan(fovRad * 0.5);

    vec3 rd = normalize(vec3(uv * tanHalfFov, -1.0));
    rd = u_cameraRotation * rd;

    vec3 ro = u_cameraPos;

    vec4 color = rayMarch(ro, rd);

    // Gamma correction
    color.rgb = pow(color.rgb, vec3(0.4545));

    fragColor = color;
}
