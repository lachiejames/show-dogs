# Show Dogs - A Raycast Extension Example

This is a simple experimental project created to learn Raycast extension development. It displays random dog images from the [Dog CEO API](https://dog.ceo/dog-api/) with voice search and text-to-speech capabilities.

## Learning Purpose

This extension demonstrates several fundamental concepts of Raycast extension development:
- Basic React and TypeScript usage in Raycast
- Fetching data from an external API
- Handling loading states and errors
- Using Raycast's UI components (Detail, ActionPanel, Action)
- Implementing keyboard shortcuts
- Voice recognition and text-to-speech integration
- Audio recording and playback
- OpenAI API integration

## Features

- 🐕 Shows a random dog image each time you open the extension
- 🔄 Press ⌘+R to fetch a new random dog image
- 🎤 Press ⌘+V to search for specific breeds using voice commands
- 🗣️ Press ⌘+S to hear the breed name spoken aloud
- 🎯 Press ⌘+T to test your selected text-to-speech voice
- 🖼️ High-quality dog images from various breeds

## Installation

This is a development/learning project. To experiment with it:

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Install Sox (required for voice recording):
   ```bash
   brew install sox
   ```
4. Set up your OpenAI API key in Raycast preferences
5. Run the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open Raycast
2. Search for "Show Dogs"
3. Press Enter to see a random dog
4. Use keyboard shortcuts:
   - ⌘+R: Show new random dog
   - ⌘+V: Start voice search
   - ⌘+S: Speak breed name
   - ⌘+T: Test current voice

## Development Notes

This project uses:
- React for UI components
- TypeScript for type safety
- Raycast's Extension API
- Dog CEO API for dog images
- OpenAI's Whisper API for speech-to-text
- OpenAI's TTS API for text-to-speech
- Sox for audio recording
- Native fetch API for network requests

Feel free to use this as a reference for building your own Raycast extensions!

## Credits

- Dog images provided by the [Dog CEO API](https://dog.ceo/dog-api/)
- Built with [Raycast Extensions API](https://developers.raycast.com)
- Voice features powered by [OpenAI](https://openai.com)

## License

MIT License - feel free to modify and reuse this extension as you please!
