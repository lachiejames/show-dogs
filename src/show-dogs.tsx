import { Detail, ActionPanel, Action, getPreferenceValues, showHUD } from "@raycast/api";
import { useState, useEffect, useRef } from "react";
import OpenAI from "openai";
import fetch from "node-fetch";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ExecException } from "child_process";
// Import play-sound with require since it doesn't have proper ES module support
import player from "play-sound";

const audioPlayer = player({});

interface DogResponse {
  message: string;
  status: string;
}

interface Preferences {
  openAiApiKey: string;
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  model: "tts-1" | "tts-1-hd";
  speed: string;
}

const PHRASES = [
  "Look at this adorable",
  "Here's a beautiful",
  "Check out this cute",
  "Aww, it's a lovely",
  "Meet this wonderful",
];

const VOICE_SAMPLES = {
  alloy: "Hi! I'm Alloy, a versatile and balanced voice.",
  echo: "Hello there! I'm Echo, with my deep and warm tone.",
  fable: "Greetings! I'm Fable, your British-accented storyteller.",
  onyx: "Welcome! I'm Onyx, with my deep and authoritative voice.",
  nova: "Hi everyone! I'm Nova, bringing energy and clarity.",
  shimmer: "Hello! I'm Shimmer, with my clear and youthful sound."
};

function getRandomPhrase(): string {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

function extractBreedFromUrl(url: string): string {
  // URL format: https://images.dog.ceo/breeds/hound-afghan/n02088094_1003.jpg
  try {
    const breedPart = url.split("/breeds/")[1].split("/")[0];
    // Convert "hound-afghan" to "afghan hound"
    return breedPart.split("-").reverse().join(" ");
  } catch {
    return "dog";
  }
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const openai = new OpenAI({
    apiKey: preferences.openAiApiKey,
  });

  const [dogImage, setDogImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Add a ref to track if we've already fetched
  const initialFetchDone = useRef(false);

  async function speak(text: string) {
    try {
      setIsPlaying(true);
      const preferences = getPreferenceValues<Preferences>();
      
      // Parse speed and ensure it's within valid range (0.25 to 4.0)
      const speed = Math.min(4.0, Math.max(0.25, parseFloat(preferences.speed) || 1.0));
      
      const response = await openai.audio.speech.create({
        model: preferences.model,
        voice: preferences.voice,
        input: text,
        speed: speed,
      });

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
      console.error("Error with OpenAI text-to-speech:", error);
    } finally {
      setIsPlaying(false);
    }
  }

  async function fetchDog() {
    try {
      setIsLoading(true);
      const response = await fetch("https://dog.ceo/api/breeds/image/random");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as DogResponse;
      setDogImage(data.message);
      setError(null);

      // Speak the breed name with a random phrase
      const breed = extractBreedFromUrl(data.message);
      const phrase = getRandomPhrase();
      await speak(`${phrase} ${breed}`);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred";
      console.error("Error:", e);
      setError(`Failed to fetch dog image:\n\`\`\`\n${errorMessage}\n\`\`\``);
    } finally {
      setIsLoading(false);
    }
  }

  async function testCurrentVoice() {
    const currentPreferences = getPreferenceValues<Preferences>();
    const sampleText = VOICE_SAMPLES[currentPreferences.voice];
    
    try {
      await showHUD("Testing voice...");
      await speak(sampleText);
    } catch (error) {
      await showHUD("Failed to test voice");
    }
  }

  useEffect(() => {
    // Only fetch if we haven't already done the initial fetch
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchDog();
    }
  }, []);

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

  const breed = dogImage ? extractBreedFromUrl(dogImage) : "";
  const markdown = dogImage
    ? `# ${breed.charAt(0).toUpperCase() + breed.slice(1)}\n\n![Dog](${dogImage})\n\n_Press ⌘+R to see another dog!_\n\n_Press ⌘+S to hear the breed name again_${isPlaying ? "\n\n_🔊 Speaking..._" : ""}`
    : "# Loading...";

  return (
    <Detail
      markdown={markdown}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action title="New Dog" onAction={fetchDog} shortcut={{ modifiers: ["cmd"], key: "r" }} />
          <Action
            title="Speak Breed"
            onAction={async () => {
              setIsPlaying(true);
              await speak(`This is a ${extractBreedFromUrl(dogImage || "")}`);
              setIsPlaying(false);
            }}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
          <Action
            title="Test Current Voice"
            onAction={testCurrentVoice}
            shortcut={{ modifiers: ["cmd"], key: "t" }}
          />
        </ActionPanel>
      }
    />
  );
}
