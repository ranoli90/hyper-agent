/**
 * Advanced Stealth & Anti-Bot Engine
 * 
 * Implements high-fidelity human interaction patterns to bypass 
 * advanced bot detection systems (Cloudflare, Akamai, Datadome).
 */

export class StealthEngine {
    /**
     * Simulates human-like typing with variable cadence and self-correction.
     */
    static async typeStealthily(element: HTMLInputElement | HTMLTextAreaElement, text: string): Promise<void> {
        element.focus();

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // 1. Variable speed: 50ms to 250ms per key
            const delay = Math.random() * 200 + 50;
            await new Promise(r => globalThis.setTimeout(r, delay));

            // 2. Occasional "mistake" and backspace (1% chance)
            if (Math.random() < 0.01 && i > 1) {
                const wrongChar = String.fromCharCode(Math.random() * 26 + 97);
                element.value += wrongChar;
                await new Promise(r => globalThis.setTimeout(r, 100));
                element.value = element.value.slice(0, -1);
                await new Promise(r => globalThis.setTimeout(r, 200));
            }

            // 3. Dispatch full event sequence
            const entry = { key: char, charCode: char.charCodeAt(0), keyCode: char.charCodeAt(0) };
            element.dispatchEvent(new KeyboardEvent('keydown', entry));
            element.dispatchEvent(new KeyboardEvent('keypress', entry));

            // Update value
            const currentPos = element.selectionStart || 0;
            const val = element.value;
            element.value = val.slice(0, currentPos) + char + val.slice(currentPos);
            element.selectionStart = element.selectionEnd = currentPos + 1;

            element.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keyup', entry));
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    /**
     * Simulates human-like mouse movement using Bezier curves.
     */
    /**
     * Simulates human-like mouse movement using Bezier curves.
     */
    static async moveMouseStealthily(targetX: number, targetY: number): Promise<void> {
        const startX = globalThis.scrollX + (globalThis.innerWidth / 2);
        const startY = globalThis.scrollY + (globalThis.innerHeight / 2);

        // Generate a random control point for the Bezier curve
        const controlX = (startX + targetX) / 2 + (Math.random() - 0.5) * 400;
        const controlY = (startY + targetY) / 2 + (Math.random() - 0.5) * 400;

        const steps = 25;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // Quadratic Bezier: (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
            const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * targetX;
            const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * targetY;

            this.dispatchMouseEvent('mousemove', x, y, document);

            // Random delay to simulate variable human speed
            await new Promise(r => globalThis.setTimeout(r, Math.random() * 5 + 2));
        }
    }

    /**
     * Performs a stealthy click with pre-hover and realistic timing.
     * 
     * @param element - The HTML element to click.
     * @returns A promise that resolves when the click sequence is complete.
     */
    static async clickStealthily(element: HTMLElement): Promise<void> {
        const rect = element.getBoundingClientRect();
        // Click a random point within the center 40% of the element to avoid edge-detection
        const x = rect.left + (rect.width * (0.3 + Math.random() * 0.4));
        const y = rect.top + (rect.height * (0.3 + Math.random() * 0.4));

        // 1. Move mouse to target before clicking (most bots click without moving)
        await this.moveMouseStealthily(x, y);
        this.dispatchMouseEvent('mouseover', x, y, element);
        this.dispatchMouseEvent('mouseenter', x, y, element);

        // Human-like pause after hovering but before clicking
        await new Promise(r => globalThis.setTimeout(r, Math.random() * 100 + 50));

        // 2. Mousedown with realistic pressure timing
        this.dispatchMouseEvent('mousedown', x, y, element);
        await new Promise(r => globalThis.setTimeout(r, Math.random() * 50 + 30));

        // 3. Ensure focus is handled correctly (vital for SPAs)
        element.focus();

        // 4. Mouseup & Click to complete the interaction
        this.dispatchMouseEvent('mouseup', x, y, element);
        this.dispatchMouseEvent('click', x, y, element);

        console.log(`[Stealth] Performed human-like click on: ${element.tagName}`);
    }

    /**
     * Dispatches a synthesised mouse event that mimics browser native events.
     */
    private static dispatchMouseEvent(type: string, x: number, y: number, target: EventTarget = document): void {
        const event = new MouseEvent(type, {
            view: globalThis as any,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            buttons: type === 'mousedown' ? 1 : 0,
            detail: type === 'click' ? 1 : 0
        });
        target.dispatchEvent(event);
    }

    /**
     * Masks common bot detection attributes on the 'navigator' and 'window' objects.
     * This should be called as early as possible in the page lifecycle.
     */
    static applyPropertyMasks(): void {
        try {
            // Mask navigator.webdriver (the most common check)
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
            });

            // Overwrite Chrome-specific attributes that bots look for to identify automation
            // Use defineProperty to handle read-only issues safely
            if ((globalThis as any).chrome) {
                // Keep existing runtime but mask other signatures if possible
            } else {
                Object.defineProperty(globalThis, 'chrome', {
                    value: { runtime: {} },
                    writable: true,
                    configurable: true
                });
            }

            // Mask permissions API to prevent automated query detection
            if (navigator.permissions && navigator.permissions.query) {
                const originalQuery = navigator.permissions.query.bind(navigator.permissions);
                Object.defineProperty(navigator.permissions, 'query', {
                    value: (parameters: PermissionDescriptor) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: 'granted' } as PermissionStatus) :
                            originalQuery(parameters)
                    ),
                    configurable: true,
                    writable: true
                });
            }

            console.log('[Stealth] Anti-bot environment masks applied.');
        } catch (e) {
            // Silently fail if blocked by CSP; masking is best-effort
            console.debug('[Stealth] Masking partial failure:', e);
        }
    }
}
