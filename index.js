const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { scrapeList, scrapeDramaDetails } = require("./lib/mdl-scraper");

// Store user-added lists (in production, use a database)
const userLists = new Map();

const manifest = {
    id: "community.mydramalist",
    version: "1.0.0",
    name: "MyDramaList Catalogue",
    description: "Browse your MyDramaList watchlists and custom lists in Stremio",
    resources: ["catalog", "meta"],
    types: ["series", "movie"],
    idPrefixes: ["mdl:"],
    catalogs: [
        {
            type: "series",
            id: "mdl-dramas",
            name: "MyDramaList Dramas",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip", isRequired: false }
            ]
        },
        {
            type: "movie",
            id: "mdl-movies",
            name: "MyDramaList Movies",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip", isRequired: false }
            ]
        }
    ],
    behaviorHints: {
        configurable: true,
        configurationRequired: false
    },
    config: [
        {
            key: "mdlLists",
            type: "text",
            title: "MyDramaList URLs",
            description: "Enter MyDramaList URLs (one per line). Supports: user watchlists, custom lists, and profile dramalists."
        }
    ]
};

const builder = new addonBuilder(manifest);

// Parse configuration to extract list URLs
function parseConfig(config) {
    if (!config || !config.mdlLists) return [];
    
    return config.mdlLists
        .split("\n")
        .map(url => url.trim())
        .filter(url => url.length > 0 && url.includes("mydramalist.com"));
}

// Cache for scraped data
const cache = {
    lists: new Map(),
    dramas: new Map(),
    TTL: 30 * 60 * 1000 // 30 minutes
};

async function getCachedList(url) {
    const cached = cache.lists.get(url);
    if (cached && Date.now() - cached.timestamp < cache.TTL) {
        return cached.data;
    }
    
    const data = await scrapeList(url);
    cache.lists.set(url, { data, timestamp: Date.now() });
    return data;
}

async function getCachedDrama(mdlId) {
    const cached = cache.dramas.get(mdlId);
    if (cached && Date.now() - cached.timestamp < cache.TTL) {
        return cached.data;
    }
    
    const data = await scrapeDramaDetails(mdlId);
    cache.dramas.set(mdlId, { data, timestamp: Date.now() });
    return data;
}

// Catalog handler
builder.defineCatalogHandler(async ({ type, id, extra, config }) => {
    const listUrls = parseConfig(config);
    const skip = parseInt(extra.skip) || 0;
    const search = extra.search?.toLowerCase();
    
    let allDramas = [];
    
    // Fetch all configured lists
    for (const url of listUrls) {
        try {
            const dramas = await getCachedList(url);
            allDramas = allDramas.concat(dramas);
        } catch (err) {
            console.error(`Failed to fetch list ${url}:`, err.message);
        }
    }
    
    // Remove duplicates by MDL ID
    const uniqueDramas = Array.from(
        new Map(allDramas.map(d => [d.mdlId, d])).values()
    );
    
    // Filter by type
    let filtered = uniqueDramas.filter(drama => {
        if (type === "movie") return drama.type === "movie";
        return drama.type === "series" || drama.type === "drama";
    });
    
    // Apply search filter
    if (search) {
        filtered = filtered.filter(drama =>
            drama.title.toLowerCase().includes(search) ||
            drama.nativeTitle?.toLowerCase().includes(search)
        );
    }
    
    // Paginate
    const pageSize = 100;
    const paginated = filtered.slice(skip, skip + pageSize);
    
    // Convert to Stremio meta format
    const metas = paginated.map(drama => ({
        id: `mdl:${drama.mdlId}`,
        type: type,
        name: drama.title,
        poster: drama.poster,
        posterShape: "poster",
        description: drama.synopsis,
        releaseInfo: drama.year?.toString(),
        imdbRating: drama.rating?.toString(),
        genres: drama.genres,
        background: drama.poster,
        links: [
            {
                name: "MyDramaList",
                category: "Links",
                url: `https://mydramalist.com/${drama.mdlId}`
            }
        ]
    }));
    
    return { metas };
});

// Meta handler for detailed info
builder.defineMetaHandler(async ({ type, id }) => {
    if (!id.startsWith("mdl:")) {
        return { meta: null };
    }
    
    const mdlId = id.replace("mdl:", "");
    
    try {
        const drama = await getCachedDrama(mdlId);
        
        const meta = {
            id: id,
            type: type,
            name: drama.title,
            poster: drama.poster,
            posterShape: "poster",
            background: drama.background || drama.poster,
            description: drama.synopsis,
            releaseInfo: drama.year?.toString(),
            imdbRating: drama.rating?.toString(),
            genres: drama.genres,
            director: drama.directors,
            cast: drama.cast?.slice(0, 10),
            country: drama.country,
            runtime: drama.runtime,
            links: [
                {
                    name: "MyDramaList",
                    category: "Links",
                    url: `https://mydramalist.com/${mdlId}`
                }
            ],
            behaviorHints: {
                defaultVideoId: null,
                hasScheduledVideos: false
            }
        };
        
        // Add IMDB ID if available for stream resolution
        if (drama.imdbId) {
            meta.imdb_id = drama.imdbId;
        }
        
        return { meta };
    } catch (err) {
        console.error(`Failed to fetch drama ${mdlId}:`, err.message);
        return { meta: null };
    }
});

// Start the server
const PORT = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port: PORT });

console.log(`
MyDramaList Stremio Addon running at:
  Local:  http://localhost:${PORT}/manifest.json
  
To install in Stremio, add this URL to your addons.

Configure your lists by adding URLs like:
  - https://mydramalist.com/dramalist/username
  - https://mydramalist.com/list/XXXXXX)
  - https://mydramalist.com/profile/username/watchlist
`);
