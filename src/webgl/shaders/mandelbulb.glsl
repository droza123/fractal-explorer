#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 u_resolution;
uniform int u_maxIterations;
uniform float u_power;
uniform float u_bailout;

// Equation selection (1=Mandelbulb, 2=Mandelbox, 3=QuaternionJulia, 4=BurningShip3D, 5=Tricorn3D, 6=MengerSponge, 7=Sierpinski, 8=Kaleidoscopic, 9=OctahedronIFS, 10=IcosahedronIFS)
uniform int u_equation;

// Mandelbox / Kaleidoscopic IFS parameters
uniform float u_scale;
uniform float u_minRadius;

// Camera uniforms
uniform vec3 u_cameraPos;
uniform mat3 u_cameraRotation;
uniform float u_fov;

// Color palette
uniform vec3 u_palette[64];
uniform int u_paletteSize;
uniform float u_colorOffset;

// Color factor weights for enriched coloring
uniform float u_colorIterFactor;    // Iteration-based weight
uniform float u_colorPosFactor;     // Position-based weight
uniform float u_colorNormalFactor;  // Normal-based weight
uniform float u_colorRadialFactor;  // Radial distance-based weight

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

// ==========================================
// Distance Estimator Functions
// ==========================================

// 1. Mandelbulb - Classic triplex algebra in spherical coordinates
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

// 2. Mandelbox - Box-folding fractal with sphere inversion
vec2 mandelboxDE(vec3 pos, float scale) {
    // Scale down position so fractal fits at distance 4, FOV 90
    float boxScale = 3.0;
    vec3 scaledPos = pos * boxScale;

    vec3 z = scaledPos;
    vec3 c = scaledPos;  // Store original position for orbit trap
    float dr = boxScale;  // Account for initial scaling in derivative
    int iterations = 0;

    float fixedRadius = 1.0;
    float fixedRadius2 = fixedRadius * fixedRadius;
    float minRadius = u_minRadius;
    float minRadius2 = minRadius * minRadius;

    // Orbit trap for coloring - track minimum distance to origin
    float orbitTrap = 1e10;

    // Limit iterations to avoid excessive computation
    int maxIter = min(u_maxIterations, 50);

    for (int i = 0; i < 100; i++) {
        if (i >= maxIter) break;

        // Box fold: if component > 1, reflect about 1; if < -1, reflect about -1
        z = clamp(z, -1.0, 1.0) * 2.0 - z;

        // Sphere fold
        float r2 = dot(z, z);
        if (r2 < minRadius2) {
            // Linear inner scaling
            float temp = fixedRadius2 / minRadius2;
            z *= temp;
            dr *= temp;
        } else if (r2 < fixedRadius2) {
            // Sphere inversion
            float temp = fixedRadius2 / r2;
            z *= temp;
            dr *= temp;
        }

        // Scale and translate
        z = scale * z + c;
        dr = dr * abs(scale) + 1.0;

        // Update orbit trap - use multiple traps for richer coloring
        orbitTrap = min(orbitTrap, length(z));
        orbitTrap = min(orbitTrap, abs(z.x));
        orbitTrap = min(orbitTrap, abs(z.y));
        orbitTrap = min(orbitTrap, abs(z.z));

        iterations++;

        // Escape check - use larger bailout for stability
        if (dot(z, z) > 1000.0) break;
    }

    // Distance estimation with safety clamp
    float r = length(z);
    float dist = r / abs(dr);

    // Use orbit trap for coloring instead of just iterations
    // Scale orbitTrap to a reasonable range for color mapping
    float colorValue = orbitTrap * 5.0 + float(iterations) * 0.5;

    // Ensure we don't return negative or zero distances
    return vec2(max(dist, 0.0001), colorValue);
}

// Quaternion multiplication helper
vec4 qmul(vec4 a, vec4 b) {
    return vec4(
        a.x * b.x - a.y * b.y - a.z * b.z - a.w * b.w,
        a.x * b.y + a.y * b.x + a.z * b.w - a.w * b.z,
        a.x * b.z - a.y * b.w + a.z * b.x + a.w * b.y,
        a.x * b.w + a.y * b.z - a.z * b.y + a.w * b.x
    );
}

