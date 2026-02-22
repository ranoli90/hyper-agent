/**
 * VoiceInterface
 * Handles Speech-to-Text (STT) and Text-to-Speech (TTS) interactions.
 * Uses the native Web Speech API.
 */

export interface VoiceOptions {
    lang?: string;
    onResult?: (text: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
}

export class VoiceInterface {
    private recognition: any; // SpeechRecognition
    private synthesis: SpeechSynthesis;
    public isListening: boolean = false;
    private options: VoiceOptions;

    constructor(options: VoiceOptions) {
        this.options = options;
        this.synthesis = globalThis.speechSynthesis;

        if ('webkitSpeechRecognition' in globalThis || 'SpeechRecognition' in globalThis) {
            const SpeechRecognition = (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false; // Stop after one sentence for command mode
            this.recognition.interimResults = true;
            this.recognition.lang = options.lang || 'en-US';

            this.recognition.onstart = () => {
                this.isListening = true;
                this.options.onStart?.();
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.options.onEnd?.();
            };

            this.recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (finalTranscript) {
                    this.options.onResult?.(finalTranscript, true);
                } else if (interimTranscript) {
                    this.options.onResult?.(interimTranscript, false);
                }
            };

            this.recognition.onerror = (event: any) => {
                this.isListening = false;
                this.options.onError?.(event.error);
            };
        } else {
            console.warn('SpeechRecognition API not supported in this browser.');
        }
    }

    public startListening() {
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
            } catch (e) {
                console.error("Failed to start recognition:", e);
            }
        }
    }

    public stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    public speak(text: string) {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        // Try to find a good voice
        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        this.synthesis.speak(utterance);
    }

    public stopSpeaking() {
        this.synthesis.cancel();
    }
}
