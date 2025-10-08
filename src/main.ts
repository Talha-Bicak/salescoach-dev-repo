import { Player } from "./player.ts";
import { Recorder } from "./recorder.ts";
import "./style.css";
import { LowLevelRTClient, SessionUpdateMessage, Voice } from "rt-client";
import { AzureOpenAI } from "openai";
import { API, SessionData } from "./api.ts";

let realtimeStreaming: LowLevelRTClient;
let audioRecorder: Recorder;
let audioPlayer: Player;

const api = new API();
let currentSession: SessionData | null = null;
let customerSystemPrompt: string | null = null;

let audioContext: AudioContext;
let analyser: AnalyserNode;
let animationFrameId: number | null = null;
const VIZ_TYPE = 'frequency'; // 'frequency' or 'waveform'

const audioVisualizerCanvas = document.querySelector<HTMLCanvasElement>("#audio-visualizer")!;
const audioStatusDiv = document.querySelector<HTMLDivElement>("#audio-status")!;
const audioVisCtx = audioVisualizerCanvas.getContext("2d")!;
const userCameraVideo = document.querySelector<HTMLVideoElement>("#user-camera")!;
const cameraStatusDiv = document.querySelector<HTMLDivElement>("#camera-status")!;

// --- Değerlendirme için DOM Elementleri ---
const evaluateButton = document.querySelector<HTMLButtonElement>("#evaluate-button")!;
const evaluationModal = document.querySelector<HTMLDivElement>("#evaluation-modal")!;
const evaluationResultsDiv = document.querySelector<HTMLDivElement>("#evaluation-results")!;
const closeModalButton = document.querySelector<HTMLSpanElement>("#close-modal")!;
const formEvaluationEndpointField = document.querySelector<HTMLInputElement>("#evaluation-endpoint")!; // Azure OpenAI endpoint alanı
const formEvaluationApiKeyField = document.querySelector<HTMLInputElement>("#evaluation-api-key")!; // Azure OpenAI API key alanı
const formEvaluationDeploymentField = document.querySelector<HTMLInputElement>("#evaluation-deployment")!; // Azure OpenAI deployment alanı

// <<< DEĞİŞTİRİLDİ: .env dosyasından değerleri alma >>>
const DEFAULT_AZURE_OPENAI_ENDPOINT = import.meta.env.VITE_EVALUATION_ENDPOINT || ""; 
const DEFAULT_AZURE_OPENAI_API_KEY = import.meta.env.VITE_EVALUATION_API_KEY || "";
const DEFAULT_AZURE_OPENAI_DEPLOYMENT = import.meta.env.VITE_EVALUATION_DEPLOYMENT || "";

async function start_realtime(endpoint: string, apiKey: string, deploymentOrModel: string) {
const sessionResult = await api.startSession();
if (sessionResult) {
    currentSession = sessionResult.session;
    customerSystemPrompt = sessionResult.systemPrompt;
    console.log("Session created:", currentSession.id);
} else {
    console.warn("Failed to create session, continuing without backend tracking");
}

if (isAzureOpenAI()) {
    realtimeStreaming = new LowLevelRTClient(new URL(endpoint), { key: apiKey }, { deployment: deploymentOrModel });
} else {
    realtimeStreaming = new LowLevelRTClient({ key: apiKey }, { model: deploymentOrModel });
}

try {
console.log("sending session config");
await realtimeStreaming.send(createConfigMessage());
} catch (error) {
console.log(error);
makeNewTextBlock("[Connection error]: Unable to send initial config message. Please check your endpoint and authentication details.");
setFormInputState(InputState.ReadyToStart);
return;
}
console.log("sent");
await Promise.all([resetAudio(true), handleRealtimeMessages()]);

}

function createConfigMessage(): SessionUpdateMessage {
let configMessage: SessionUpdateMessage = {
type: "session.update",
session: {
turn_detection: { type: "server_vad", threshold: 0.8, silence_duration_ms: 900 },
input_audio_transcription: 
{
    model: "whisper-1"
  },
}
};

const systemMessage = customerSystemPrompt || getSystemMessage() || "Sen bir müşterisin ve satış temsilcisiyle konuşuyorsun.";
const temperature = getTemperature();
const voice = getVoice();
if (systemMessage && configMessage.session) configMessage.session.instructions = systemMessage;
if (!isNaN(temperature) && configMessage.session) configMessage.session.temperature = temperature;
if (voice && configMessage.session) configMessage.session.voice = voice;
return configMessage;
}

// Histogram güncelleme fonksiyonu
function updateHistogram(pcmData: Int16Array) {
    const bars = document.querySelectorAll('.audio-histogram .bar') as NodeListOf<HTMLElement>;
    if (bars.length === 0) return;
    
    // PCM verisinden ses seviyesini hesapla
    let sum = 0;
    for (let i = 0; i < pcmData.length; i++) {
        sum += Math.abs(pcmData[i]);
    }
    const average = sum / pcmData.length;
    const intensity = Math.min(average / 3000, 1); // 0-1 arası normalize et
    
    // Her bara farklı yükseklik ver
    bars.forEach((bar) => {
        const randomVariation = 0.7 + (Math.random() * 0.6); // 0.7-1.3 arası
        const height = 20 + (intensity * 60 * randomVariation); // 20-80px arası
        bar.style.height = `${height}px`;
        bar.style.opacity = `${0.7 + intensity * 0.3}`;
    });
}

