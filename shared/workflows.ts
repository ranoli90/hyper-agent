/**
 * @fileoverview Workflow execution.
 * Load, validate, and run workflows with conditions. Uses safe-regex for urlMatches.
 */

import type { Workflow, WorkflowStep, Condition, PageContext } from './types';
import { isSafeRegex } from './safe-regex';

// Storage key for workflows
const WORKFLOWS_STORAGE_KEY = 'hyperagent_workflows';

/**
 * Save a workflow to storage
 */
export async function saveWorkflow(workflow: Workflow): Promise<void> {
  const workflows = await getWorkflows();
  
  // Update existing or add new
  const existingIndex = workflows.findIndex(w => w.id === workflow.id);
  if (existingIndex >= 0) {
    workflows[existingIndex] = workflow;
  } else {
    workflows.push(workflow);
  }
  
  await chrome.storage.local.set({ [WORKFLOWS_STORAGE_KEY]: workflows });
}

/**
 * Get all saved workflows
 */
export async function getWorkflows(): Promise<Workflow[]> {
  const result = await chrome.storage.local.get(WORKFLOWS_STORAGE_KEY);
  return (result[WORKFLOWS_STORAGE_KEY] as Workflow[]) || [];
}

/**
 * Get a workflow by ID
 */
export async function getWorkflowById(id: string): Promise<Workflow | null> {
  const workflows = await getWorkflows();
  return workflows.find(w => w.id === id) || null;
}

/**
 * Delete a workflow by ID
 */
export async function deleteWorkflow(id: string): Promise<void> {
  const workflows = await getWorkflows();
  const filtered = workflows.filter(w => w.id !== id);
  await chrome.storage.local.set({ [WORKFLOWS_STORAGE_KEY]: filtered });
}

/**
 * Validate a workflow structure
 */
export function validateWorkflow(workflow: Workflow): boolean {
  // Must have ID, name, and at least one step
  if (!workflow.id || !workflow.name || !workflow.steps || workflow.steps.length === 0) {
    return false;
  }
  
  // Validate each step has required fields
  for (const step of workflow.steps) {
    if (!step.id || !step.action) {
      return false;
    }
    
    // If onSuccess/onError references exist, they must point to valid step IDs
    if (step.onSuccess) {
      const hasSuccessStep = workflow.steps.some(s => s.id === step.onSuccess);
      if (!hasSuccessStep) return false;
    }
    if (step.onError) {
      const hasErrorStep = workflow.steps.some(s => s.id === step.onError);
      if (!hasErrorStep) return false;
    }
  }
  
  // If startStep is specified, it must exist
  if (workflow.startStep) {
    const hasStartStep = workflow.steps.some(s => s.id === workflow.startStep);
    if (!hasStartStep) return false;
  }
  
  return true;
}


/**
 * Check if a condition is met
 */
export async function checkCondition(
  condition: Condition,
  context: PageContext
): Promise<boolean> {
  // Sanitize condition value - limit length to prevent abuse
  const MAX_VALUE_LENGTH = 500;
  const value = typeof condition.value === 'string' 
    ? condition.value.slice(0, MAX_VALUE_LENGTH) 
    : '';

  switch (condition.type) {
    case 'elementExists': {
      const element = context.semanticElements.find(
        el => el.visibleText.includes(value) ||
              el.ariaLabel?.includes(value) ||
              el.id.includes(value) ||
              el.role === value
      );
      return !!element;
    }
    
    case 'elementMissing': {
      const element = context.semanticElements.find(
        el => el.visibleText.includes(value) ||
              el.ariaLabel?.includes(value) ||
              el.id.includes(value) ||
              el.role === value
      );
      return !element;
    }
    
    case 'textContains': {
      return context.bodyText.includes(value);
    }
    
    case 'urlMatches': {
      if (!isSafeRegex(value)) {
        return context.url.includes(value);
      }
      try {
        const regex = new RegExp(value, 'i');
        return regex.test(context.url);
      } catch {
        return context.url.includes(value);
      }
    }
    
    default:
      return false;
  }
}

/**
 * Find the next step ID based on action result
 */
export function findNextStep(
  currentStep: WorkflowStep,
  actionSuccess: boolean,
  _context: PageContext
): string | null {
  // If there's a condition, check it first
  if (currentStep.condition) {
    // For success path with condition: check condition
    // For error path: skip condition and go to error branch
  }
  
  if (actionSuccess) {
    // Action succeeded - check onSuccess or go to next step
    if (currentStep.onSuccess) {
      return currentStep.onSuccess;
    }
    return null; // End of workflow on success with no explicit next
  } else {
    // Action failed - check onError or end workflow
    if (currentStep.onError) {
      return currentStep.onError;
    }
    return null; // End workflow on error
  }
}

