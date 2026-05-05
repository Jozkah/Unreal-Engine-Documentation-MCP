import * as cheerio from "cheerio";

const BASE_URL = "https://dev.epicgames.com/documentation";
const USER_AGENT = "UnrealEngineMCP/1.0 (MCP Documentation Server)";

interface SearchResult {
  title: string;
  description: string;
  url: string;
}

interface Category {
  title: string;
  description: string;
  slug: string;
}

function buildVersionedUrl(slug: string, version: string): string {
  // The docs site uses locale-based paths and version query params
  const basePageUrl = `${BASE_URL}/en-us/unreal-engine/${slug}`;
  if (version && version !== "5.7") {
    return `${basePageUrl}?v=${version}`;
  }
  return basePageUrl;
}

function buildSearchUrl(query: string, version: string): string {
  const params = new URLSearchParams({
    query,
    product: "unreal-engine",
    lang: "en-us",
  });
  if (version && version !== "5.7") {
    params.set("version", version);
  }
  return `https://dev.epicgames.com/community/api/search/documentation?${params.toString()}`;
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
  }
  return response.text();
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`);
  }
  return response.json();
}

function extractPageContent(html: string): string {
  const $ = cheerio.load(html);

  // Remove navigation, footer, sidebars, scripts, styles
  $("nav, footer, script, style, .sidebar, .navigation, .breadcrumb, .toc-sidebar, header").remove();
  $('[role="navigation"]').remove();
  $('[class*="footer"]').remove();
  $('[class*="nav-"]').remove();
  $('[class*="sidebar"]').remove();

  // Try to find the main content area
  let content = "";
  const mainSelectors = [
    "article",
    '[role="main"]',
    ".documentation-content",
    ".page-content",
    ".content-body",
    "main",
    ".main-content",
  ];

  for (const selector of mainSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      content = el.first().text();
      break;
    }
  }

  // Fallback: get body text
  if (!content) {
    content = $("body").text();
  }

  // Clean up whitespace
  content = content
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  // Extract structured content with headers
  const structured = extractStructured($);
  if (structured) {
    return structured;
  }

  return content;
}

function extractStructured($: cheerio.CheerioAPI): string | null {
  const sections: string[] = [];
  const title = $("h1").first().text().trim();
  if (title) {
    sections.push(`# ${title}\n`);
  }

  // Get meta description or first paragraph
  const metaDesc = $('meta[name="description"]').attr("content");
  if (metaDesc) {
    sections.push(`${metaDesc}\n`);
  }

  // Extract content from the main area
  const mainSelectors = ["article", '[role="main"]', "main", ".page-content"];
  let mainEl: cheerio.Cheerio<any> | null = null;

  for (const sel of mainSelectors) {
    const el = $(sel);
    if (el.length > 0) {
      mainEl = el.first();
      break;
    }
  }

  if (!mainEl) return null;

  // Walk through elements to build structured output
  mainEl.find("h1, h2, h3, h4, h5, h6, p, ul, ol, pre, code, table, a").each((_, elem) => {
    const el = $(elem);
    const tag = elem.type === "tag" ? elem.tagName : "";

    switch (tag) {
      case "h1":
        // Skip, already captured
        break;
      case "h2":
        sections.push(`\n## ${el.text().trim()}\n`);
        break;
      case "h3":
        sections.push(`\n### ${el.text().trim()}\n`);
        break;
      case "h4":
        sections.push(`\n#### ${el.text().trim()}\n`);
        break;
      case "h5":
      case "h6":
        sections.push(`\n##### ${el.text().trim()}\n`);
        break;
      case "p":
        const text = el.text().trim();
        if (text) sections.push(`${text}\n`);
        break;
      case "pre":
        sections.push(`\n\`\`\`\n${el.text().trim()}\n\`\`\`\n`);
        break;
      case "ul":
        el.find("> li").each((_, li) => {
          sections.push(`- ${$(li).text().trim()}`);
        });
        sections.push("");
        break;
      case "ol":
        el.find("> li").each((i, li) => {
          sections.push(`${i + 1}. ${$(li).text().trim()}`);
        });
        sections.push("");
        break;
      case "table":
        // Simple table extraction
        const rows: string[] = [];
        el.find("tr").each((_, tr) => {
          const cells: string[] = [];
          $(tr).find("th, td").each((_, cell) => {
            cells.push($(cell).text().trim());
          });
          rows.push(`| ${cells.join(" | ")} |`);
        });
        if (rows.length > 1) {
          // Add header separator
          const headerCells = rows[0].split("|").filter(c => c.trim());
          const separator = `|${headerCells.map(() => "---").join("|") }|`;
          rows.splice(1, 0, separator);
        }
        sections.push("\n" + rows.join("\n") + "\n");
        break;
    }
  });

  const result = sections.join("\n").trim();
  return result.length > 100 ? result : null;
}

