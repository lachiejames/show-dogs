/**
 * Show Dogs - A Raycast extension for viewing and searching dog images with voice commands
 *
 * This extension uses:
 * - Dog CEO API for dog images
 * - OpenAI's Whisper API for speech-to-text
 * - OpenAI's TTS API for text-to-speech
 * - Sox for audio recording
 */

import { Detail, ActionPanel, Action, getPreferenceValues } from "@raycast/api";
import { useState } from "react";
import OpenAI from "openai";
import fetch from "node-fetch";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ExecException } from "child_process";
import player from "play-sound";
import { execSync } from "child_process";
import { spawn } from "child_process";
import fs_sync from "fs";

const audioPlayer = player({});

const DEBUG = true;  // Toggle debug logging

/**
 * Helper function for consistent log formatting
 */
function log(section: string, message: string, data?: any) {
  if (!DEBUG) return;
  
  const timestamp = new Date().toISOString().split('T')[1];  // Get time portion
  console.log(`[${timestamp}] [${section}] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

/** Response structure from the Dog CEO API */
interface DogResponse {
  message: string; // URL of the dog image
  status: string; // API response status
}

/** User preferences for the extension */
interface Preferences {
  openAiApiKey: string;
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  model: "tts-1" | "tts-1-hd";
  speed: string;
}

/** Response structure for the breed list API endpoint */
interface BreedListResponse {
  message: { [key: string]: string[] }; // Map of breeds to sub-breeds
  status: string;
}

// Collection of phrases to make the TTS responses more engaging
const PHRASES = [
  "Look at this adorable",
  "Here's a beautiful",
  "Check out this cute",
  "Aww, it's a lovely",
  "Meet this wonderful",
];

// Sample phrases for each voice to help users choose their preferred voice
const VOICE_SAMPLES = {
  alloy: "Hi! I'm Alloy, a versatile and balanced voice.",
  echo: "Hello there! I'm Echo, with my deep and warm tone.",
  fable: "Greetings! I'm Fable, your British-accented storyteller.",
  onyx: "Welcome! I'm Onyx, with my deep and authoritative voice.",
  nova: "Hi everyone! I'm Nova, bringing energy and clarity.",
  shimmer: "Hello! I'm Shimmer, with my clear and youthful sound.",
};

/**
 * Returns a random phrase to introduce a dog breed
 * Makes the text-to-speech output more varied and engaging
 */
function getRandomPhrase(): string {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

/**
 * Extracts the breed name from a Dog CEO API image URL
 *
 * @param url - The image URL from the Dog CEO API
 * @returns The breed name in a human-readable format
 *
 * @example
 * // Returns "afghan hound"
 * extractBreedFromUrl("https://images.dog.ceo/breeds/hound-afghan/n02088094_1003.jpg")
 */
function extractBreedFromUrl(url: string): string {
  try {
    const breedPart = url.split("/breeds/")[1].split("/")[0];
    // Convert "hound-afghan" to "afghan hound"
    return breedPart.split("-").reverse().join(" ");
  } catch {
    return "dog";
  }
}

/**
 * Gets the full path to the sox executable
 * Sox is used for audio recording with noise gate capabilities
 *
 * @throws Error if sox is not found at the expected location
 */
function getSoxPath(): string {
  const soxPath = "/opt/homebrew/bin/sox";
  if (fs_sync.existsSync(soxPath)) {
    return soxPath;
  }
  throw new Error("Sox is not found at expected location");
}

/**
 * Main command component for the Show Dogs extension
 * Manages all state and UI rendering for the extension
 */
export default function Command() {
  // Initialize OpenAI client with API key from preferences
  const preferences = getPreferenceValues<Preferences>();
  const openai = new OpenAI({
    apiKey: preferences.openAiApiKey,
  });

  // State for managing dog image display and loading
  const [dogImage, setDogImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for audio playback and recording
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // State for voice recognition and breed search
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [noBreedFound, setNoBreedFound] = useState<string | null>(null);

  // State for recording visualization
  const [recordingTimeLeft, setRecordingTimeLeft] = useState<number>(7);
  const [audioLevel, setAudioLevel] = useState<string>("▁▁▁▁▁▁▁▁▁▁");

  // State for tracking the current stage of voice processing
  const [recordingStage, setRecordingStage] = useState<
    "idle" | "listening" | "processing" | "transcribing" | "searching"
  >("idle");

  /**
   * Converts text to speech using OpenAI's TTS API
   *
   * @param text - The text to convert to speech
   * @returns Promise that resolves when audio playback is complete
   */
  async function speak(text: string) {
    log('TTS', `Starting text-to-speech: "${text}"`);
    try {
      setIsPlaying(true);
      const preferences = getPreferenceValues<Preferences>();

      // Parse speed and ensure it's within valid range (0.25 to 4.0)
      const speed = Math.min(4.0, Math.max(0.25, parseFloat(preferences.speed) || 1.0));

      log('TTS', `Using voice: ${preferences.voice}, speed: ${speed}`);

      const response = await openai.audio.speech.create({
        model: preferences.model,
        voice: preferences.voice,
        input: text,
        speed: speed,
      });

      log('TTS', 'Received audio response from OpenAI');

      // Save the audio buffer to a temporary file
      const buffer = Buffer.from(await response.arrayBuffer());
      const tempFile = join(tmpdir(), `raycast-dog-${Date.now()}.mp3`);
      await fs.writeFile(tempFile, buffer);

      // Play the audio file
      return new Promise<void>((resolve, reject) => {
        audioPlayer.play(tempFile, (err: ExecException) => {
          if (err) {
            console.error("Error playing audio:", err);
            reject(err);
          }
          // Clean up the temporary file
          fs.unlink(tempFile).catch(console.error);
          resolve();
        });
      });
    } catch (error) {
      log('TTS-ERROR', 'Failed to generate speech', error);
      throw error;
    } finally {
      setIsPlaying(false);
    }
  }

  /**
   * Fetches a dog image from the Dog CEO API
   * Can fetch either a random dog or a specific breed
   *
   * @param specificBreed - Optional breed to search for
   */
  async function fetchDog(specificBreed?: string) {
    log('FETCH', specificBreed ? `Searching for breed: ${specificBreed}` : 'Fetching random dog');
    try {
      setIsLoading(true);
      setNoBreedFound(null);
      let url = "https://dog.ceo/api/breeds/image/random";

      if (specificBreed) {
        // Convert "Golden Retriever" to "retriever/golden"
        const searchTerm = specificBreed
          .toLowerCase()
          .replace(/[.,!?]/g, "") // Remove punctuation
          .trim()
          .split(" "); // Split into words

        log('FETCH', 'Processed search term', { original: specificBreed, processed: searchTerm });

        // For two-word breeds, use breed/sub-breed format
        if (searchTerm.length === 2) {
          url = `https://dog.ceo/api/breed/${searchTerm[1]}/${searchTerm[0]}/images/random`;
        } else {
          // For single word breeds, use simple format
          url = `https://dog.ceo/api/breed/${searchTerm[0]}/images/random`;
        }

        log('FETCH', `Using URL: ${url}`);

        // Test if the URL is valid before proceeding
        const testResponse = await fetch(url);
        if (!testResponse.ok) {
          log('FETCH-ERROR', `Invalid breed URL: ${url}`, await testResponse.text());
          setNoBreedFound(`Could not find breed "${specificBreed}"`);
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch(url);
      const data = (await response.json()) as DogResponse;
      setDogImage(data.message);
      setError(null);

      // Speak the breed name with a random phrase
      const breed = extractBreedFromUrl(data.message);
      const phrase = getRandomPhrase();
      await speak(`${phrase} ${breed}`);
    } catch (e) {
      log('FETCH-ERROR', 'Failed to fetch dog image', e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Tests the currently selected TTS voice
   * Plays a sample phrase using the voice selected in preferences
   */
  async function testCurrentVoice() {
    const currentPreferences = getPreferenceValues<Preferences>();
    const sampleText = VOICE_SAMPLES[currentPreferences.voice];

    try {
      setIsPlaying(true);
      await speak(sampleText);
    } catch (error) {
      console.error("Failed to test voice:", error);
    } finally {
      setIsPlaying(false);
    }
  }

  /**
   * Records audio using sox with noise gate settings
   * Provides visual feedback of audio levels and remaining time
   *
   * @returns Promise resolving to the path of the recorded audio file
   * @throws Error if recording fails or is interrupted
   */
  async function recordAudio(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        log('RECORD', 'Starting audio recording');
        const soxPath = getSoxPath();
        const tempFile = join(tmpdir(), `raycast-dog-recording-${Date.now()}.wav`);
        log('RECORD', `Using temp file: ${tempFile}`);

        // Start countdown timer
        const timer = setInterval(() => {
          setRecordingTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);

        const recorder = spawn(soxPath, ["-d", tempFile, "silence", "1", "0.1", "3%", "1", "2.0", "3%"], {
          env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:${process.env.PATH}`,
          },
        });

        // Process sox output to show audio levels
        recorder.stderr.on("data", (data) => {
          const output = data.toString();
          log('SOX-DEBUG', output);  // Log raw sox output
          try {
            if (output.includes("|")) {
              // Extract the level indicator from sox output
              const match = output.match(/\[(.*?)\]/);
              if (match && match[1]) {
                const level = match[1];
                const parts = level.split("|");
                if (parts.length >= 2) {
                  // Count the number of '=' characters in the right part of the meter
                  const levelNum = (parts[1].match(/=/g) || []).length;
                  const visualization = "▁▂▃▄▅▆▇█".repeat(2);
                  setAudioLevel(visualization.slice(levelNum, levelNum + 10) || "▁▁▁▁▁▁▁▁▁▁");
                }
              }
            }
          } catch (error) {
            console.error("Error parsing audio level:", error);
            // Keep the previous audio level if parsing fails
          }
        });

        recorder.on("exit", (code) => {
          log('RECORD', `Recording finished with code: ${code}`);
          clearInterval(timer);
          if (code === 0 || code === null) {
            resolve(tempFile);
          } else {
            reject(new Error(`Recording failed`));
          }
        });

        recorder.on("error", (error) => {
          clearInterval(timer);
          setIsRecording(false);
          reject(error);
        });

        setTimeout(() => {
          if (!recorder.killed) {
            clearInterval(timer);
            recorder.kill("SIGTERM");
          }
        }, 7000);
      } catch (error) {
        log('RECORD-ERROR', 'Recording failed', error);
        reject(error);
      }
    });
  }

  /**
   * Converts recorded audio to text using OpenAI's Whisper and GPT models
   * Uses a two-step process:
   * 1. Whisper API for initial transcription
   * 2. GPT for formatting the breed name to match the Dog CEO API format
   *
   * @param audioFile - Path to the recorded audio file
   * @returns Promise resolving to the formatted breed name
   */
  async function speechToText(audioFile: string): Promise<string> {
    log('STT', 'Starting speech-to-text conversion', { audioFile });
    try {
      const fileStream = fs_sync.createReadStream(audioFile);

      log('STT', 'Sending audio to Whisper API');
      const transcription = await openai.audio.transcriptions.create({
        file: fileStream,
        model: "whisper-1",
        prompt: `This is a dog breed name for the Dog CEO API (https://dog.ceo/api/breeds/list/all).
Common breeds include: chihuahua, husky, poodle, retriever/golden, shepherd/german.
The API uses lowercase names. Single-word breeds use simple format (e.g., "chihuahua").
Two-word breeds use format: mainbreed/subbreed (e.g., "retriever/golden").`,
        language: "en",
      });

      log('STT', `Whisper transcription: "${transcription.text}"`);

      // Then, use GPT to format it correctly
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a helper that formats dog breed names for the Dog CEO API (https://dog.ceo/api/breeds/list/all).
Rules:
1. For single-word breeds, return just the lowercase word (e.g., "chihuahua", "husky")
2. For two-word breeds, use format mainbreed/subbreed (e.g., "retriever/golden")
3. Remove any quotes or extra punctuation
4. Always use lowercase
Examples:
- "Chihuahua" -> chihuahua
- "Golden Retriever" -> retriever/golden
- "German Shepherd" -> shepherd/german
Only return the formatted breed name, nothing else.`,
          },
          {
            role: "user",
            content: `Format this breed name for the Dog CEO API: "${transcription.text}"`,
          },
        ],
        temperature: 0,
      });

      const result = completion.choices[0].message.content?.replace(/["']/g, "").trim() || "";
      log('STT', `Final formatted result: "${result}"`);
      return result;
    } catch (error) {
      log('STT-ERROR', 'Speech-to-text failed', error);
      throw error;
    } finally {
      // Clean up the audio file
      fs.unlink(audioFile).catch(console.error);
    }
  }

  /**
   * Handles the complete voice search flow:
   * 1. Records audio
   * 2. Converts speech to text
   * 3. Searches for the dog breed
   * 4. Updates UI with results
   *
   * Provides real-time feedback at each stage of the process
   */
  async function handleVoiceSearch() {
    log('VOICE-SEARCH', 'Starting voice search flow');
    try {
      // Initial setup
      setDogImage(null);
      setTranscribedText("");
      setNoBreedFound(null);
      setRecordingStage("listening");
      setIsLoading(false);
      setIsRecording(true);
      setRecordingTimeLeft(7);
      setAudioLevel("▁▁▁▁▁▁▁▁▁▁");

      // Record audio
      const audioFile = await recordAudio();

      // Immediately transition to processing
      setIsRecording(false);
      setRecordingStage("processing");
      setTranscribedText("Processing your recording...");

      // Start transcription
      setRecordingStage("transcribing");
      setTranscribedText("Converting speech to text...");
      const text = await speechToText(audioFile);

      // Show transcription result
      setTranscribedText(`Heard: "${text}"`);

      // Search for dog
      setRecordingStage("searching");
      await fetchDog(text);

      setRecordingStage("idle");
    } catch (error) {
      log('VOICE-SEARCH-ERROR', 'Voice search failed', error);
      console.error("Error with voice search:", error);
      setRecordingStage("idle");
      setIsRecording(false);
      setTranscribedText("Failed to process voice command");
    }
  }

  /**
   * Renders error state UI
   * Shows error message and retry button
   */
  if (error) {
    return (
      <Detail
        markdown={`# Error\n${error}\n\n_Press ⌘+R to try again_`}
        actions={
          <ActionPanel>
            <Action title="Try Again" onAction={fetchDog} shortcut={{ modifiers: ["cmd"], key: "r" }} />
          </ActionPanel>
        }
      />
    );
  }

  /**
   * Builds the markdown for the UI
   * Includes:
   * - Dog image (if available)
   * - Recording status and visualization
   * - Processing status
   * - Voice recognition results
   * - Available commands
   */
  const markdown = `# ${dogImage ? extractBreedFromUrl(dogImage) : "Voice Search"}

${dogImage ? `<img src="${dogImage}" alt="Dog" width="400" />\n` : ""}
${
  recordingStage === "listening"
    ? `🎤 **Recording** _(${recordingTimeLeft}s)_
\`\`\`
${audioLevel}
\`\`\`
_Speak breed name clearly_`
    : recordingStage === "processing"
      ? `🎯 **Processing**
\`\`\`
Converting...  ▰▰▰▱▱▱▱▱▱▱
\`\`\``
      : recordingStage === "transcribing"
        ? `🔍 **Transcribing**
\`\`\`
Analyzing...   ▰▰▰▰▰▱▱▱▱▱
\`\`\``
        : recordingStage === "searching"
          ? `🐕 **Searching**
\`\`\`
Finding...     ▰▰▰▰▰▰▰▱▱▱
\`\`\``
          : recordingStage === "idle" && !dogImage
            ? `Welcome! Press ⌘+V to start voice search or ⌘+R for a random dog.`
            : ""
}

${transcribedText ? `**${transcribedText}**` : ""}${noBreedFound ? `\n**${noBreedFound}**` : ""}${isPlaying ? `\n🔊 **Speaking...**` : ""}

---
⌘+R: New Dog  ⌘+V: Voice Search  ⌘+S: Speak  ⌘+T: Test Voice`;

  /**
   * Main UI render
   * Uses Raycast's Detail component to show:
   * - Markdown content
   * - Loading states
   * - Action buttons with keyboard shortcuts
   */
  return (
    <Detail
      markdown={markdown}
      isLoading={isLoading && !isRecording}
      actions={
        <ActionPanel>
          <Action
            title="New Dog"
            onAction={() => {
              setIsLoading(true);
              fetchDog();
            }}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
          <Action title="Voice Search" onAction={handleVoiceSearch} shortcut={{ modifiers: ["cmd"], key: "v" }} />
          <Action
            title="Speak Breed"
            onAction={async () => {
              setIsPlaying(true);
              await speak(`This is a ${extractBreedFromUrl(dogImage || "")}`);
              setIsPlaying(false);
            }}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
          <Action title="Test Current Voice" onAction={testCurrentVoice} shortcut={{ modifiers: ["cmd"], key: "t" }} />
        </ActionPanel>
      }
    />
  );
}
