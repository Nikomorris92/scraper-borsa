import express from "express";
import axios from "axios";
import cheerio from "cheerio";

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

app.get("/health", (_req, res) => res.send("ok"));

// GET /scrape?url=<LISTING_URL>&max=500
app.get("/scrape", async (req, res) => {
  const url = req.query.url;
  const max = Number(req.query.max || 0);
  if (!url) return res.status(400).json({ error: "Missing ?url=<LISTING_URL>" });

  try {
    const { data: html } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const $ = cheerio.load(html);

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
    res.status(500).json({ error: String(e) });
  }
});

app.listen(process.env.PORT || 3000);