// Quaternion square
vec4 qsqr(vec4 q) {
    return vec4(
        q.x * q.x - q.y * q.y - q.z * q.z - q.w * q.w,
        2.0 * q.x * q.y,
        2.0 * q.x * q.z,
        2.0 * q.x * q.w
    );
}

// 3. Quaternion Julia - 4D Julia set sliced to 3D
vec2 quaternionJuliaDE(vec3 pos) {
    // Fixed interesting Julia constant in quaternion space
    vec4 c = vec4(-0.2, 0.6, 0.2, 0.2);
    vec4 z = vec4(pos, 0.0);
    float dz = 1.0;
    int iterations = 0;

    for (int i = 0; i < 1000; i++) {
        if (i >= u_maxIterations) break;

        // dz = 2 * z * dz
        dz = 2.0 * length(z) * dz;

        // z = z^2 + c
        z = qsqr(z) + c;

        float r = length(z);
        if (r > u_bailout) break;

        iterations++;
    }

    float r = length(z);
    float dist = 0.5 * log(r) * r / dz;
    return vec2(dist, float(iterations));
}

// 4. Burning Ship 3D - Absolute value before power
vec2 burningShip3DDE(vec3 pos, float power) {
    vec3 z = pos;
    float dr = 1.0;
    float r = 0.0;
    int iterations = 0;

    for (int i = 0; i < 1000; i++) {
        if (i >= u_maxIterations) break;

        // Take absolute value before computing power
        z = abs(z);

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

    float dist = 0.5 * log(r) * r / dr;
    return vec2(dist, float(iterations));
}

// 5. Tricorn 3D (Mandelbar) - Conjugate variant
vec2 tricorn3DDE(vec3 pos, float power) {
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

        // Calculate z^power with conjugate (negate phi)
        float zr = pow(r, power);
        theta = theta * power;
        phi = -phi * power;  // Conjugate: negate the angle

        // Convert back to cartesian
        z = zr * vec3(
            sin(theta) * cos(phi),
            sin(theta) * sin(phi),
            cos(theta)
        );
        z += pos;

        iterations++;
    }

    float dist = 0.5 * log(r) * r / dr;
    return vec2(dist, float(iterations));
}

// 6. Menger Sponge - Classic geometric IFS fractal
vec2 mengerSpongeDE(vec3 pos) {
    vec3 z = pos;
    float scale = 3.0;
    float s = 1.0;  // Track the cumulative scale
    int iterations = 0;

    // Limit iterations for IFS to avoid numerical issues
    int maxIter = min(u_maxIterations, 12);

    for (int i = 0; i < 20; i++) {
        if (i >= maxIter) break;

        // Fold space to first octant
        z = abs(z);

        // Conditional folds for cross pattern
        if (z.x < z.y) z.xy = z.yx;
        if (z.x < z.z) z.xz = z.zx;
        if (z.y < z.z) z.yz = z.zy;

        // Scale and translate
        z = z * scale - vec3(scale - 1.0);

        // Fold the z coordinate back
        if (z.z < -0.5 * (scale - 1.0)) {
            z.z += scale - 1.0;
        }

        s *= scale;
        iterations++;
    }

    // Box distance estimation
    vec3 a = abs(z) - vec3(1.0);
    float dist = (min(max(a.x, max(a.y, a.z)), 0.0) + length(max(a, 0.0))) / s;
    return vec2(dist, float(iterations));
}