// --- Minimal Değişiklik: handleRealtimeMessages ---
// Konuşmacıların ayrıştırılmasını kolaylaştırmak için küçük düzenlemeler yapıldı.
async function handleRealtimeMessages() {
let currentSpeakerBlock: HTMLElement | null = null; // Mevcut konuşmacının paragrafını tutmak için

for await (const message of realtimeStreaming.messages()) {
let consoleLog = "" + message.type;

switch (message.type) {
    case "session.created":
        setFormInputState(InputState.ReadyToStop);
        makeNewTextBlock("<< Session Started >>").setAttribute('data-sender', 'system');
        currentSpeakerBlock = null;
        
        // Durum yazısını güncelle
        const callStatus = document.querySelector('.call-status') as HTMLElement;
        if (callStatus) {
            callStatus.textContent = 'Görüşme Başladı';
        }
        break;

    case "response.audio_transcript.delta":
        // Eğer mevcut blok AI değilse veya blok yoksa, yeni AI bloğu başlat
        if (!currentSpeakerBlock || currentSpeakerBlock.dataset.sender !== 'ai') {
            currentSpeakerBlock = makeNewTextBlock("AI: " + message.delta);
            currentSpeakerBlock.setAttribute('data-sender', 'ai');
            currentSpeakerBlock.dataset.text = message.delta;
        } else {
            // Mevcut AI bloğuna ekle
            appendToTextBlock(message.delta, currentSpeakerBlock);
            currentSpeakerBlock.dataset.text = (currentSpeakerBlock.dataset.text || '') + message.delta;
        }
        break;

    case "response.audio.delta":
        const binary = atob(message.delta);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        if(bytes.length > 0 && audioPlayer) {
            const pcmData = new Int16Array(bytes.buffer);
            audioPlayer.play(pcmData);
            
            // Histogram barlarını dinamik olarak güncelle
            updateHistogram(pcmData);
            
            // Durum yazısını güncelle
            const callStatus = document.querySelector('.call-status') as HTMLElement;
            if (callStatus) {
                callStatus.textContent = 'AI Konuşuyor...';
            }
        }
        break;

        case "input_audio_buffer.speech_started":
            // Kullanıcı konuşmaya başladığında mevcut AI bloğunu bitir
            currentSpeakerBlock = null;
            // Yeni User bloğu oluştur
            latestInputSpeechBlock = makeNewTextBlock("User: "); 
            latestInputSpeechBlock.setAttribute('data-sender', 'user');
            if (audioPlayer) audioPlayer.clear();
            
            // Durum yazısını güncelle
            const callStatusUser = document.querySelector('.call-status') as HTMLElement;
            if (callStatusUser) {
                callStatusUser.textContent = 'Siz Konuşuyorsunuz...';
            }
            
            // Animasyon için: transcript gizliyse ringBox'ı göster
            const ringBox = document.querySelector('#ringBox') as HTMLElement;
            if (ringBox && receivedTextContainer.classList.contains('transcript-hidden')) {
                ringBox.style.display = 'block';
            }
            break;

            case "conversation.item.input_audio_transcription.completed":
                const rawTranscript = message.transcript;
                let userTextToDisplay = rawTranscript;
            
                try {
                    const parsedData = JSON.parse(rawTranscript);
                    if (typeof parsedData === 'object' && parsedData !== null && typeof parsedData.text === 'string') {
                        userTextToDisplay = parsedData.text;
                    } else {
                        console.warn("Parsed transcript data is not in expected format:", parsedData, "Raw transcript:", rawTranscript);
                    }
                } catch (e) {
                    console.error("Failed to parse transcript JSON:", e, "Raw transcript:", rawTranscript);
                }
            
                if (latestInputSpeechBlock) {
                    latestInputSpeechBlock.textContent += userTextToDisplay;
                } else {
                    makeNewTextBlock("User: " + userTextToDisplay).setAttribute('data-sender', 'user');
                }
                
                if (currentSession) {
                    await api.saveTranscript(currentSession.id, 'User', userTextToDisplay);
                }
                
                latestInputSpeechBlock = null;
                currentSpeakerBlock = null;
                break;

    case "response.done":
        if (currentSpeakerBlock && currentSpeakerBlock.dataset.sender === 'ai' && currentSession) {
            const aiText = currentSpeakerBlock.dataset.text || '';
            if (aiText) {
                await api.saveTranscript(currentSession.id, 'AI', aiText);
            }
        }
        currentSpeakerBlock = null;
        break;

    default:
        // Bilinmeyen mesaj tiplerini logla ama JSON'a çevirme (gereksiz olabilir)
        consoleLog = `Unknown message type: ${message.type}`;
        console.log(message); // Mesajın tamamını logla
        break;
}
if (consoleLog) {
    console.log(consoleLog);
}


}
// Orijinal resetAudio çağrısı korundu
await resetAudio(false); // Loop bittiğinde sesi sıfırla
}

let recordingActive: boolean = false;
let buffer: Uint8Array = new Uint8Array();

function combineArray(newData: Uint8Array) { /* Orijinal kod */
const newBuffer = new Uint8Array(buffer.length + newData.length);
newBuffer.set(buffer);
newBuffer.set(newData, buffer.length);
buffer = newBuffer;
}

