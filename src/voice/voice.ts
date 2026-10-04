export function canSpeak(): boolean {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  } catch {
    return false;
  }
}

export function canListen(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    );
  } catch {
    return false;
  }
}

export function speak(text: string, lang: 'hi-IN' | 'en-IN'): void {
  try {
    if (!canSpeak()) return;
    window.speechSynthesis.cancel(); // Stop any pending utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}

// Global declaration for webkitSpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function listen(lang: 'hi-IN' | 'en-IN'): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      if (!canListen()) {
        reject(new Error('Speech recognition not supported'));
        return;
      }

      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let recognizedText = '';

      recognition.onresult = (event: any) => {
        if (event.results && event.results[0] && event.results[0][0]) {
          recognizedText = event.results[0][0].transcript;
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        reject(event.error);
      };

      recognition.onend = () => {
        resolve(recognizedText);
      };

      recognition.start();
    } catch (err) {
      console.warn('Error starting speech recognition:', err);
      reject(err);
    }
  });
}
