import express from "express";
import axios from "axios";
import { load } from "cheerio";
import https from "node:https"; // per sbloccare il TLS

const app = express();

const SEL = {
  item: [".listing", ".result", "article", ".card", ".item", ".property"],
  title: [".listing-title", ".title", "h2", "h3", ".property-title"],
  price: [".price", ".preu", ".amount", ".listing-price"],
  link: ["a.title", "a.details", "a[href]"],
  zone: [".zone", ".district", ".barrio", ".neighborhood", ".localitat", ".address", ".location"]
};

const pick = ($, el, arr) => {
  for (const s of arr) {
    const t = $(el).find(s).first().text().replace(/\s+/g, " ").trim();
    if (t) return t;
  }
  return "";
};

const pickLink = ($, el, base, arr) => {
  for (const s of arr) {
    const href = $(el).find(s).first().attr("href");
    if (href) {
      try { return new URL(href, base).toString(); } catch {}
      return href;
    }
  }
  return base;
};

app.get("/", (_req, res) => res.send("ok"));
app.get("/health", (_req, res) => res.send("ok"));

app.get("/scrape", async (req, res) => {
  const url = req.query.url;
  const max = Number(req.query.max || 0);
  if (!url) return res.status(400).json({ error: "Missing ?url=<LISTING_URL>" });

  try {
    // Workaround TLS per “unable to verify the first certificate”
    const agent = new https.Agent({ rejectUnauthorized: false });

    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,it;q=0.8,en;q=0.7",
        "Referer": url
      },
      httpsAgent: agent,
      maxRedirects: 5,
      timeout: 20000
    });

    const $ = load(html);
    let $items = $(SEL.item.join(","));
    if ($items.length === 0) $items = $("a[href]"); // fallback

    const items = [];
    $items.each((_, el) => {
      const title = pick($, el, SEL.title);
      const zone = pick($, el, SEL.zone);
      const priceText = pick($, el, SEL.price);
      const price = Number((priceText || "").replace(/\./g, "").match(/\d+/g)?.join("") || 0);
      const link = pickLink($, el, url, SEL.link);

      if (title && link) {
        if (!max || (price && price <= max)) items.push({ title, price, link, zone });
      }
    });

    res.json({ count: items.length, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log("Listening on", PORT));