export async function searchDocs(query: string, version: string, maxResults: number): Promise<SearchResult[]> {
  // Try the community API search first
  try {
    const searchUrl = buildSearchUrl(query, version);
    const data = await fetchJson(searchUrl);

    if (data && Array.isArray(data.results)) {
      return data.results.slice(0, maxResults).map((r: any) => ({
        title: r.title || r.name || "Untitled",
        description: r.description || r.excerpt || r.summary || "",
        url: r.url || `${BASE_URL}/en-us/unreal-engine/${r.slug || r.id}`,
      }));
    }
  } catch {
    // Fallback to HTML scraping of search results
  }

  // Fallback: scrape the documentation search page
  try {
    const searchPageUrl = `https://dev.epicgames.com/documentation/en-us/unreal-engine/search?q=${encodeURIComponent(query)}`;
    const html = await fetchHtml(searchPageUrl);
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    // Try to find search result elements
    $("a[href*='/documentation/']").each((_, elem) => {
      if (results.length >= maxResults) return;
      const el = $(elem);
      const href = el.attr("href") || "";
      const title = el.text().trim();

      // Filter out navigation/footer links
      if (title && href.includes("/unreal-engine/") && !href.includes("sign-in") && title.length > 3 && title.length < 200) {
        const fullUrl = href.startsWith("http") ? href : `https://dev.epicgames.com${href}`;
        // Avoid duplicates
        if (!results.some(r => r.url === fullUrl)) {
          results.push({
            title,
            description: "",
            url: fullUrl,
          });
        }
      }
    });

    return results;
  } catch {
    // Final fallback: use Google site search approach
  }

  // Final fallback: construct a direct search via the docs site
  const directUrl = `${BASE_URL}/en-us/unreal-engine`;
  const html = await fetchHtml(directUrl);
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  $("a[href*='/unreal-engine/']").each((_, elem) => {
    if (results.length >= maxResults) return;
    const el = $(elem);
    const title = el.text().trim();
    const href = el.attr("href") || "";

    if (title.toLowerCase().includes(queryLower) && title.length > 3 && title.length < 200) {
      const fullUrl = href.startsWith("http") ? href : `https://dev.epicgames.com${href}`;
      if (!results.some(r => r.url === fullUrl)) {
        results.push({
          title,
          description: "",
          url: fullUrl,
        });
      }
    }
  });

  return results;
}

export async function fetchDocPage(pageOrUrl: string, version: string): Promise<string> {
  let url: string;

  if (pageOrUrl.startsWith("http://") || pageOrUrl.startsWith("https://")) {
    url = pageOrUrl;
    // Append version if not present
    if (version !== "5.7" && !url.includes("?v=")) {
      url += (url.includes("?") ? "&" : "?") + `v=${version}`;
    }
  } else {
    // It's a slug
    url = buildVersionedUrl(pageOrUrl, version);
  }

  const html = await fetchHtml(url);
  const content = extractPageContent(html);

  if (!content || content.length < 50) {
    throw new Error("Could not extract meaningful content from the page. The page may not exist or may require authentication.");
  }

  // Truncate if extremely long (keep first ~30k chars)
  if (content.length > 30000) {
    return content.substring(0, 30000) + "\n\n[Content truncated - page is very long. Use a more specific page or search for the specific topic you need.]";
  }

  return content;
}

