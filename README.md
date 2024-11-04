# Show Dogs - A Raycast Extension Example

This is a simple experimental project created to learn Raycast extension development. It displays random dog images from the [Dog CEO API](https://dog.ceo/dog-api/) and serves as a basic example of how to create Raycast extensions.

## Learning Purpose

This extension demonstrates several fundamental concepts of Raycast extension development:
- Basic React and TypeScript usage in Raycast
- Fetching data from an external API
- Handling loading states and errors
- Using Raycast's UI components (Detail, ActionPanel, Action)
- Implementing keyboard shortcuts

## Features

- 🐕 Shows a random dog image each time you open the extension
- 🔄 Press ⌘+R to fetch a new random dog image
- 🖼️ High-quality dog images from various breeds

## Installation

This is a development/learning project. To experiment with it:

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Usage

1. Open Raycast
2. Search for "Show Dogs"
3. Press Enter to see a random dog
4. Press ⌘+R to see a new dog image

## Development Notes

This project uses:
- React for UI components
- TypeScript for type safety
- Raycast's Extension API
- Native fetch API for network requests

Feel free to use this as a reference for building your own Raycast extensions!

## Credits

- Dog images provided by the [Dog CEO API](https://dog.ceo/dog-api/)
- Built with [Raycast Extensions API](https://developers.raycast.com)

## License

MIT License - feel free to modify and reuse this extension as you please!
