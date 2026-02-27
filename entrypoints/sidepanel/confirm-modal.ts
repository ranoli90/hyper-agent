import { trapFocus } from './focus-trap';

interface ConfirmOptions {
  title?: string;
  summary?: string;
  listItems?: string[];
}

export function createConfirmModalController() {
  const modal = document.getElementById('confirm-modal') as HTMLElement | null;
  const titleEl = document.getElementById('confirm-title') as HTMLElement | null;
  const summaryEl = document.getElementById('confirm-summary') as HTMLElement | null;
  const listEl = document.getElementById('confirm-actions-list') as HTMLElement | null;
  const btnConfirm = document.getElementById('btn-confirm') as HTMLButtonElement | null;
  const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement | null;

  if (!modal || !btnConfirm || !btnCancel) {
    return {
      showConfirm: async (message: string): Promise<boolean> => {
        // Fallback to native confirm if modal is missing
        return globalThis.confirm(message);
      },
    };
  }

  let cleanupFocus: (() => void) | null = null;

  const showConfirm = (message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (titleEl && options.title) {
        titleEl.textContent = options.title;
      }
      if (summaryEl) {
        summaryEl.textContent = options.summary ?? message;
      }
      if (listEl) {
        listEl.innerHTML = '';
        if (options.listItems && options.listItems.length > 0) {
          for (const item of options.listItems) {
            const li = document.createElement('li');
            li.textContent = item;
            listEl.appendChild(li);
          }
        }
      }

      modal.classList.remove('hidden');
      if (cleanupFocus) cleanupFocus();
      cleanupFocus = trapFocus(modal);

      const handleResolve = (value: boolean) => {
        modal.classList.add('hidden');
        if (cleanupFocus) {
          cleanupFocus();
          cleanupFocus = null;
        }
        btnConfirm.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        resolve(value);
      };

      const onConfirm = () => handleResolve(true);
      const onCancel = () => handleResolve(false);
      const onBackdrop = (e: MouseEvent) => {
        if (e.target === modal) handleResolve(false);
      };

      btnConfirm.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
    });
  };

  return { showConfirm };
}
