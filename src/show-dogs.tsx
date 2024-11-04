import { Detail, ActionPanel, Action } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface DogResponse {
  message: string;
  status: string;
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

  const markdown = dogImage
    ? `# Random Dog\n\n![Dog](${dogImage})\n\n_Press ⌘+R to see another dog!_`
    : "# Loading...";

  return (
    <Detail
      markdown={markdown}
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action title="New Dog" onAction={fetchDog} shortcut={{ modifiers: ["cmd"], key: "r" }} />
        </ActionPanel>
      }
    />
  );
}
