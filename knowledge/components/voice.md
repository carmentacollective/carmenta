# Voice

Voice as a first-class citizen. Talk to Carmenta, talk with Carmenta. Natural voice
experience that actually works - not a bolted-on afterthought but a core interaction
modality.

## Why This Exists

Typing is slow. Voice is natural. The best AI interactions often happen out loud - while
driving, cooking, walking, or just thinking through a problem. But voice AI has been
disappointing: clunky activation, poor transcription, awkward turn-taking, robotic output.

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

## Open Questions

### Architecture

- **STT provider**: Whisper? Deepgram? AssemblyAI? Google? Tradeoffs in accuracy,
  latency, cost?
- **TTS provider**: ElevenLabs? PlayHT? OpenAI? Amazon Polly? What sounds most natural?
- **Real-time vs. batch**: Streaming transcription vs. process complete utterances?
  Implications for latency and accuracy?
- **On-device vs. cloud**: Any processing on device for latency? Privacy implications?

### Product Decisions

- **Activation model**: Always listening with wake word? Push-to-talk? Both? Privacy
  considerations?
- **Voice persona**: What does Carmenta sound like? One voice or multiple? Our choice?
- **Interruption behavior**: Can we interrupt? How does Carmenta handle it?
- **Fallback behavior**: What happens when voice fails? Graceful degradation to text?

### Technical Specifications Needed

- Audio capture and encoding requirements
- Streaming protocol for real-time transcription
- TTS output format and streaming
- Voice activity detection parameters
- Latency budget breakdown (capture → STT → process → TTS → playback)

### Research Needed

- Benchmark STT providers on accuracy, latency, and cost
- Evaluate TTS options for naturalness and expressiveness
- Study conversational AI voice patterns (GPT-4o voice, Hume, Character.ai voice)
- Research wake word detection options and privacy implications
- Review accessibility requirements for voice interfaces
