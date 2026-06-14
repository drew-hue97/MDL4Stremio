# MDL4Stremio
# Stremio MyDramaList Addon

Browse your MyDramaList watchlists and custom lists directly in Stremio.

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm start`
4. Add the addon URL to Stremio: `[localhost](http://localhost:7000/manifest.json)`

## Configuration

After installing the addon in Stremio, configure it with your MyDramaList URLs:

### Supported URL formats:

- **User Dramalist**: `[mydramalist.com](https://mydramalist.com/dramalist/username)`
- **Custom Lists**: `[mydramalist.com](https://mydramalist.com/list/123456)`
- **Watchlists**: `[mydramalist.com](https://mydramalist.com/profile/username/watchlist)`

Enter multiple URLs (one per line) in the addon settings.

## Deployment

For public hosting, deploy to services like:
- Heroku
- Railway
- Render
- Your own VPS

Set the `PORT` environment variable if needed.

## Features

- Browse dramas from multiple MDL lists
- Search within your catalogue
- View drama details, cast, and ratings
- Automatic caching for performance
- Pagination support

## Limitations

- This addon creates a catalogue only; streams come from other addons
- MyDramaList scraping may break if their site structure changes
- Respect rate limits to avoid being blocked

## License

MIT
