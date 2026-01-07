// Color palette definitions for fractal rendering

export interface RGB {
  r: number; // 0-255
  g: number;
  b: number;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: RGB[];
  isCustom?: boolean;
}

// Convert RGB to normalized values (0-1) for shader
export function rgbToNormalized(color: RGB): [number, number, number] {
  return [color.r / 255, color.g / 255, color.b / 255];
}

// Convert hex string to RGB
export function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

// Convert RGB to hex string
export function rgbToHex(color: RGB): string {
  return '#' + [color.r, color.g, color.b]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

// Interpolate between two colors
export function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

// Apply temperature shift to a color (negative = cooler/blue, positive = warmer/red)
export function applyTemperature(color: RGB, temperature: number): RGB {
  // temperature ranges from -1 (cooler) to 1 (warmer)
  const shift = temperature * 30; // Max shift of 30 in RGB values
  return {
    r: Math.max(0, Math.min(255, Math.round(color.r + shift))),
    g: color.g,
    b: Math.max(0, Math.min(255, Math.round(color.b - shift))),
  };
}

// Apply temperature to entire palette
export function applyTemperatureToPalette(palette: RGB[], temperature: number): RGB[] {
  return palette.map(color => applyTemperature(color, temperature));
}

// Preset palettes matching the original app
// Amethyst: Cyan → Dark Purple/Magenta → Red/Pink
export const PALETTE_AMETHYST: ColorPalette = {
  id: 'amethyst',
  name: 'Amethyst',
  colors: [
    { r: 0, g: 128, b: 128 },    // Teal/Cyan
    { r: 0, g: 64, b: 128 },     // Dark Cyan-Blue
    { r: 64, g: 0, b: 128 },     // Purple
    { r: 128, g: 0, b: 128 },    // Magenta
    { r: 192, g: 0, b: 96 },     // Red-Magenta
    { r: 255, g: 0, b: 64 },     // Red-Pink
    { r: 255, g: 64, b: 128 },   // Pink
  ],
};

// Palette B: More magenta/pink shifted
export const PALETTE_B: ColorPalette = {
  id: 'palette-b',
  name: 'Magenta',
  colors: [
    { r: 32, g: 0, b: 64 },      // Dark Purple
    { r: 64, g: 0, b: 128 },     // Purple
    { r: 128, g: 0, b: 160 },    // Magenta-Purple
    { r: 192, g: 0, b: 192 },    // Magenta
    { r: 255, g: 0, b: 160 },    // Pink-Magenta
    { r: 255, g: 64, b: 192 },   // Light Pink
    { r: 255, g: 128, b: 255 },  // Bright Pink
  ],
};

// Palette C: Purple → Dark Blue → Cyan (cooler)
export const PALETTE_C: ColorPalette = {
  id: 'palette-c',
  name: 'Ocean',
  colors: [
    { r: 64, g: 0, b: 128 },     // Purple
    { r: 32, g: 0, b: 160 },     // Blue-Purple
    { r: 0, g: 0, b: 128 },      // Dark Blue
    { r: 0, g: 32, b: 160 },     // Blue
    { r: 0, g: 64, b: 192 },     // Medium Blue
    { r: 0, g: 128, b: 192 },    // Cyan-Blue
    { r: 0, g: 192, b: 224 },    // Cyan
  ],
};

// Classic rainbow palette
export const PALETTE_RAINBOW: ColorPalette = {
  id: 'rainbow',
  name: 'Rainbow',
  colors: [
    { r: 255, g: 0, b: 0 },      // Red
    { r: 255, g: 127, b: 0 },    // Orange
    { r: 255, g: 255, b: 0 },    // Yellow
    { r: 0, g: 255, b: 0 },      // Green
    { r: 0, g: 0, b: 255 },      // Blue
    { r: 75, g: 0, b: 130 },     // Indigo
    { r: 148, g: 0, b: 211 },    // Violet
  ],
};

// Fire palette
export const PALETTE_FIRE: ColorPalette = {
  id: 'fire',
  name: 'Fire',
  colors: [
    { r: 0, g: 0, b: 0 },        // Black
    { r: 128, g: 0, b: 0 },      // Dark Red
    { r: 255, g: 0, b: 0 },      // Red
    { r: 255, g: 128, b: 0 },    // Orange
    { r: 255, g: 255, b: 0 },    // Yellow
    { r: 255, g: 255, b: 128 },  // Light Yellow
    { r: 255, g: 255, b: 255 },  // White
  ],
};

// Additional palettes with softer tones

// Autumn: Muted oranges, warm browns, burgundy
export const PALETTE_AUTUMN: ColorPalette = {
  id: 'autumn',
  name: 'Autumn',
  colors: [
    { r: 58, g: 32, b: 32 },     // Dark burgundy
    { r: 92, g: 48, b: 38 },     // Deep rust
    { r: 128, g: 72, b: 52 },    // Burnt sienna
    { r: 162, g: 100, b: 68 },   // Terracotta
    { r: 185, g: 128, b: 88 },   // Copper
    { r: 198, g: 155, b: 112 },  // Warm tan
    { r: 210, g: 180, b: 140 },  // Soft gold
  ],
};

// Sunset: Soft oranges through purples - like a real sunset
export const PALETTE_SUNSET: ColorPalette = {
  id: 'sunset',
  name: 'Sunset',
  colors: [
    { r: 70, g: 50, b: 90 },     // Dusky purple
    { r: 120, g: 70, b: 100 },   // Muted magenta
    { r: 170, g: 90, b: 95 },    // Dusty rose
    { r: 200, g: 120, b: 90 },   // Soft coral
    { r: 210, g: 155, b: 100 },  // Muted orange
    { r: 220, g: 185, b: 130 },  // Soft gold
    { r: 230, g: 210, b: 170 },  // Pale peach
  ],
};

// Forest: Teals, greens, and earthy browns
export const PALETTE_FOREST: ColorPalette = {
  id: 'forest',
  name: 'Forest',
  colors: [
    { r: 35, g: 55, b: 50 },     // Deep forest
    { r: 50, g: 85, b: 75 },     // Dark teal
    { r: 70, g: 115, b: 90 },    // Forest green
    { r: 100, g: 140, b: 100 },  // Sage
    { r: 140, g: 160, b: 110 },  // Moss
    { r: 175, g: 170, b: 130 },  // Olive tan
    { r: 200, g: 190, b: 160 },  // Soft lichen
  ],
};

// Vintage: Dusty teals, muted roses, soft golds
export const PALETTE_VINTAGE: ColorPalette = {
  id: 'vintage',
  name: 'Vintage',
  colors: [
    { r: 60, g: 90, b: 95 },     // Dusty teal
    { r: 95, g: 120, b: 115 },   // Faded seafoam
    { r: 150, g: 145, b: 130 },  // Antique
    { r: 185, g: 155, b: 135 },  // Dusty rose-tan
    { r: 195, g: 140, b: 130 },  // Muted rose
    { r: 180, g: 120, b: 110 },  // Dusty coral
    { r: 160, g: 100, b: 100 },  // Faded brick
  ],
};

// Aurora: Soft greens, teals, and purples - like northern lights
export const PALETTE_AURORA: ColorPalette = {
  id: 'aurora',
  name: 'Aurora',
  colors: [
    { r: 40, g: 50, b: 70 },     // Night sky
    { r: 60, g: 100, b: 100 },   // Deep teal
    { r: 80, g: 150, b: 120 },   // Soft green
    { r: 120, g: 180, b: 150 },  // Mint
    { r: 150, g: 170, b: 180 },  // Pale blue-gray
    { r: 140, g: 130, b: 170 },  // Soft violet
    { r: 120, g: 100, b: 150 },  // Muted purple
  ],
};

// Coral: Soft pinks, corals, and warm neutrals
export const PALETTE_CORAL: ColorPalette = {
  id: 'coral',
  name: 'Coral',
  colors: [
    { r: 90, g: 70, b: 80 },     // Dusty mauve
    { r: 140, g: 95, b: 100 },   // Muted rose
    { r: 185, g: 120, b: 115 },  // Soft coral
    { r: 210, g: 155, b: 140 },  // Peachy pink
    { r: 225, g: 190, b: 170 },  // Blush
    { r: 230, g: 210, b: 195 },  // Cream rose
    { r: 235, g: 225, b: 215 },  // Warm white
  ],
};

// Sapphire: Blues with purple and teal accents
export const PALETTE_SAPPHIRE: ColorPalette = {
  id: 'sapphire',
  name: 'Sapphire',
  colors: [
    { r: 30, g: 40, b: 80 },     // Deep navy
    { r: 50, g: 70, b: 130 },    // Sapphire
    { r: 70, g: 100, b: 160 },   // Medium blue
    { r: 100, g: 140, b: 180 },  // Steel blue
    { r: 130, g: 160, b: 190 },  // Soft blue
    { r: 160, g: 175, b: 200 },  // Pale periwinkle
    { r: 190, g: 195, b: 210 },  // Misty blue
  ],
};

// Ember: Warm reds through golden yellows
export const PALETTE_EMBER: ColorPalette = {
  id: 'ember',
  name: 'Ember',
  colors: [
    { r: 60, g: 30, b: 35 },     // Deep maroon
    { r: 110, g: 50, b: 45 },    // Dark rust
    { r: 160, g: 80, b: 60 },    // Brick
    { r: 190, g: 115, b: 75 },   // Terracotta
    { r: 210, g: 155, b: 100 },  // Amber
    { r: 220, g: 190, b: 130 },  // Soft gold
    { r: 230, g: 215, b: 170 },  // Warm cream
  ],
};

// Classic fractal palettes

// Spectrum: The original HSV-based coloring from before the palette system
export const PALETTE_SPECTRUM: ColorPalette = {
  id: 'spectrum',
  name: 'Spectrum',
  colors: [
    { r: 0, g: 0, b: 40 },       // Very dark blue
    { r: 0, g: 32, b: 128 },     // Dark blue
    { r: 0, g: 100, b: 200 },    // Blue
    { r: 0, g: 180, b: 220 },    // Cyan
    { r: 0, g: 220, b: 180 },    // Cyan-green
    { r: 80, g: 220, b: 80 },    // Green
    { r: 180, g: 220, b: 0 },    // Yellow-green
    { r: 255, g: 200, b: 0 },    // Yellow
    { r: 255, g: 128, b: 0 },    // Orange
    { r: 255, g: 60, b: 60 },    // Red-orange
  ],
};

// Classic: Traditional HSV-based fractal coloring
export const PALETTE_CLASSIC: ColorPalette = {
  id: 'classic',
  name: 'Classic',
  colors: [
    { r: 0, g: 0, b: 128 },      // Dark blue
    { r: 0, g: 128, b: 255 },    // Bright blue
    { r: 0, g: 255, b: 255 },    // Cyan
    { r: 0, g: 255, b: 128 },    // Cyan-green
    { r: 128, g: 255, b: 0 },    // Yellow-green
    { r: 255, g: 255, b: 0 },    // Yellow
    { r: 255, g: 128, b: 0 },    // Orange
    { r: 255, g: 0, b: 0 },      // Red
  ],
};

// Electric: Vibrant cyans and magentas - classic Julia aesthetic
export const PALETTE_ELECTRIC: ColorPalette = {
  id: 'electric',
  name: 'Electric',
  colors: [
    { r: 0, g: 32, b: 64 },      // Deep navy
    { r: 0, g: 96, b: 128 },     // Deep cyan
    { r: 0, g: 180, b: 200 },    // Bright cyan
    { r: 64, g: 128, b: 192 },   // Sky blue
    { r: 160, g: 64, b: 192 },   // Purple
    { r: 220, g: 32, b: 160 },   // Magenta
    { r: 255, g: 64, b: 128 },   // Hot pink
    { r: 255, g: 128, b: 192 },  // Light pink
  ],
};

// Neon: Bold cyberpunk-inspired colors
export const PALETTE_NEON: ColorPalette = {
  id: 'neon',
  name: 'Neon',
  colors: [
    { r: 16, g: 16, b: 32 },     // Near black
    { r: 0, g: 255, b: 128 },    // Neon green
    { r: 0, g: 200, b: 255 },    // Neon cyan
    { r: 128, g: 0, b: 255 },    // Neon purple
    { r: 255, g: 0, b: 200 },    // Neon pink
    { r: 255, g: 100, b: 0 },    // Neon orange
    { r: 255, g: 255, b: 0 },    // Neon yellow
  ],
};

// Cosmic: Deep space colors with nebula feel
export const PALETTE_COSMIC: ColorPalette = {
  id: 'cosmic',
  name: 'Cosmic',
  colors: [
    { r: 8, g: 8, b: 24 },       // Deep space
    { r: 32, g: 16, b: 64 },     // Dark purple
    { r: 64, g: 32, b: 128 },    // Purple
    { r: 96, g: 64, b: 160 },    // Violet
    { r: 128, g: 96, b: 192 },   // Lavender
    { r: 192, g: 128, b: 200 },  // Pink-violet
    { r: 255, g: 180, b: 220 },  // Soft pink
    { r: 255, g: 220, b: 240 },  // Pale pink
  ],
};

// Aqua: Ocean-inspired teals and blues
export const PALETTE_AQUA: ColorPalette = {
  id: 'aqua',
  name: 'Aqua',
  colors: [
    { r: 0, g: 32, b: 48 },      // Deep ocean
    { r: 0, g: 64, b: 96 },      // Dark teal
    { r: 0, g: 128, b: 160 },    // Teal
    { r: 32, g: 180, b: 200 },   // Bright teal
    { r: 96, g: 210, b: 220 },   // Light cyan
    { r: 160, g: 230, b: 235 },  // Pale cyan
    { r: 220, g: 245, b: 250 },  // Near white
  ],
};

// All preset palettes (Classic is the default)
export const PRESET_PALETTES: ColorPalette[] = [
  PALETTE_CLASSIC,
  PALETTE_SPECTRUM,
  PALETTE_AMETHYST,
  PALETTE_B,
  PALETTE_C,
  PALETTE_RAINBOW,
  PALETTE_FIRE,
  PALETTE_ELECTRIC,
  PALETTE_NEON,
  PALETTE_COSMIC,
  PALETTE_AQUA,
  PALETTE_AUTUMN,
  PALETTE_SUNSET,
  PALETTE_FOREST,
  PALETTE_VINTAGE,
  PALETTE_AURORA,
  PALETTE_CORAL,
  PALETTE_SAPPHIRE,
  PALETTE_EMBER,
];

// Generate a flat array of RGB values for shader uniform
// The shader expects colors in a fixed-size array, so we interpolate to fill it
export function generateShaderPalette(palette: RGB[], size: number = 64): number[] {
  const result: number[] = [];

  if (palette.length === 0) {
    // Return black if no colors
    for (let i = 0; i < size * 3; i++) {
      result.push(0);
    }
    return result;
  }

  if (palette.length === 1) {
    // Single color - fill entire palette
    for (let i = 0; i < size; i++) {
      result.push(palette[0].r / 255, palette[0].g / 255, palette[0].b / 255);
    }
    return result;
  }

  // Interpolate between colors
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1); // 0 to 1
    const scaledT = t * (palette.length - 1);
    const index = Math.floor(scaledT);
    const localT = scaledT - index;

    const color1 = palette[Math.min(index, palette.length - 1)];
    const color2 = palette[Math.min(index + 1, palette.length - 1)];
    const interpolated = lerpColor(color1, color2, localT);

    result.push(interpolated.r / 255, interpolated.g / 255, interpolated.b / 255);
  }

  return result;
}
