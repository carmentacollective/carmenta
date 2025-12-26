# Voice

Voice as a first-class citizen. Talk to Carmenta, talk with Carmenta. Natural voice
experience that actually works - not a bolted-on afterthought but a core interaction
modality.

## Why This Exists

Typing is slow. Voice is natural. The best AI interactions often happen out loud - while
driving, cooking, walking, or just thinking through a problem. But voice AI has been
disappointing: clunky activation, poor transcription, awkward turn-taking, robotic
output.

The vision promises "the best voice experience available." That means voice that feels
like conversation, not dictation. Low latency. Natural interruption. Expressive output.
Voice that you actually want to use.

## Core Functions

### Speech-to-Text (STT)

Convert voice input to text:

- Real-time transcription as we speak
- High accuracy across accents and environments
- Handle background noise gracefully
- Support for multiple languages

### Text-to-Speech (TTS)

Convert AI responses to voice:

- Natural, expressive voice output
- Appropriate pacing and emphasis
- Voice selection and customization
- Low latency - response should feel conversational

### Voice Interaction Patterns

How voice integrates with the broader experience:

- **Wake word or push-to-talk**: How does voice activate?
- **Turn-taking**: Natural conversation flow, interruption handling
- **Multimodal**: Voice input with visual output, or vice versa
- **Hands-free**: Full interactions without touching a device

### Voice-First Experiences

Some interactions work better in voice:

- Quick questions while multitasking
- Brainstorming and thinking out loud
- Dictation and long-form input
- Accessibility when typing is difficult

## Integration Points

- **Interface**: Voice button, audio visualization, transcript display
- **Concierge**: Voice input goes through same classification and routing
- **AI Team**: Voice interactions with specific agents
- **Conversations**: Voice conversations stored and searchable

## Success Criteria

- Voice feels like talking to a person, not a robot
- Latency is low enough for natural conversation
- Transcription is accurate enough to avoid frustration
- Works in reasonable ambient noise conditions
- We choose voice when it's the right modality, not avoid it

---

## Current Implementation (M1)

### STT: Deepgram Nova-3

We chose Deepgram for voice input based on comprehensive research:

**Why Deepgram:**

- Sub-300ms latency for real-time streaming (vs 1-5s for batch Whisper)
- Nova-3 model with <5% word error rate
- WebSocket streaming with interim results
- Smart formatting (punctuation, numbers, dates)
- Voice activity detection built-in
- $0.0043/min pricing

**Architecture:**

```
lib/voice/
├── types.ts              # Provider abstraction interface
├── deepgram-provider.ts  # Deepgram WebSocket implementation
└── index.ts              # Exports

lib/hooks/
└── use-voice-input.ts    # React hook for voice input

components/voice/
└── voice-input-button.tsx # Mic button with recording state

app/api/voice/token/
└── route.ts              # Server-side token generation
```

**How it works:**

1. User clicks mic button → requests microphone permission
2. API route generates authenticated WebSocket URL (keeps API key server-side)
3. MediaRecorder streams audio in 100ms chunks via WebSocket
4. Deepgram returns interim + final transcripts in real-time
5. Transcript flows directly into chat input field
6. User clicks again to stop → final transcript ready to send

**Technical specs implemented:**

- Audio: WebM/Opus at 48kHz (browser default)
- Chunk size: 100ms (balance of latency vs network efficiency)
- Encoding: Opus codec via MediaRecorder
- Streaming: WebSocket to Deepgram's /v1/listen endpoint
- VAD: Deepgram's utterance detection (1000ms silence threshold)

### Provider Abstraction

Built for future providers (OpenAI Realtime, Gladia):

```typescript
interface VoiceProvider {
  connect(): Promise<void>;
  disconnect(): void;
  pause(): void;
  resume(): void;
  readonly state: VoiceConnectionState;
  readonly isStreaming: boolean;
}
```

---

## Open Questions

### TTS (Not Yet Implemented)

- **Provider**: ElevenLabs? PlayHT? OpenAI? Amazon Polly? What sounds most natural?
- **Voice persona**: What does Carmenta sound like? One voice or multiple?
- **Streaming**: Real-time TTS streaming for responsive output?

### Full Conversational Mode

- **OpenAI Realtime API**: For speech-to-speech when we want full voice conversation
- **Interruption behavior**: Can we interrupt? How does Carmenta handle it?
- **Turn-taking**: Natural conversation flow patterns

### Future Enhancements

- Voice activity detection on device (reduce API calls for silence)
- Wake word detection ("Hey Carmenta")
- Speaker diarization for multi-person input
- Voice-based commands (tone/prosody for intent)
