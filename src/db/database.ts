import Dexie, { type EntityTable } from 'dexie';

export interface SavedPoint {
  id?: number;
  equationId: number;
  real: number;
  imag: number;
  name: string;
  thumbnail: string | null; // Base64 encoded image
  createdAt: Date;
  updatedAt: Date;
  // Extended state (optional for backwards compatibility)
  viewBounds?: { minReal: number; maxReal: number; minImag: number; maxImag: number };
  maxIterations?: number;
  juliaZoomFactor?: number;
  currentPaletteId?: string;
  colorTemperature?: number;
  paletteColors?: { r: number; g: number; b: number }[]; // Fallback if palette ID not found
}

export interface CustomPalette {
  id?: number;
  paletteId: string;
  name: string;
  colors: { r: number; g: number; b: number }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedAnimation {
  id?: number;
  name: string;
  keyframes: string;             // JSON stringified AnimationKeyframe[]
  totalDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

const db = new Dexie('FractalExplorer') as Dexie & {
  savedPoints: EntityTable<SavedPoint, 'id'>;
  customPalettes: EntityTable<CustomPalette, 'id'>;
  animations: EntityTable<SavedAnimation, 'id'>;
};

db.version(2).stores({
  savedPoints: '++id, equationId, createdAt',
  customPalettes: '++id, paletteId, createdAt',
});

db.version(3).stores({
  savedPoints: '++id, equationId, createdAt',
  customPalettes: '++id, paletteId, createdAt',
  animations: '++id, name, createdAt',
});

export { db };

// Database operations
export async function getAllPoints(): Promise<SavedPoint[]> {
  return db.savedPoints.orderBy('createdAt').reverse().toArray();
}

export async function getPointsByEquation(equationId: number): Promise<SavedPoint[]> {
  return db.savedPoints.where('equationId').equals(equationId).toArray();
}

export async function getPoint(id: number): Promise<SavedPoint | undefined> {
  return db.savedPoints.get(id);
}

export async function addPoint(point: Omit<SavedPoint, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date();
  const id = await db.savedPoints.add({
    ...point,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function updatePoint(id: number, updates: Partial<Omit<SavedPoint, 'id' | 'createdAt'>>): Promise<void> {
  await db.savedPoints.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deletePoint(id: number): Promise<void> {
  await db.savedPoints.delete(id);
}

export async function deleteAllPoints(): Promise<void> {
  await db.savedPoints.clear();
}

// Import/Export functionality
export async function exportPoints(): Promise<string> {
  const points = await getAllPoints();
  return JSON.stringify(points, null, 2);
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

export async function importPoints(jsonString: string): Promise<ImportResult> {
  const points = JSON.parse(jsonString) as SavedPoint[];
  const now = new Date();

  // Get existing points to check for duplicates
  const existingPoints = await getAllPoints();

  // Check if a point is a duplicate (same equationId, real, and imag values)
  const isDuplicate = (point: SavedPoint): boolean => {
    return existingPoints.some(
      (existing) =>
        existing.equationId === point.equationId &&
        Math.abs(existing.real - point.real) < 1e-10 &&
        Math.abs(existing.imag - point.imag) < 1e-10
    );
  };

  // Filter out duplicates and prepare points for import
  const pointsToAdd: Omit<SavedPoint, 'id'>[] = [];
  let skipped = 0;

  for (const point of points) {
    if (isDuplicate(point)) {
      skipped++;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _unusedId, ...pointWithoutId } = point;
      pointsToAdd.push({
        ...pointWithoutId,
        createdAt: new Date(point.createdAt),
        updatedAt: now,
      });
    }
  }

  if (pointsToAdd.length > 0) {
    await db.savedPoints.bulkAdd(pointsToAdd);
  }

  return { imported: pointsToAdd.length, skipped };
}

// Custom palette database operations
export async function getAllCustomPalettes(): Promise<CustomPalette[]> {
  return db.customPalettes.orderBy('createdAt').toArray();
}

export async function getCustomPalette(paletteId: string): Promise<CustomPalette | undefined> {
  return db.customPalettes.where('paletteId').equals(paletteId).first();
}

export async function addCustomPalette(palette: Omit<CustomPalette, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date();
  const id = await db.customPalettes.add({
    ...palette,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function updateCustomPalette(
  paletteId: string,
  updates: Partial<Omit<CustomPalette, 'id' | 'paletteId' | 'createdAt'>>
): Promise<void> {
  const existing = await getCustomPalette(paletteId);
  if (existing && existing.id !== undefined) {
    await db.customPalettes.update(existing.id, {
      ...updates,
      updatedAt: new Date(),
    });
  }
}

export async function deleteCustomPalette(paletteId: string): Promise<void> {
  const existing = await getCustomPalette(paletteId);
  if (existing && existing.id !== undefined) {
    await db.customPalettes.delete(existing.id);
  }
}
