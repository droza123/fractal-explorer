export interface Equation3D {
  id: number;
  label: string;
  formula: string;
  description: string;
  hasPower?: boolean;      // Whether power parameter applies
  defaultPower?: number;   // Default power value
  hasScale?: boolean;      // For fractals like Mandelbox
  defaultScale?: number;
  defaultDistance?: number; // Default camera distance
  defaultFov?: number;      // Default field of view
}

export const equations3d: Equation3D[] = [
  {
    id: 1,
    label: "Mandelbulb",
    formula: "z^n (spherical)",
    description: "Classic Mandelbulb using triplex algebra in spherical coordinates",
    hasPower: true,
    defaultPower: 8,
    defaultDistance: 4.0,
    defaultFov: 90,
  },
  {
    id: 2,
    label: "Mandelbox",
    formula: "fold + scale",
    description: "Box-folding fractal with sphere inversion, creates architectural structures",
    hasScale: true,
    defaultScale: -1.5,  // Classic Mandelbox scale for interesting structure
    defaultDistance: 4.0,
    defaultFov: 90,
  },
  {
    id: 3,
    label: "Quaternion Julia",
    formula: "q^2 + c (4D slice)",
    description: "Julia set in quaternion space, sliced to 3D",
    // No hasPower - uses fixed c value, not adjustable power
    defaultDistance: 4.0,
    defaultFov: 90,
  },
  {
    id: 4,
    label: "Burning Ship 3D",
    formula: "(|x|,|y|,|z|)^n + c",
    description: "3D extension using absolute values, creates sharp angular forms",
    hasPower: true,
    defaultPower: 2,  // Low power shows the ship-like structure
    defaultDistance: 4.0,
    defaultFov: 90,
  },
  {
    id: 5,
    label: "Tricorn 3D",
    formula: "conj(z)^n + c",
    description: "Conjugate Mandelbulb variant with different symmetry",
    hasPower: true,
    defaultPower: 2,  // Low power shows interesting structure
    defaultDistance: 4.0,
    defaultFov: 90,
  },
  {
    id: 6,
    label: "Menger Sponge",
    formula: "IFS cross subtract",
    description: "Classic geometric fractal - infinite recursive cube with holes",
    defaultDistance: 4.0,
    defaultFov: 90,
  },
  {
    id: 7,
    label: "Sierpinski Tetrahedron",
    formula: "IFS tetrahedra",
    description: "3D Sierpinski triangle - recursive tetrahedra",
    defaultDistance: 4.0,
    defaultFov: 90,
  },
  {
    id: 8,
    label: "Kaleidoscopic IFS",
    formula: "mirror + fold",
    description: "Mirroring and folding operations create kaleidoscopic patterns",
    hasScale: true,
    defaultScale: 1.5,  // Sweet spot between sphere (1) and cube (2)
    defaultDistance: 4.0,
    defaultFov: 90,
  },
  {
    id: 9,
    label: "Octahedron IFS",
    formula: "octa fold + scale",
    description: "Octahedral 8-fold symmetry fractal using coordinate sorting folds",
    hasScale: true,
    defaultScale: 2.3,  // Slightly above 2 for fractal detail
    defaultDistance: 4.0,
    defaultFov: 90,
  },
  {
    id: 10,
    label: "Icosahedron IFS",
    formula: "φ-fold + scale",
    description: "Golden ratio fold planes create 20-fold icosahedral symmetry",
    hasScale: true,
    defaultScale: 2.3,  // Slightly above 2 for fractal detail
    defaultDistance: 4.0,
    defaultFov: 90,
  },
];

export function getEquation3D(id: number): Equation3D | undefined {
  return equations3d.find(eq => eq.id === id);
}