function processAudioRecordingBuffer(data: Buffer) { /* Orijinal kod */
const uint8Array = new Uint8Array(data);
combineArray(uint8Array);
if (buffer.length >= 4800) {
const toSend = new Uint8Array(buffer.slice(0, 4800));
buffer = new Uint8Array(buffer.slice(4800));
const regularArray = String.fromCharCode(...toSend);
const base64 = btoa(regularArray);
// WebSocket bağlantı kontrolü hala önerilir, ancak isteğe göre dokunulmadı.
if (recordingActive && realtimeStreaming) {
realtimeStreaming.send({
type: "input_audio_buffer.append",
audio: base64,
}).catch(e => console.error("Error sending audio data:", e)); // Hata yakalama eklendi
}
}
}

async function resetAudio(startRecording: boolean) { /* Orijinal kod (try-catch eklendi)*/
console.log(`Resetting audio. Start recording: ${startRecording}`);
recordingActive = false;
if (audioRecorder) {
audioRecorder.stop();
}
if (audioPlayer) {
audioPlayer.clear();
}
try {
audioRecorder = new Recorder(processAudioRecordingBuffer);
audioPlayer = new Player();
audioPlayer.init(24000);
// resetAudio fonksiyonunda:
if (startRecording) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioRecorder.start(stream);
    recordingActive = true; // Bu kısım önemli!
    
    // Görselleştirme için stream'i kullan
    if (document.querySelector("#voice-activity-button")) {
        setupAudioVisualization(stream);
    }
    
    // Eğer transcript gizliyse, ringBox'ı göster
    if (receivedTextContainer.classList.contains('transcript-hidden')) {
        const ringBox = document.querySelector('#ringBox') as HTMLElement;
        if (ringBox) ringBox.style.display = 'block';
    }
} else {
    // Kayıt durduğunda görselleştirmeyi de durdur
    if (document.querySelector("#voice-activity-button")) {
        stopVisualization();
        updateAudioStatus('off');
    }
    
    // Kayıt durduğunda ringBox'ı gizle
    const ringBox = document.querySelector('#ringBox') as HTMLElement;
    if (ringBox) ringBox.style.display = 'none';
}
} catch (error) {
console.error("Error during audio reset/start:", error);
makeNewTextBlock(`[Audio Error]: ${error instanceof Error ? error.message : 'Failed to access microphone or initialize audio.'}`);
setFormInputState(InputState.ReadyToStart); // Başlatma başarısız olursa state'i düzelt
}
}

// Audio visualization functions (Orijinal kod)
function setupAudioVisualization(stream: MediaStream) { try { if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext(); if (audioContext.state === 'suspended') audioContext.resume().catch(console.error); analyser = audioContext.createAnalyser(); analyser.fftSize = 256; const source = audioContext.createMediaStreamSource(stream); source.connect(analyser); updateAudioStatus('active'); startVisualization(); console.log("Audio visualization setup complete"); } catch (error) { console.error("Error setting up audio visualization:", error); updateAudioStatus('error'); } }
function startVisualization() { if (!analyser || !audioContext || audioContext.state !== 'running') { console.warn("Cannot start visualization - analyzer or context not ready"); return; } if (animationFrameId) cancelAnimationFrame(animationFrameId); const bufferLength = analyser.frequencyBinCount; const dataArray = new Uint8Array(bufferLength); function draw() { if (!analyser) { if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null; clearVisualizer(); return; } animationFrameId = requestAnimationFrame(draw); const WIDTH = audioVisualizerCanvas.width; const HEIGHT = audioVisualizerCanvas.height; if (VIZ_TYPE === 'frequency') { analyser.getByteFrequencyData(dataArray); audioVisCtx.fillStyle = 'rgb(44, 62, 80)'; audioVisCtx.fillRect(0, 0, WIDTH, HEIGHT); const barWidth = (WIDTH / bufferLength) * 1.5; let x = 0; audioVisCtx.fillStyle = 'rgb(46, 204, 113)'; for (let i = 0; i < bufferLength; i++) { const barHeight = dataArray[i] * (HEIGHT / 256); audioVisCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight); x += barWidth + 1; } const maxLevel = Math.max(...dataArray); if (maxLevel > 50 && recordingActive) updateAudioStatus('speaking'); else if (recordingActive) updateAudioStatus('listening'); else updateAudioStatus('active'); } else { analyser.getByteTimeDomainData(dataArray); audioVisCtx.fillStyle = 'rgb(44, 62, 80)'; audioVisCtx.fillRect(0, 0, WIDTH, HEIGHT); audioVisCtx.strokeStyle = 'rgb(46, 204, 113)'; audioVisCtx.lineWidth = 2; audioVisCtx.beginPath(); const sliceWidth = WIDTH / bufferLength; let x = 0; for (let i = 0; i < bufferLength; i++) { const v = dataArray[i] / 128.0; const y = v * HEIGHT / 2; if (i === 0) audioVisCtx.moveTo(x, y); else audioVisCtx.lineTo(x, y); x += sliceWidth; } audioVisCtx.lineTo(WIDTH, HEIGHT / 2); audioVisCtx.stroke(); } } draw(); }
function stopVisualization() { if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null; clearVisualizer(); }
function clearVisualizer() { if (audioVisCtx && audioVisualizerCanvas) { audioVisCtx.fillStyle = 'rgb(44, 62, 80)'; audioVisCtx.fillRect(0, 0, audioVisualizerCanvas.width, audioVisualizerCanvas.height); } }
function updateAudioStatus(statusClass: string) { if(audioStatusDiv) { audioStatusDiv.className = `status-indicator ${statusClass}`; } }