export async function listCategories(version: string): Promise<Category[]> {
  const url = buildVersionedUrl(`unreal-engine-${version.replace(".", "-")}-documentation`, version);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const categories: Category[] = [];

  // The main page has cards/links for each category
  $("a[href*='/documentation/unreal-engine/']").each((_, elem) => {
    const el = $(elem);
    const href = el.attr("href") || "";
    const text = el.text().trim();

    // Parse category cards - they tend to have title + description
    if (href.includes("/unreal-engine/") && !href.includes("unreal-engine-5") && text.length > 5 && text.length < 500) {
      const slug = href.split("/unreal-engine/").pop()?.split("?")[0] || "";
      if (slug && !slug.includes("/") && slug !== "API" && slug !== "whats-new") {
        // Try to split title and description (often repeated in cards)
        const parts = text.split(/\s{2,}|\n/).filter(p => p.trim());
        const title = parts[0] || text;
        const description = parts.length > 1 ? parts.slice(1).join(" ") : "";

        if (!categories.some(c => c.slug === slug)) {
          categories.push({ title: title.trim(), description: description.trim(), slug });
        }
      }
    }
  });

  // Add known top-level categories if scraping didn't find them
  const knownCategories: Category[] = [
    { title: "What's New", description: "Information about new features in each release", slug: "whats-new" },
    { title: "Understanding the Basics", description: "Essential skills and concepts to get started", slug: "understanding-the-basics-of-unreal-engine" },
    { title: "Working with Content", description: "Importing and setting up art assets", slug: "working-with-content-in-unreal-engine" },
    { title: "Building Virtual Worlds", description: "Tools and techniques for environment and level design", slug: "building-virtual-worlds-in-unreal-engine" },
    { title: "Designing Visuals, Rendering, and Graphics", description: "Lighting, materials, textures, visual effects, post processing", slug: "designing-visuals-rendering-and-graphics-with-unreal-engine" },
    { title: "Creating Visual Effects", description: "Niagara particle effects system", slug: "creating-visual-effects-in-niagara-for-unreal-engine" },
    { title: "Blueprints Visual Scripting", description: "Blueprint visual scripting system for gameplay", slug: "blueprints-visual-scripting-in-unreal-engine" },
    { title: "Programming with C++", description: "Information for C++ programmers", slug: "programming-with-cplusplus-in-unreal-engine" },
    { title: "Gameplay Systems", description: "Creating gameplay mechanics, behaviors, and conditions", slug: "gameplay-systems-in-unreal-engine" },
    { title: "Animating Characters and Objects", description: "Animation tools for 2D and 3D characters", slug: "animating-characters-and-objects-in-unreal-engine" },
    { title: "Creating User Interfaces", description: "UMG and Slate UI tools", slug: "creating-user-interfaces-with-umg-and-slate-in-unreal-engine" },
    { title: "Working with Audio", description: "Audio tools and systems", slug: "working-with-audio-in-unreal-engine" },
    { title: "Working with Media", description: "Linear video and virtual production", slug: "working-with-media-in-unreal-engine" },
    { title: "Setting Up Your Production Pipeline", description: "Development efficiency tools and procedures", slug: "setting-up-your-production-pipeline-in-unreal-engine" },
    { title: "Testing and Optimizing Your Content", description: "Performance and quality assurance", slug: "testing-and-optimizing-your-content" },
    { title: "Sharing and Releasing Projects", description: "Publishing projects on supported platforms", slug: "sharing-and-releasing-projects-for-unreal-engine" },
    { title: "Samples and Tutorials", description: "Example scenes, sample games, and tutorials", slug: "samples-and-tutorials-for-unreal-engine" },
    { title: "C++ API Reference", description: "Unreal Engine C++ API Reference documentation", slug: "API" },
  ];

  // Merge: add any known categories not already found
  for (const kc of knownCategories) {
    if (!categories.some(c => c.slug === kc.slug)) {
      categories.push(kc);
    }
  }

  return categories;
}

export async function fetchApiReference(symbol: string, version: string): Promise<string> {
  // Clean up the symbol - handle Class::Method format
  const cleanSymbol = symbol.replace(/::/g, "/");

  // Try direct API page lookup
  const apiUrl = buildVersionedUrl(`API/${cleanSymbol}`, version);

  try {
    const html = await fetchHtml(apiUrl);
    return extractPageContent(html);
  } catch {
    // Symbol might not map directly, try search
  }

  // Try with common prefixes stripped/added
  const variations = [
    cleanSymbol,
    cleanSymbol.replace(/^[UAFEST]/, ""), // Strip UE prefix
    `Classes/${cleanSymbol}`,
    `Structs/${cleanSymbol}`,
    `Functions/${cleanSymbol}`,
  ];

  for (const variant of variations) {
    try {
      const url = buildVersionedUrl(`API/${variant}`, version);
      const html = await fetchHtml(url);
      const content = extractPageContent(html);
      if (content.length > 100) return content;
    } catch {
      continue;
    }
  }

  // Fallback: search for the symbol in docs
  const searchResults = await searchDocs(`${symbol} API reference`, version, 5);
  if (searchResults.length > 0) {
    // Try to fetch the first result that looks like an API page
    const apiResult = searchResults.find(r => r.url.includes("/API/")) || searchResults[0];
    try {
      const html = await fetchHtml(apiResult.url);
      return extractPageContent(html);
    } catch {
      // Return search results instead
      const formatted = searchResults.map((r, i) => `${i + 1}. ${r.title}: ${r.url}`).join("\n");
      return `Could not find direct API page for "${symbol}". Related results:\n\n${formatted}`;
    }
  }

  throw new Error(`Could not find API reference for "${symbol}" in UE ${version}.`);
}
