import type { Macro, Action } from './types';

const MACROS_STORAGE_KEY = 'hyperagent_macros';

/**
 * Generate a unique ID for a macro
 */
function generateMacroId(): string {
  return `macro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get all stored macros
 */
export async function getMacros(): Promise<Macro[]> {
  try {
    const result = await chrome.storage.local.get(MACROS_STORAGE_KEY);
    const macros: Macro[] = result[MACROS_STORAGE_KEY] || [];
    return macros;
  } catch (err) {
    console.error('[HyperAgent] Failed to get macros:', err);
    return [];
  }
}

/**
 * Save a new macro or update an existing one
 */
export async function saveMacro(macro: Omit<Macro, 'id' | 'createdAt' | 'useCount'> & { id?: string }): Promise<Macro> {
  const macros = await getMacros();
  
  const now = Date.now();
  let savedMacro: Macro;
  
  if (macro.id) {
    // Update existing macro
    const index = macros.findIndex(m => m.id === macro.id);
    if (index === -1) {
      throw new Error(`Macro with id ${macro.id} not found`);
    }
    savedMacro = {
      ...macros[index],
      ...macro,
      id: macro.id,
    } as Macro;
    macros[index] = savedMacro;
  } else {
    // Create new macro
    savedMacro = {
      id: generateMacroId(),
      name: macro.name,
      description: macro.description,
      actions: macro.actions,
      createdAt: now,
      lastUsed: macro.lastUsed,
      useCount: 0,
    };
    macros.push(savedMacro);
  }
  
  await chrome.storage.local.set({ [MACROS_STORAGE_KEY]: macros });
  return savedMacro;
}

/**
 * Delete a macro by ID
 */
export async function deleteMacro(id: string): Promise<void> {
  const macros = await getMacros();
  const filtered = macros.filter(m => m.id !== id);
  await chrome.storage.local.set({ [MACROS_STORAGE_KEY]: filtered });
}

/**
 * Get a specific macro by ID
 */
export async function getMacroById(id: string): Promise<Macro | null> {
  const macros = await getMacros();
  return macros.find(m => m.id === id) || null;
}

/**
 * Update macro usage statistics (lastUsed and useCount)
 */
async function updateMacroUsage(id: string): Promise<void> {
  const macros = await getMacros();
  const index = macros.findIndex(m => m.id === id);
  if (index !== -1) {
    macros[index].lastUsed = Date.now();
    macros[index].useCount = (macros[index].useCount || 0) + 1;
    await chrome.storage.local.set({ [MACROS_STORAGE_KEY]: macros });
  }
}

/**
 * Run a macro by executing all its actions in sequence
 * Returns the results of all executed actions
 */
export async function runMacro(
  id: string,
  executeActionFn: (action: Action) => Promise<{ success: boolean; error?: string; extractedData?: string }>
): Promise<{ success: boolean; results: { success: boolean; error?: string; extractedData?: string }[]; error?: string }> {
  const macro = await getMacroById(id);
  
  if (!macro) {
    return { success: false, results: [], error: `Macro not found: ${id}` };
  }
  
  // Update usage statistics
  await updateMacroUsage(id);
  
  const results: { success: boolean; error?: string; extractedData?: string }[] = [];
  
  // Execute each action in the macro sequentially
  for (const action of macro.actions) {
    const result = await executeActionFn(action);
    results.push(result);
    
    // Stop executing if an action fails (unless it's not destructive)
    if (!result.success) {
      return {
        success: false,
        results,
        error: `Macro failed at action: ${action.type}`,
      };
    }
  }
  
  return { success: true, results };
}

/**
 * List all macros in a compact format for display
 */
export async function listMacros(): Promise<{ id: string; name: string; description?: string; actionCount: number; useCount: number }[]> {
  const macros = await getMacros();
  return macros.map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    actionCount: m.actions.length,
    useCount: m.useCount,
  }));
}