// --- UI ve Kontroller (Orijinal Kod) ---
const formReceivedTextContainer = document.querySelector<HTMLDivElement>("#received-text-container")!;
const formStartButton = document.querySelector<HTMLButtonElement>("#start-recording")!;
const formStopButton = document.querySelector<HTMLButtonElement>("#stop-recording")!;
const formClearAllButton = document.querySelector<HTMLButtonElement>("#clear-all")!;
const formSettingsButton = document.querySelector<HTMLButtonElement>("#settings-button")!;
const formControlsPanel = document.querySelector<HTMLDivElement>("#controls-panel")!;
const formEndpointField = document.querySelector<HTMLInputElement>("#endpoint")!;
const formAzureToggle = document.querySelector<HTMLInputElement>("#azure-toggle")!;
const formApiKeyField = document.querySelector<HTMLInputElement>("#api-key")!;
const formDeploymentOrModelField = document.querySelector<HTMLInputElement>("#deployment-or-model")!;
const formSessionInstructionsField = document.querySelector<HTMLTextAreaElement>("#session-instructions")!;
const formTemperatureField = document.querySelector<HTMLInputElement>("#temperature")!;
const formVoiceSelection = document.querySelector<HTMLSelectElement>("#voice")!; // SELECT olarak düzeltildi
const cameraButton = document.querySelector<HTMLButtonElement>("#camera-button")!; // Kamera butonu seçildi
const voiceActivityButton = document.querySelector<HTMLButtonElement>("#voice-activity-button")!;
const transcriptToggleButton = document.querySelector<HTMLButtonElement>("#transcript-toggle")!;
const selectTemplateButton = document.querySelector<HTMLButtonElement>("#select-template-button")!;
const receivedTextContainer = document.querySelector<HTMLDivElement>("#received-text-container")!; // toggleTranscript için eklendi

let latestInputSpeechBlock: HTMLElement | null = null; // HTMLElement olarak düzeltildi
let isSettingsPanelVisible: boolean = false;
let cameraStream: MediaStream | null = null; // toggleCamera için eklendi

enum InputState { Working, ReadyToStart, ReadyToStop }

function isAzureOpenAI(): boolean { return formAzureToggle.checked; }
function guessIfIsAzureOpenAI() { const endpoint = (formEndpointField.value || "").trim(); formAzureToggle.checked = endpoint.includes('azure'); } // Basitleştirilmiş kontrol

