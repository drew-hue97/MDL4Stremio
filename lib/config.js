/**
 * Configuration utilities for the MyDramaList addon
 */

// Validate MyDramaList URL formats
function isValidMdlUrl(url) {
    const patterns = [
        /mydramalist\.com\/dramalist\/[\w-]+/,
        /mydramalist\.com\/list\/\d+/,
        /mydramalist\.com\/profile\/[\w-]+\/watchlist/,
        /mydramalist\.com\/profile\/[\w-]+\/dramalist/,
        /mydramalist\.com\/\d+-[\w-]+/
    ];
    
    return patterns.some(pattern => pattern.test(url));
}

// Parse different MDL URL types
function parseListUrl(url) {
    if (url.includes("/dramalist/")) {
        const match = url.match(/\/dramalist\/([\w-]+)/);
        return { type: "dramalist", username: match?.[1] };
    }
    
    if (url.includes("/list/")) {
        const match = url.match(/\/list\/(\d+)/);
        return { type: "customlist", id: match?.[1] };
    }
    
    if (url.includes("/watchlist")) {
        const match = url.match(/\/profile\/([\w-]+)\/watchlist/);
        return { type: "watchlist", username: match?.[1] };
    }
    
    return { type: "unknown" };
}

module.exports = {
    isValidMdlUrl,
    parseListUrl
};
