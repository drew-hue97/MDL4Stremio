const axios = require("axios");
const cheerio = require("cheerio");

const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 min

async function getPageHTML(url) {
    const cached = cache.get(url);

    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.html;
    }

    const res = await axios.get(url, {
        timeout: 15000,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml"
        }
    });

    cache.set(url, {
        html: res.data,
        time: Date.now()
    });

    return res.data;
}

/**
 * Scrape a MyDramaList list page
 * Supports: /dramalist/username, /list/XXXXX, /profile/username/watchlist
 */
async function scrapeList(url) {
    const dramas = [];
    let currentPage = 1;
    let hasMore = true;
    
    while (hasMore && currentPage <= 10) { // Limit to 10 pages
        const pageUrl = currentPage === 1 ? url : `${url}?page=${currentPage}`;
        
        try {
const html = await getPageHTML(pageUrl);
const $ = cheerio.load(html);
            
            // Handle different list formats
            const items = $(".mdl-style-list .box, .list-container .box, .m-b-sm");
            
            if (items.length === 0) {
                // Try alternative selectors for user dramalists
                const altItems = $("table.mdl-style-list tbody tr, .dragme");
                
                altItems.each((_, el) => {
                    const drama = parseListItem($, el);
                    if (drama) dramas.push(drama);
                });
            } else {
                items.each((_, el) => {
                    const drama = parseListItem($, el);
                    if (drama) dramas.push(drama);
                });
            }
            
            // Check for pagination
            const nextPage = $(".pagination .next:not(.disabled), .page-link[rel='next']");
            hasMore = nextPage.length > 0 && items.length > 0;
            currentPage++;
            
            // Rate limiting
            await sleep(1000 + Math.random() * 1000);
            
} catch (err) {
    console.error(`Error scraping page ${currentPage}:`, err.message);

    if (err.response) {
        console.error("Status:", err.response.status);

        const body =
            typeof err.response.data === "string"
                ? err.response.data.slice(0, 2000)
                : JSON.stringify(err.response.data);

        console.error("Response body:");
        console.error(body);
    }

    hasMore = false;
}

// 👇 ADD THIS LINE (this closes the while loop)
}

return dramas;
}

function parseListItem($, el) {
    const $el = $(el);
    
    // Extract MDL ID from link
    const link = $el.find("a.title, a[href*='/']").first().attr("href") ||
                 $el.find("a").first().attr("href");
    
    if (!link) return null;
    
    const mdlIdMatch = link.match(/\/(\d+-[^\/]+)/);
    const mdlId = mdlIdMatch ? mdlIdMatch[1] : null;
    
    if (!mdlId) return null;
    
    // Extract basic info
    const title = $el.find(".title, .text-primary, h6 a").first().text().trim() ||
                  $el.find("a").first().text().trim();
    
    const poster = $el.find("img").first().attr("data-src") ||
                   $el.find("img").first().attr("src") ||
                   null;
    
    const ratingText = $el.find(".score, .text-sm-start").text();
    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
    
    const yearText = $el.find(".text-muted, small").text();
    const yearMatch = yearText.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;
    
    // Determine type
    const typeText = $el.text().toLowerCase();
    let type = "series";
    if (typeText.includes("movie") || typeText.includes("film")) {
        type = "movie";
    }
    
    return {
        mdlId,
        title,
        poster: poster ? normalizeImageUrl(poster) : null,
        rating,
        year,
        type,
        genres: [],
        synopsis: null
    };
}

/**
 * Scrape detailed drama info from individual page
 */
async function scrapeDramaDetails(mdlId) {
    const url = `https://mydramalist.com/${mdlId}`;
    
const html = await getPageHTML(url);
const $ = cheerio.load(html);
    
    // Title
    const title = $("h1.film-title a").text().trim() ||
                  $("h1").first().text().trim();
    
    const nativeTitle = $(".mdl-aka-titles, .aka").first().text().trim() || null;
    
    // Poster
    const poster = $(".film-cover img, .cover img").first().attr("src") ||
                   $("img[data-src]").first().attr("data-src");
    
    // Background image
    const background = $(".cover-wrapper img").attr("src") || poster;
    
    // Synopsis
    const synopsis = $(".show-synopsis, .synopsis").text().trim() ||
                     $("p.show-synopsis").text().trim();
    
    // Rating
    const ratingText = $(".score, [itemprop='ratingValue']").first().text();
    const rating = parseFloat(ratingText) || null;
    
    // Year
    const yearText = $(".text-muted, .release-year").text();
    const yearMatch = yearText.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;
    
    // Genres
    const genres = [];
    $(".show-genres a, [href*='genre']").each((_, el) => {
        genres.push($(el).text().trim());
    });
    
    // Country
    const country = $("[href*='country']").first().text().trim() || null;
    
    // Cast
    const cast = [];
    $(".box-body .list-item a, .cast .name a").slice(0, 15).each((_, el) => {
        cast.push($(el).text().trim());
    });
    
    // Directors
    const directors = [];
    $("[href*='people'][href*='director'] a, .director a").each((_, el) => {
        directors.push($(el).text().trim());
    });
    
    // Episodes/Runtime
    const infoText = $(".show-info, .details").text();
    const episodesMatch = infoText.match(/(\d+)\s*episodes?/i);
    const episodes = episodesMatch ? parseInt(episodesMatch[1]) : null;
    
    const runtimeMatch = infoText.match(/(\d+)\s*min/i);
    const runtime = runtimeMatch ? `${runtimeMatch[1]} min` : null;
    
    // Type
    const typeText = $(".show-type").text().toLowerCase();
    let type = "series";
    if (typeText.includes("movie") || typeText.includes("film")) {
        type = "movie";
    }
    
    // Try to find IMDB ID (sometimes present in external links)
    const imdbLink = $("a[href*='imdb.com']").attr("href");
    const imdbMatch = imdbLink?.match(/tt\d+/);
    const imdbId = imdbMatch ? imdbMatch[0] : null;
    
    return {
        mdlId,
        title,
        nativeTitle,
        poster: poster ? normalizeImageUrl(poster) : null,
        background: background ? normalizeImageUrl(background) : null,
        synopsis,
        rating,
        year,
        genres: [...new Set(genres)],
        country,
        cast,
        directors,
        episodes,
        runtime,
        type,
        imdbId
    };
}

function normalizeImageUrl(url) {
    if (!url) return null;
    
    // Convert thumbnail URLs to full size
    url = url.replace(/\/w\/\d+\//, "/f/");
    url = url.replace(/\/s\//, "/f/");
    
    // Ensure HTTPS
    if (url.startsWith("//")) {
        url = "https:" + url;
    }
    
    return url;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    scrapeList,
    scrapeDramaDetails
};
process.on("SIGINT", async () => {
    clearInterval(cacheCleaner);
    if (browser) await browser.close();
    process.exit();
});

process.on("SIGTERM", async () => {
    clearInterval(cacheCleaner);
    if (browser) await browser.close();
    process.exit();
});