// 7. Sierpinski Tetrahedron - Recursive tetrahedra IFS
vec2 sierpinskiDE(vec3 pos) {
    vec3 z = pos;
    float scale = 2.0;
    float s = 1.0;  // Track cumulative scale
    int iterations = 0;

    // Limit iterations for IFS
    int maxIter = min(u_maxIterations, 15);

    // Tetrahedron vertices (normalized to fit in unit sphere roughly)
    vec3 a1 = vec3(1.0, 1.0, 1.0);
    vec3 a2 = vec3(-1.0, -1.0, 1.0);
    vec3 a3 = vec3(1.0, -1.0, -1.0);
    vec3 a4 = vec3(-1.0, 1.0, -1.0);

    for (int i = 0; i < 20; i++) {
        if (i >= maxIter) break;

        // Fold toward vertices using reflections
        // This creates the sierpinski pattern
        if (z.x + z.y < 0.0) z.xy = -z.yx;
        if (z.x + z.z < 0.0) z.xz = -z.zx;
        if (z.y + z.z < 0.0) z.yz = -z.zy;

        // Scale and translate
        z = z * scale - vec3(1.0) * (scale - 1.0);
        s *= scale;

        iterations++;
    }

    // Distance to tetrahedron (approximated as point distance)
    float dist = (length(z) - 1.0) / s;
    return vec2(dist, float(iterations));
}

// 8. Kaleidoscopic IFS - Mirror and fold patterns
// Based on the "Pseudo Kleinian" / Kaleidoscopic IFS technique
vec2 kaleidoscopicDE(vec3 pos, float scale) {
    vec3 z = pos * 2.0;  // Scale up for better detail at distance 4
    float s = 2.0;  // Track cumulative scale (starting at 2.0 due to initial scale)
    int iterations = 0;

    // Limit iterations for IFS
    int maxIter = min(u_maxIterations, 20);

    // Offset for fractal pattern
    vec3 cOffset = vec3(1.0, 1.0, 1.0);

    for (int i = 0; i < 25; i++) {
        if (i >= maxIter) break;

        // Octahedral symmetry folds - creates 48-fold symmetry
        z = abs(z);
        if (z.x - z.y < 0.0) z.xy = z.yx;
        if (z.x - z.z < 0.0) z.xz = z.zx;
        if (z.y - z.z < 0.0) z.yz = z.zy;

        // Additional diagonal fold for more complex patterns
        if (z.x + z.y + z.z < 0.0) {
            z = -z;
        }

        // Box fold - clamp and reflect
        z = z * scale - cOffset * (scale - 1.0);

        // Rotate slightly for spiral effect (based on scale position)
        float angle = 0.1 * (scale - 2.0);
        float c = cos(angle), sn = sin(angle);
        z.xz = vec2(c * z.x - sn * z.z, sn * z.x + c * z.z);

        s *= abs(scale);
        iterations++;

        // Early termination if too far
        if (dot(z, z) > 100.0) break;
    }

    // Distance estimation using box distance
    vec3 a = abs(z) - vec3(1.0);
    float boxDist = min(max(a.x, max(a.y, a.z)), 0.0) + length(max(a, 0.0));
    float dist = boxDist / s;

    return vec2(max(dist, 0.0001), float(iterations));
}

// 9. Octahedron IFS - Pure octahedral 8-fold symmetry
vec2 octahedronIFSDE(vec3 pos, float scale) {
    vec3 z = pos;
    float s = 1.0;
    int iterations = 0;

    int maxIter = min(u_maxIterations, 20);

    // Offset toward corner vertex for octahedral symmetry
    vec3 offset = vec3(1.0, 1.0, 0.0);

    for (int i = 0; i < 25; i++) {
        if (i >= maxIter) break;

        // Octahedral symmetry folds - fold to first octant
        z = abs(z);

        // Sort coordinates to fold into fundamental domain
        if (z.x < z.y) z.xy = z.yx;
        if (z.x < z.z) z.xz = z.zx;
        if (z.y < z.z) z.yz = z.zy;

        // Scale and translate - offset tuned for octahedral structure
        z = z * scale - offset * (scale - 1.0);

        s *= abs(scale);
        iterations++;

        if (dot(z, z) > 100.0) break;
    }

    // Distance to octahedron surface: |x| + |y| + |z| = 1
    float octaDist = (abs(z.x) + abs(z.y) + abs(z.z) - 1.0) / (s * 1.732);
    return vec2(max(octaDist, 0.0001), float(iterations));
}