// --- setFormInputState GÜNCELLENDİ (Evaluate butonu ve yeni API key alanı eklendi) ---
function setFormInputState(state: InputState) {
const isReadyToStart = state === InputState.ReadyToStart;
const isReadyToStop = state === InputState.ReadyToStop;
const isWorking = state === InputState.Working;

// Ayar alanları sadece ReadyToStart durumunda etkin
[formEndpointField, formApiKeyField, formDeploymentOrModelField,
formEvaluationEndpointField, formEvaluationApiKeyField, formEvaluationDeploymentField, // <<< YENİ: Azure OpenAI alanları
formSessionInstructionsField, formTemperatureField,
formVoiceSelection, formAzureToggle, selectTemplateButton].forEach(el => (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled = !isReadyToStart);

// Ana kontrol butonlarının durumları
formStartButton.disabled = !isReadyToStart;
formStopButton.disabled = !isReadyToStop;
formClearAllButton.disabled = isWorking || isReadyToStop;
// Değerlendirme butonu: Sadece ReadyToStart durumunda VE konuşma metni varsa etkin
evaluateButton.disabled = !(isReadyToStart && formReceivedTextContainer.children.length > 1);
// Diğer butonlar: Çalışırken veya durdurulabilirken pasif
[formSettingsButton].forEach(el => (el as HTMLButtonElement).disabled = isWorking || isReadyToStop);

console.log(`UI State set to: ${InputState[state]}`);
}

function getSystemMessage(): string { return formSessionInstructionsField.value || ""; }
function getTemperature(): number { return parseFloat(formTemperatureField.value); }
function getVoice(): Voice | undefined { return formVoiceSelection.value as Voice || undefined; } // Undefined kontrolü

function scrollToBottom() {
// Küçük bir gecikmeyle scroll yapmak render sonrası daha iyi çalışabilir
setTimeout(() => {
if (formReceivedTextContainer) { // Elementin var olduğundan emin ol
formReceivedTextContainer.scrollTop = formReceivedTextContainer.scrollHeight;
}
}, 50); // 50ms gecikme
}

function makeNewTextBlock(text: string = ""): HTMLParagraphElement { // Dönen tipi belirttik
let newElement = document.createElement("p");
newElement.textContent = text;
formReceivedTextContainer.appendChild(newElement);
scrollToBottom(); // Kaydırma eklendi
return newElement;
}

function appendToTextBlock(text: string, targetElement?: HTMLElement | null) { // Target element parametresi eklendi
const elementToAppendTo = targetElement || formReceivedTextContainer.lastElementChild as HTMLElement | null;
if (elementToAppendTo) {
elementToAppendTo.textContent += text;
} else {
// Fallback: If no target or last element, create a new one
makeNewTextBlock(text);
}
scrollToBottom(); // Kaydırma eklendi
}

function toggleSettingsPanel() { /* Orijinal kod */ isSettingsPanelVisible = !isSettingsPanelVisible; if (isSettingsPanelVisible) { formControlsPanel.classList.add("visible"); formSettingsButton.textContent = "Hide Settings"; } else { formControlsPanel.classList.remove("visible"); formSettingsButton.textContent = "Settings"; } }

// --- Orijinal Event Listener'lar ---
formStartButton.addEventListener("click", async () => {
setFormInputState(InputState.Working);

// .env dosyasından değerleri alma
const endpoint = formEndpointField.value.trim() || import.meta.env.VITE_ENDPOINT || "";
const key = formApiKeyField.value.trim() || import.meta.env.VITE_API_KEY || "";
const deploymentOrModel = formDeploymentOrModelField.value.trim() || import.meta.env.VITE_DEPLOYMENT_OR_MODEL || "";

if (isAzureOpenAI() && (!endpoint || !deploymentOrModel)) { alert("Endpoint and Deployment are required for Azure OpenAI"); setFormInputState(InputState.ReadyToStart); return; } // State düzeltme eklendi
if (!isAzureOpenAI() && !deploymentOrModel) { alert("Model is required for OpenAI"); setFormInputState(InputState.ReadyToStart); return; } // State düzeltme eklendi
if (!key) { alert("API Key is required"); setFormInputState(InputState.ReadyToStart); return; } // State düzeltme eklendi
try {
    formReceivedTextContainer.innerHTML = '';
    latestInputSpeechBlock = null;
    evaluateButton.disabled = true;
    
    // RingBox'ı yeniden oluştur ve göster
    formReceivedTextContainer.innerHTML = `
        <div id="ringBox">
            <div class="ring-content">
                <div class="audio-histogram">
                  <div class="bar"></div>
                  <div class="bar"></div>
                  <div class="bar"></div>
                  <div class="bar"></div>
                  <div class="bar"></div>
                  <div class="bar"></div>
                  <div class="bar"></div>
                  <div class="bar"></div>
                </div>
                <div class="call-status">Bağlanıyor...</div>
                <div class="loader" style="display: none;">Sending message...</div>
            </div>
        </div>
    `;
    
    // Eğer transcript gizliyse RingBox'ı göster
    if (receivedTextContainer.classList.contains('transcript-hidden')) {
        const ringBox = document.querySelector('#ringBox') as HTMLElement;
        if (ringBox) ringBox.style.display = 'block';
    }
    
    await start_realtime(endpoint, key, deploymentOrModel);
} catch (error) {
    console.log(error);
    setFormInputState(InputState.ReadyToStart);
}
});

formStopButton.addEventListener("click", async () => {
    setFormInputState(InputState.Working);
    try {
        await resetAudio(false);
        if (realtimeStreaming) {
            realtimeStreaming.close();
        }
        if (currentSession) {
            await api.endSession(currentSession.id);
            console.log("Session ended:", currentSession.id);
            currentSession = null;
        }
    } catch (error) {
        console.error("Error during stop:", error);
    } finally {
        setFormInputState(InputState.ReadyToStart);
        evaluateButton.disabled = !(formReceivedTextContainer.children.length > 1);
    }
});

formClearAllButton.addEventListener("click", async () => { /* Orijinal kod (evaluate butonu yönetimi eklendi) */
formReceivedTextContainer.innerHTML = "";
latestInputSpeechBlock = null;
evaluateButton.disabled = true;
});

formSettingsButton.addEventListener("click", toggleSettingsPanel); // Listener birleştirildi

formEndpointField.addEventListener('change', guessIfIsAzureOpenAI); // Listener birleştirildi

// --- Diğer Orijinal Listener'lar ---
window.addEventListener("DOMContentLoaded", () => {
    formControlsPanel.classList.remove("visible");
    clearVisualizer();
    updateAudioStatus('off');
    
    // RingBox elementini başlangıçta gizle
    const ringBox = document.querySelector('#ringBox') as HTMLElement;
    if (ringBox) {
        ringBox.style.display = 'none';
    }
    
    // Uygulama başlatıldığında varsayılan olarak transcript'i gizle
    receivedTextContainer.classList.add('transcript-hidden');
    transcriptToggleButton.textContent = 'Show Transcript';
    if (receivedTextContainer.classList.contains('transcript-hidden')) {
        const ringBox = document.querySelector('#ringBox') as HTMLElement;
        if (ringBox) ringBox.style.display = 'block';
    }

// .env dosyasından değerleri alma
const endpoint = import.meta.env.VITE_ENDPOINT || "";
const apiKey = import.meta.env.VITE_API_KEY || "";
const deploymentOrModel = import.meta.env.VITE_DEPLOYMENT_OR_MODEL || "";

// Restore form values if available in localStorage, otherwise use env values
const savedEndpoint = localStorage.getItem('currentEndpoint');
formEndpointField.value = savedEndpoint || endpoint || "";
const savedApiKey = localStorage.getItem('currentApiKey');
formApiKeyField.value = savedApiKey || apiKey || "";
const savedDeployment = localStorage.getItem('currentDeployment');
formDeploymentOrModelField.value = savedDeployment || deploymentOrModel || "";

// Check for selected template
const selectedTemplate = localStorage.getItem('selectedTemplate');
if (selectedTemplate) {
formSessionInstructionsField.value = selectedTemplate;
// Template kullanıldıktan sonra localStorage'dan temizle
localStorage.removeItem('selectedTemplate');
}

// DEĞİŞTİRİLDİ: Azure OpenAI değerlendirme ayarlarını yükleme
const savedEvalEndpoint = localStorage.getItem('savedEvaluationEndpoint');
if (savedEvalEndpoint) {
formEvaluationEndpointField.value = savedEvalEndpoint;
} else if (DEFAULT_AZURE_OPENAI_ENDPOINT) {
formEvaluationEndpointField.value = DEFAULT_AZURE_OPENAI_ENDPOINT;
}

const savedEvalApiKey = localStorage.getItem('savedEvaluationApiKey');
if (savedEvalApiKey) {
formEvaluationApiKeyField.value = savedEvalApiKey;
} else if (DEFAULT_AZURE_OPENAI_API_KEY) {
formEvaluationApiKeyField.value = DEFAULT_AZURE_OPENAI_API_KEY;
}

const savedEvalDeployment = localStorage.getItem('savedEvaluationDeployment');
if (savedEvalDeployment) {
formEvaluationDeploymentField.value = savedEvalDeployment;
} else if (DEFAULT_AZURE_OPENAI_DEPLOYMENT) {
formEvaluationDeploymentField.value = DEFAULT_AZURE_OPENAI_DEPLOYMENT;
}

const savedTemperature = localStorage.getItem('currentTemperature'); if (savedTemperature) formTemperatureField.value = savedTemperature;
const savedVoice = localStorage.getItem('currentVoice'); if (savedVoice) formVoiceSelection.value = savedVoice;
const savedIsAzure = localStorage.getItem('savedIsAzure'); if(savedIsAzure) formAzureToggle.checked = savedIsAzure === 'true';
guessIfIsAzureOpenAI(); // Loaded endpoint'e göre kontrol
setFormInputState(InputState.ReadyToStart); // Başlangıç state'i ayarla
evaluateButton.disabled = true; // Başlangıçta pasif
});

window.addEventListener('beforeunload', () => { /* Değiştirildi: Azure OpenAI değerlendirme alanları eklendi */
stopVisualization();
if (audioContext && audioContext.state !== 'closed') { audioContext.close().catch(console.error); }
if (userCameraVideo.srcObject) { const stream = userCameraVideo.srcObject as MediaStream; stream.getTracks().forEach(track => track.stop()); userCameraVideo.srcObject = null; }
// Save current form state
localStorage.setItem('currentEndpoint', formEndpointField.value);
localStorage.setItem('currentApiKey', formApiKeyField.value);
// <<< DEĞİŞTİRİLDİ: Azure OpenAI değerlendirme ayarlarını kaydetme >>>
localStorage.setItem('savedEvaluationEndpoint', formEvaluationEndpointField.value);
localStorage.setItem('savedEvaluationApiKey', formEvaluationApiKeyField.value);
localStorage.setItem('savedEvaluationDeployment', formEvaluationDeploymentField.value);
localStorage.setItem('currentDeployment', formDeploymentOrModelField.value);
localStorage.setItem('currentTemperature', formTemperatureField.value);
localStorage.setItem('currentVoice', formVoiceSelection.value);
localStorage.setItem('savedIsAzure', String(formAzureToggle.checked));
});

selectTemplateButton.addEventListener("click", () => {
    // Mevcut ayarları kaydet
    localStorage.setItem('currentEndpoint', formEndpointField.value);
    localStorage.setItem('currentApiKey', formApiKeyField.value);
    localStorage.setItem('currentDeployment', formDeploymentOrModelField.value);
    localStorage.setItem('currentTemperature', formTemperatureField.value);
    localStorage.setItem('currentVoice', formVoiceSelection.value);
    localStorage.setItem('savedIsAzure', String(formAzureToggle.checked));
    // Azure OpenAI değerlendirme ayarlarını kaydetme
    localStorage.setItem('savedEvaluationEndpoint', formEvaluationEndpointField.value);
    localStorage.setItem('savedEvaluationApiKey', formEvaluationApiKeyField.value);
    localStorage.setItem('savedEvaluationDeployment', formEvaluationDeploymentField.value);

    // templates.html sayfasına yönlendir
    window.location.href = 'templates.html';
});

async function toggleVoiceActivity() { /* Orijinal kod */ try { if (!audioContext || audioContext.state === 'closed') { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); setupAudioVisualization(stream); voiceActivityButton.textContent = 'Stop Voice Activity'; } else { if (audioContext) await audioContext.close(); stopVisualization(); updateAudioStatus('off'); voiceActivityButton.textContent = 'Start Voice Activity'; } } catch (error) { console.error('Error accessing microphone:', error); updateAudioStatus('error'); } }
voiceActivityButton.addEventListener("click", toggleVoiceActivity);