/** Minimal page context for when getContext fails (e.g. chrome:// page) */
const EMPTY_PAGE_CONTEXT: PageContext = {
  url: '',
  title: '',
  bodyText: '',
  metaDescription: '',
  formCount: 0,
  semanticElements: [],
  timestamp: 0,
  scrollPosition: { x: 0, y: 0 },
  viewportSize: { width: 0, height: 0 },
  pageHeight: 0,
};

/**
 * Run a workflow by ID
 * @param getContextFn - Optional. When provided, step conditions are evaluated against current page context.
 *   If omitted, steps with conditions are executed (condition not evaluated).
 */
export async function runWorkflow(
  id: string,
  executeActionFn: (action: any) => Promise<{ success: boolean; error?: string; errorType?: string; extractedData?: string }>,
  getContextFn?: () => Promise<PageContext>
): Promise<{ success: boolean; error?: string; results?: any[] }> {
  const workflow = await getWorkflowById(id);
  
  if (!workflow) {
    return { success: false, error: `Workflow not found: ${id}` };
  }
  
  if (!validateWorkflow(workflow)) {
    return { success: false, error: 'Invalid workflow structure' };
  }
  
  const results: any[] = [];
  let currentStepId: string | null = workflow.startStep || workflow.steps[0]?.id;
  
  if (!currentStepId) {
    return { success: false, error: 'No start step found' };
  }
  
  const MAX_WORKFLOW_ITERATIONS = 100;
  let iterations = 0;

  while (currentStepId) {
    if (++iterations > MAX_WORKFLOW_ITERATIONS) {
      return { success: false, error: 'Workflow exceeded maximum iterations (possible infinite loop)', results };
    }
    const step = workflow.steps.find(s => s.id === currentStepId);
    
    if (!step) {
      break;
    }
    
    // Evaluate condition if present and getContextFn provided
    if (step.condition && getContextFn) {
      let context: PageContext;
      try {
        context = await getContextFn();
      } catch {
        context = EMPTY_PAGE_CONTEXT;
      }
      const conditionMet = await checkCondition(step.condition, context);
      if (!conditionMet) {
        // Condition failed - follow onError branch
        results.push({
          stepId: step.id,
          action: step.action,
          result: { success: false, error: 'Condition not met', errorType: 'CONDITION_FAILED' }
        });
        if (step.onError) {
          currentStepId = step.onError;
        } else {
          return {
            success: false,
            error: `Workflow condition failed at step: ${step.id}`,
            results
          };
        }
        continue;
      }
    }
    
    // Execute the action
    const result = await executeActionFn(step.action);
    
    results.push({
      stepId: step.id,
      action: step.action,
      result
    });
    
    if (result.success) {
      if (step.onSuccess) {
        currentStepId = step.onSuccess;
      } else {
        // Find next sequential step
        const currentIndex = workflow.steps.findIndex(s => s.id === currentStepId);
        if (currentIndex < workflow.steps.length - 1) {
          currentStepId = workflow.steps[currentIndex + 1].id;
        } else {
          currentStepId = null; // End of workflow
        }
      }
    } else {
      // Action failed
      if (step.onError) {
        currentStepId = step.onError;
      } else {
        // End workflow on error
        return {
          success: false,
          error: `Workflow failed at step: ${step.id}`,
          results
        };
      }
    }
  }
  
  return { success: true, results };
}

/**
 * Create a sample workflow for testing
 */
export function createSampleWorkflow(): Workflow {
  return {
    id: 'sample-workflow',
    name: 'Sample Workflow',
    description: 'A sample workflow demonstrating workflow orchestration',
    startStep: 'step1',
    steps: [
      {
        id: 'step1',
        action: {
          type: 'navigate',
          url: 'https://example.com',
          description: 'Navigate to example.com'
        },
        onSuccess: 'step2'
      },
      {
        id: 'step2',
        action: {
          type: 'wait',
          ms: 1000,
          description: 'Wait for page to load'
        },
        onSuccess: 'step3'
      },
      {
        id: 'step3',
        action: {
          type: 'extract',
          locator: { strategy: 'role', value: 'heading' },
          description: 'Extract page title'
        }
      }
    ]
  };
}
