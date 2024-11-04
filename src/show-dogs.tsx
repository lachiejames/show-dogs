import { Detail, ActionPanel, Action, getPreferenceValues } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import { execSync } from "child_process";

interface DogResponse {
  message: string;
  status: string;
}

const PHRASES = [
  "Look at this adorable",
  "Here's a beautiful",
  "Check out this cute",
  "Aww, it's a lovely",
  "Meet this wonderful",
];

function getRandomPhrase(): string {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

function extractBreedFromUrl(url: string): string {
  // URL format: https://images.dog.ceo/breeds/hound-afghan/n02088094_1003.jpg
  try {
    const breedPart = url.split('/breeds/')[1].split('/')[0];
    // Convert "hound-afghan" to "afghan hound"
    return breedPart.split('-').reverse().join(' ');
  } catch {
    return "dog";
  }
}

function speak(text: string) {
  try {
    execSync(`say "${text}"`);
  } catch (error) {
    console.error('Error with text-to-speech:', error);
  }
}

export default function Command() {
  const [dogImage, setDogImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchDog() {
    try {
      setIsLoading(true);
      const response = await fetch("https://dog.ceo/api/breeds/image/random");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json() as DogResponse;
      setDogImage(data.message);
      setError(null);

      // Speak the breed name with a random phrase
      const breed = extractBreedFromUrl(data.message);
      const phrase = getRandomPhrase();
      speak(`${phrase} ${breed}`);

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
      console.error('Error fetching dog:', e);
      setError(`Failed to fetch dog image:\n\`\`\`\n${errorMessage}\n\`\`\``);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchDog();
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

  const breed = dogImage ? extractBreedFromUrl(dogImage) : '';
  const markdown = dogImage
    ? `# ${breed.charAt(0).toUpperCase() + breed.slice(1)}\n\n![Dog](${dogImage})\n\n_Press ⌘+R to see another dog!_\n\n_Press ⌘+S to hear the breed name again_`
    : "# Loading...";

  return (
    <Detail
      markdown={markdown}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action 
            title="New Dog" 
            onAction={fetchDog} 
            shortcut={{ modifiers: ["cmd"], key: "r" }} 
          />
          <Action
            title="Speak Breed"
            onAction={() => speak(`This is a ${extractBreedFromUrl(dogImage || '')}`)}
            shortcut={{ modifiers: ["cmd"], key: "s" }}
          />
        </ActionPanel>
      }
    />
  );
}