// toggleTranscript fonksiyonunu güncelle:
function toggleTranscript() {
    const isHidden = receivedTextContainer.classList.toggle('transcript-hidden');
    transcriptToggleButton.textContent = isHidden ? 'Show Transcript' : 'Hide Transcript';
    
    // RingBox'ı kontrol et
    const ringBox = document.querySelector('#ringBox') as HTMLElement;
    if (ringBox) {
        // Transcript gizliyken ve kayıt aktifken göster,
        // veya aktif konuşma varsa göster
        if (isHidden) {
            ringBox.style.display = 'block';
        } else {
            ringBox.style.display = 'none';
        }
    }
}

transcriptToggleButton.addEventListener("click", toggleTranscript);

async function toggleCamera() { /* Orijinal kod (hata mesajı güncellendi) */ if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); userCameraVideo.srcObject = null; cameraStatusDiv.className = 'status-indicator off'; cameraButton.textContent = 'Open Camera'; cameraStream = null; } else { try { cameraStream = await navigator.mediaDevices.getUserMedia({ video: true }); userCameraVideo.srcObject = cameraStream; cameraStatusDiv.className = 'status-indicator active'; cameraButton.textContent = 'Close Camera'; } catch (err) { console.error("Error accessing camera:", err); cameraStatusDiv.className = 'status-indicator error'; makeNewTextBlock("[Camera Error]: Failed to access camera."); cameraStream = null; } } }
cameraButton.addEventListener("click", toggleCamera);