// 10. Icosahedron IFS - Golden ratio fold planes for 20-fold symmetry
vec2 icosahedronIFSDE(vec3 pos, float scale) {
    // Scale input to make fractal larger (fills screen at distance 4)
    float inputScale = 0.625;
    vec3 z = pos * inputScale;
    float s = inputScale;
    int iterations = 0;

    int maxIter = min(u_maxIterations, 20);

    // Golden ratio
    const float phi = 1.618033988749895;

    // Icosahedral fold plane normals - these define the 3 mirror planes
    // that generate icosahedral symmetry (signed to fold toward vertex)
    vec3 n1 = normalize(vec3(-1.0, phi, 0.0));
    vec3 n2 = normalize(vec3(0.0, -1.0, phi));
    vec3 n3 = normalize(vec3(phi, 0.0, -1.0));

    // Offset toward an icosahedral vertex
    vec3 offset = normalize(vec3(1.0, 1.0, 1.0));

    for (int i = 0; i < 25; i++) {
        if (i >= maxIter) break;

        // Icosahedral folds - reflect across each mirror plane
        // NO abs() here - the signed normals handle the folding
        z -= 2.0 * min(0.0, dot(z, n1)) * n1;
        z -= 2.0 * min(0.0, dot(z, n2)) * n2;
        z -= 2.0 * min(0.0, dot(z, n3)) * n3;

        // Scale and translate toward vertex
        z = z * scale - offset * (scale - 1.0);

        s *= abs(scale);
        iterations++;

        if (dot(z, z) > 100.0) break;
    }

    // Distance estimation - sphere centered at origin
    float dist = (length(z) - 1.0) / s;
    return vec2(max(dist, 0.0001), float(iterations));
}

// ==========================================
// Distance Estimator Dispatcher
// ==========================================

vec2 computeDE(vec3 pos) {
    if (u_equation == 1) {
        return mandelbulbDE(pos, u_power);
    } else if (u_equation == 2) {
        return mandelboxDE(pos, u_scale);
    } else if (u_equation == 3) {
        return quaternionJuliaDE(pos);
    } else if (u_equation == 4) {
        return burningShip3DDE(pos, u_power);
    } else if (u_equation == 5) {
        return tricorn3DDE(pos, u_power);
    } else if (u_equation == 6) {
        return mengerSpongeDE(pos);
    } else if (u_equation == 7) {
        return sierpinskiDE(pos);
    } else if (u_equation == 8) {
        return kaleidoscopicDE(pos, u_scale);
    } else if (u_equation == 9) {
        return octahedronIFSDE(pos, u_scale);
    } else if (u_equation == 10) {
        return icosahedronIFSDE(pos, u_scale);
    }
    // Default to Mandelbulb
    return mandelbulbDE(pos, u_power);
}

// ==========================================
// Normal Calculation
// ==========================================

// Calculate normal using gradient
vec3 calcNormal(vec3 pos) {
    vec2 e = vec2(0.0001, 0.0);
    return normalize(vec3(
        computeDE(pos + e.xyy).x - computeDE(pos - e.xyy).x,
        computeDE(pos + e.yxy).x - computeDE(pos - e.yxy).x,
        computeDE(pos + e.yyx).x - computeDE(pos - e.yyx).x
    ));
}

// Calculate normal with adaptive epsilon for better results at various distances
vec3 calcNormalAdaptive(vec3 pos, float eps) {
    vec2 e = vec2(eps, 0.0);
    return normalize(vec3(
        computeDE(pos + e.xyy).x - computeDE(pos - e.xyy).x,
        computeDE(pos + e.yxy).x - computeDE(pos - e.yxy).x,
        computeDE(pos + e.yyx).x - computeDE(pos - e.yyx).x
    ));
}

// ==========================================
// Lighting Helpers
// ==========================================

