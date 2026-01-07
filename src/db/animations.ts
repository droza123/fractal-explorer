import { db, type SavedAnimation } from './database';
import type { AnimationKeyframe, Animation } from '../types';

// Get all animations
export async function getAllAnimations(): Promise<Animation[]> {
  const savedAnimations = await db.animations.orderBy('createdAt').reverse().toArray();
  return savedAnimations.map(parseAnimation);
}

// Get a single animation by ID
export async function getAnimation(id: number): Promise<Animation | undefined> {
  const saved = await db.animations.get(id);
  if (!saved) return undefined;
  return parseAnimation(saved);
}

// Add a new animation
export async function addAnimation(
  animation: Omit<Animation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const now = new Date();
  const id = await db.animations.add({
    name: animation.name,
    keyframes: JSON.stringify(animation.keyframes),
    totalDuration: animation.totalDuration,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

// Update an existing animation
export async function updateAnimation(
  id: number,
  updates: Partial<Omit<Animation, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const updateData: Partial<SavedAnimation> = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) {
    updateData.name = updates.name;
  }
  if (updates.keyframes !== undefined) {
    updateData.keyframes = JSON.stringify(updates.keyframes);
  }
  if (updates.totalDuration !== undefined) {
    updateData.totalDuration = updates.totalDuration;
  }

  await db.animations.update(id, updateData);
}

// Delete an animation
export async function deleteAnimation(id: number): Promise<void> {
  await db.animations.delete(id);
}

// Delete all animations
export async function deleteAllAnimations(): Promise<void> {
  await db.animations.clear();
}

// Export animations as JSON string
export async function exportAnimations(): Promise<string> {
  const animations = await getAllAnimations();
  return JSON.stringify(animations, null, 2);
}

// Import animations from JSON string
export interface AnimationImportResult {
  imported: number;
  skipped: number;
}

export async function importAnimations(jsonString: string): Promise<AnimationImportResult> {
  const animations = JSON.parse(jsonString) as Animation[];
  const now = new Date();

  // Get existing animations to check for duplicates by name
  const existingAnimations = await getAllAnimations();
  const existingNames = new Set(existingAnimations.map((a) => a.name.toLowerCase()));

  const animationsToAdd: Omit<SavedAnimation, 'id'>[] = [];
  let skipped = 0;

  for (const animation of animations) {
    // Skip if animation with same name already exists
    if (existingNames.has(animation.name.toLowerCase())) {
      skipped++;
    } else {
      animationsToAdd.push({
        name: animation.name,
        keyframes: JSON.stringify(animation.keyframes),
        totalDuration: animation.totalDuration,
        createdAt: animation.createdAt ? new Date(animation.createdAt) : now,
        updatedAt: now,
      });
      // Add to set to prevent duplicates within import batch
      existingNames.add(animation.name.toLowerCase());
    }
  }

  if (animationsToAdd.length > 0) {
    await db.animations.bulkAdd(animationsToAdd);
  }

  return { imported: animationsToAdd.length, skipped };
}

// Helper function to parse SavedAnimation to Animation
function parseAnimation(saved: SavedAnimation): Animation {
  return {
    id: saved.id,
    name: saved.name,
    keyframes: JSON.parse(saved.keyframes) as AnimationKeyframe[],
    totalDuration: saved.totalDuration,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
}