// --- DEĞİŞTİRİLDİ: Değerlendirme Fonksiyonları ve Listener'lar (Azure OpenAI KULLANARAK) ---

// Transkripti alma (değişiklik yok)
function getTranscript(): string {
let fullTranscript = "";
const paragraphs = formReceivedTextContainer.querySelectorAll('p');
paragraphs.forEach(p => {
const text = p.textContent?.trim();
// Sistem mesajlarını atla
if (text && !text.startsWith("<<") && !text.startsWith("[")) {
// Eğer data-sender varsa onu kullan, yoksa içeriğe bak
const sender = p.dataset.sender;
let prefix = "";
if(sender === 'user' && !text.startsWith("User:")) prefix = "User: ";
else if (sender === 'ai' && !text.startsWith("AI:")) prefix = "AI: ";
// Eğer text zaten prefix ile başlıyorsa tekrar ekleme
if(text.startsWith("User:") || text.startsWith("AI:")) prefix = "";

fullTranscript += prefix + text + "\n\n";
}
});

    // Boş transkript kontrolü
    if (!fullTranscript.trim()) {
        return "No conversation found.";
    }

    return fullTranscript.trim();
}

// DEĞİŞTİRİLDİ: Azure OpenAI ile Analiz Fonksiyonu 
async function analyzeTranscriptWithAzureOpenAI(transcript: string): Promise<string> {
    // .env dosyasından değerleri alıyoruz
    const endpoint = formEvaluationEndpointField.value.trim() || DEFAULT_AZURE_OPENAI_ENDPOINT;
    const apiKey = formEvaluationApiKeyField.value.trim() || DEFAULT_AZURE_OPENAI_API_KEY;
    const deployment = formEvaluationDeploymentField.value.trim() || DEFAULT_AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = "2025-03-01-preview"; // Azure OpenAI API versiyonu

    if (!endpoint) {
        return "Error: Azure OpenAI endpoint not found. Please enter your endpoint in settings.";
    }

    if (!apiKey) {
        return "Error: Azure OpenAI API key not found. Please enter your API key in settings.";
    }

    if (!deployment) {
        return "Error: Azure OpenAI deployment name not found. Please enter your deployment name in settings.";
    }

    // Get selected template's evaluation criteria if exists
    const selectedEvaluation = localStorage.getItem('selectedEvaluation');
    
    // Default evaluation prompt
    const defaultEvaluationPrompt = `
Sen deneyimli bir konuşma analisti olarak, lütfen aşağıdaki konuşma kaydını değerlendirin.

Değerlendirme Kriterleri:
1. İletişim Becerileri: Akıcılık, netlik ve dil kullanımı
2. Konu Uzmanlığı: Sağlanan bilgilerin doğruluğu ve derinliği
3. Profesyonellik: Ton, dilin uygunluğu, genel tavır
4. Etkileşim: Dinleme becerileri, yanıt kalitesi, diyalog sürdürme

Konuşma Kaydı:
${transcript}

Lütfen her kriteri ele alan detaylı bir değerlendirme yapın ve genel bir değerlendirme ile sonuçlandırın.`;

    // Use selected template's evaluation criteria if available, otherwise use default
    const evaluationPrompt = selectedEvaluation ? 
        `${selectedEvaluation}\n\nKonuşma Transkripti:\n${transcript}` : 
        defaultEvaluationPrompt;

    console.log("Using evaluation template:", selectedEvaluation ? "Custom template" : "Default template");
    
    // ÖNEMLİ: Değerlendirme kullanıldıktan sonra localStorage'dan kriterleri temizle
    // Bu sayede bir sonraki değerlendirmede template seçilmediğinde varsayılan kriter kullanılacak
    if (selectedEvaluation) {
        localStorage.removeItem('selectedEvaluation');
        console.log("Evaluation template cleared from localStorage after use");
    }
    
    evaluationResultsDiv.innerHTML = '';
    evaluationResultsDiv.classList.add('loading');
    console.log("Gönderilen Değerlendirme Prompt'u:", evaluationPrompt);
    try {
        const client = new AzureOpenAI({
            apiKey: apiKey,
            endpoint: endpoint,
            deployment: deployment,
            apiVersion: apiVersion,
            dangerouslyAllowBrowser: true
        });

        const result = await client.chat.completions.create({
            model: deployment, // Deployment adını model olarak kullan
            messages: [
                {
                    role: "system",
                    content: "Sen profesyonel bir konuşma analisti ve değerlendirme uzmanısın. Konuşma transkripleri üzerinde detaylı analiz yapma konusunda uzmanlaşmışsın."
                },
                {
                    role: "user",
                    content: evaluationPrompt
                }
            ],
            temperature: 0.7,
            top_p: 0.8,
            max_tokens: 1024,
        });

        const response = result.choices[0].message.content;

        if (!response) {
            throw new Error("Azure OpenAI API returned an empty response.");
        }
        return response;

    } catch (error: any) {
        console.error("Azure OpenAI API Error:", error);
        let errorMessage = `**Evaluation Failed!**\n\nError: ${error.message || 'Unknown error'}\n\n`;
        errorMessage += "Please check your API key, endpoint, and deployment name and ensure they're valid.";
        return `<div class="evaluation-error">${errorMessage.replace(/\n/g, '<br>')}</div>`;
    } finally {
        evaluationResultsDiv.classList.remove('loading');
    }
}