// Soft shadow calculation
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    if (u_shadowSteps <= 0) return 1.0; // Shadows disabled
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 128; i++) {
        if (i >= u_shadowSteps || t >= maxt) break;
        float h = computeDE(ro + rd * t).x;
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
        float d = computeDE(pos + h * nor).x;
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

// Get color from palette
vec3 getColor(float t) {
    float palettePos = fract(t + u_colorOffset) * float(u_paletteSize - 1);
    int index = int(palettePos);
    float blend = fract(palettePos);
    vec3 color1 = u_palette[index];
    vec3 color2 = u_palette[min(index + 1, u_paletteSize - 1)];
    return mix(color1, color2, blend);
}

// Get enriched color using multiple factors for better palette coverage
vec3 getEnrichedColor(float iterations, vec3 pos, vec3 normal) {
    // Factor 1: Iteration-based (cycles through palette based on escape time)
    float iterFactor = iterations * 0.05 * u_colorIterFactor;

    // Factor 2: Position-based (creates spatial color bands)
    // Use a combination of position components for interesting patterns
    float posFactor = dot(pos, vec3(1.0, 0.618, 0.382)) * 0.8 * u_colorPosFactor;

    // Factor 3: Normal-based (varies color by surface orientation)
    // Map normal direction to a value - surfaces facing different directions get different colors
    float normalFactor = (normal.x * 0.5 + normal.y * 0.3 + normal.z * 0.4 + 1.5) * 0.3 * u_colorNormalFactor;

    // Factor 4: Radial distance from origin (creates concentric color zones)
    float radialFactor = length(pos) * 0.4 * u_colorRadialFactor;

    // Combine factors to create rich color variation
    float colorIndex = iterFactor + posFactor + normalFactor * 0.5 + radialFactor * 0.3;

    // Use fract to wrap around the palette multiple times
    return getColor(fract(colorIndex));
}

// ==========================================
// Ray Marching
// ==========================================

vec4 rayMarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    float iterations = 0.0;

    // Check if camera is inside the fractal (starting DE too small)
    vec2 startResult = computeDE(ro);
    if (startResult.x < 0.001) {
        // Camera is inside - render a warning color (dark red tint)
        return vec4(0.15, 0.02, 0.02, 1.0);
    }

    // Track consecutive tiny steps to detect "stuck" condition
    int tinyStepCount = 0;
    const int MAX_TINY_STEPS = 50;
    const float TINY_STEP_THRESHOLD = 0.0001;
    const float MIN_STEP = 0.0002;  // Minimum step size to prevent infinite loops

    for (int i = 0; i < 1024; i++) {
        if (i >= u_maxSteps) break;

        vec3 pos = ro + rd * t;
        vec2 result = computeDE(pos);
        float dist = result.x;
        iterations = result.y;

        // Distance-adaptive threshold - allows better precision at all distances
        float epsilon = max(MIN_DIST, t * DIST_SCALE);

        // Detect if we're stuck taking tiny steps (likely inside fractal)
        if (dist < TINY_STEP_THRESHOLD) {
            tinyStepCount++;
            if (tinyStepCount > MAX_TINY_STEPS) {
                // We're stuck - return dark background to indicate inside
                return vec4(0.1, 0.05, 0.05, 1.0);
            }
        } else {
            tinyStepCount = 0;
        }

        if (dist < epsilon) {
            // Hit the surface - use distance-scaled normal calculation
            float normalEps = max(0.00005, t * 0.0001);
            vec3 normal = calcNormalAdaptive(pos, normalEps);

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

            // Get enriched color using multiple factors for better palette coverage
            vec3 baseColor = getEnrichedColor(iterations, pos, normal);

            // Combine lighting with base color
            vec3 color = baseColor * (ambient + diffuse) + specular;

            // Add some rim lighting for extra depth
            float rim = 1.0 - max(dot(viewDir, normal), 0.0);
            rim = pow(rim, 3.0) * 0.3;
            color += baseColor * rim;

            return vec4(color, 1.0);
        }

        if (t > MAX_DIST) break;

        // Use minimum step size to prevent infinite loops when inside fractal
        t += max(dist * u_stepScale, MIN_STEP);
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