// Modal Kontrol Fonksiyonları (değişiklik yok)
function openEvaluationModal() {
    evaluationModal.style.display = "block";
    document.body.style.overflow = 'hidden';
}
function closeEvaluationModal() {
    evaluationModal.style.display = "none";
    evaluationResultsDiv.innerHTML = '';
    document.body.style.overflow = '';
}

// Basit Markdown -> HTML çevirici (değişiklik yok, Azure OpenAI genellikle Markdown döndürür)
function simpleMarkdownToHtml(markdown: string): string {
    if (!markdown) return "";
    // Hata mesajı div'ini doğrudan döndür
    if (markdown.includes('<div class="evaluation-error">')) return markdown;

    let html = markdown
        .replace(/^### (.*?)$/gm, '<h4>$1</h4>') // h3 -> h4
        .replace(/^## (.*?)$/gm, '<h3>$1</h3>')   // h2 -> h3
        .replace(/^# (.*?)$/gm, '<h2>$1</h2>')    // h1 -> h2
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>')       // Italic (tek yıldız)
        .replace(/`([^`]+)`/g, '<code>$1</code>')     // Inline code
        // Liste öğeleri (Basit hali, iç içe listeleri desteklemez)
        .replace(/^\s*[-*+] (.*?)$/gm, '<li>$1</li>')
        // Liste bloklarını sarma (Arka arkaya gelen li'leri ul içine alır)
        .replace(/<\/li>\s*<li>/g, '</li><li>') // Aradaki boşlukları temizle
        .replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>') // Tek blok
        // Birden fazla ul bloğunu birleştir (ardışık olanları)
        .replace(/<\/ul>\s*<ul>/g, ''); // Aradaki boşlukları ve etiketleri kaldırır

    // Paragraflar (Çift satır atlamalarını <br><br> yapar, tekleri <br>)turn_detection
    html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    // Liste etiketlerinden sonra gelen <br> ları kaldır
    html = html.replace(/<\/(ul|li)><br>/g, '</$1>');
    // Liste etiketlerinden önce gelen <br> ları kaldır
    html = html.replace(/<br><(ul|li)>/g, '<$1>');

    return html;
}


// Evaluate Butonu Listener'ı (analyzeTranscriptWithAzureOpenAI çağrısı yapacak şekilde güncellendi)
evaluateButton.addEventListener("click", async () => {
const transcript = getTranscript();
if (!transcript) {
alert("No conversation found to evaluate. Please record a conversation first.");
return;
}

openEvaluationModal();
evaluateButton.disabled = true;

try {
    const evaluationResultMarkdown = await analyzeTranscriptWithAzureOpenAI(transcript);
    evaluationResultsDiv.innerHTML = simpleMarkdownToHtml(evaluationResultMarkdown);
    
    if (currentSession) {
        const scoreMatch = evaluationResultMarkdown.match(/(?:skor|score|puan)[\s:]*(\d+(?:\.\d+)?)/i);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) : undefined;
        await api.saveEvaluation(currentSession.id, evaluationResultMarkdown, score);
        console.log("Evaluation saved to database");
    }
} catch (error) {
    console.error("Unexpected error during evaluation process:", error);
    evaluationResultsDiv.innerHTML = `<div class="evaluation-error">An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
} finally {
    if (formStartButton.disabled === false) {
        evaluateButton.disabled = !(formReceivedTextContainer.children.length > 1);
    } else {
        evaluateButton.disabled = true;
    }
}
});

// Modal Kapatma Listener'ları (değişiklik yok)
closeModalButton.addEventListener("click", closeEvaluationModal);
window.addEventListener("click", (event) => { if (event.target === evaluationModal) closeEvaluationModal(); });
window.addEventListener("keydown", (event) => { if (event.key === "Escape" && evaluationModal.style.display === "block") closeEvaluationModal(); });

console.log("Initial main.ts script loaded (Azure OpenAI evaluation enabled from .env file)."); // Scriptin yüklendiğini belirt